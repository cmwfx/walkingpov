import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { signInternalRequest } from './ivgInternalSignature.js';
import type { WalkingPOVAccessSnapshot } from './instantvidgrabHandoff.js';

const uuidSchema = z.string().uuid();
const snapshotSchema = z.object({
  legacyPremium: z.boolean(),
  legacyGrantVersion: z.number().int().min(0).max(2_147_483_647),
}).strict().refine((snapshot) => !snapshot.legacyPremium || snapshot.legacyGrantVersion > 0);

const outboxPayloadSchema = z.object({
  eventId: z.string().regex(/^wpv_legacy_membership_[a-f0-9-]{36}_[A-Za-z0-9_-]{1,80}$/),
  walkingpovUserId: uuidSchema,
  instantvidgrabUserId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/),
}).strict();

const outboxRowSchema = z.object({
  id: z.string().uuid(),
  kind: z.literal('legacy_membership_snapshot'),
  aggregate_id: uuidSchema,
  payload: outboxPayloadSchema,
  attempts: z.number().int().positive(),
  lease_token: z.string().uuid(),
}).strict();

const deliveryResponseSchema = z.object({
  accepted: z.literal(true),
  applied: z.boolean(),
  legacyGrantVersion: z.number().int().min(0).max(2_147_483_647),
}).strict();

type RpcResult = { data: unknown; error: unknown | null };
export type OutboxRpc = (
  functionName: string,
  parameters: Record<string, unknown>,
) => Promise<RpcResult>;

export type MembershipOutboxSummary = {
  claimed: number;
  delivered: number;
  failed: number;
};

export class MembershipOutboxError extends Error {
  constructor(readonly code: string, readonly retryAfterSeconds: number) {
    super('The membership synchronization event could not be delivered.');
    this.name = 'MembershipOutboxError';
  }
}

function retryDelay(attempts: number) {
  return Math.min(3600, 30 * 2 ** Math.min(7, Math.max(0, attempts - 1)));
}

function parseResponse(value: unknown, expectedVersion: number) {
  const response = deliveryResponseSchema.parse(value);
  if (response.legacyGrantVersion < expectedVersion) {
    throw new MembershipOutboxError('ivg_version_not_applied', 30);
  }
  return response;
}

export async function processLegacyMembershipOutbox(input: {
  rpc: OutboxRpc;
  resolveSnapshot: (walkingpovUserId: string) => Promise<WalkingPOVAccessSnapshot>;
  workerId: string;
  apiBaseUrl: string;
  keyId: string;
  secret: string;
  fetcher?: typeof fetch;
  maxJobs?: number;
  now?: Date;
}): Promise<MembershipOutboxSummary> {
  const maxJobs = Math.max(1, Math.min(5, input.maxJobs ?? 3));
  const summary: MembershipOutboxSummary = { claimed: 0, delivered: 0, failed: 0 };
  const fetcher = input.fetcher ?? fetch;

  for (let index = 0; index < maxJobs; index += 1) {
    const claimedResult = await input.rpc('claim_ivg_integration_outbox', {
      p_worker_id: input.workerId,
      p_lease_seconds: 60,
    });
    if (claimedResult.error) throw new MembershipOutboxError('outbox_claim_failed', 30);
    const claimedRows = Array.isArray(claimedResult.data) ? claimedResult.data : [];
    if (claimedRows.length === 0) break;
    summary.claimed += 1;

    const rawRow = claimedRows[0];
    const parsedRow = outboxRowSchema.safeParse(rawRow);
    if (!parsedRow.success) {
      const lease = z.object({ id: z.string().uuid(), lease_token: z.string().uuid(), attempts: z.number().int().positive() }).safeParse(rawRow);
      if (lease.success) {
        await input.rpc('fail_ivg_integration_outbox', {
          p_id: lease.data.id,
          p_lease_token: lease.data.lease_token,
          p_error_code: 'invalid_membership_outbox_event',
          p_retry_after_seconds: retryDelay(lease.data.attempts),
        });
      }
      summary.failed += 1;
      continue;
    }

    const row = parsedRow.data;
    try {
      if (row.aggregate_id !== row.payload.walkingpovUserId) {
        throw new MembershipOutboxError('invalid_membership_outbox_event', retryDelay(row.attempts));
      }
      const snapshot = snapshotSchema.parse(await input.resolveSnapshot(row.payload.walkingpovUserId));
      const body = JSON.stringify({ ...row.payload, ...snapshot });
      const path = '/api/internal/integrations/walkingpov/legacy-membership';
      const timestamp = String(Math.floor((input.now ?? new Date()).getTime() / 1_000));
      const nonce = randomBytes(24).toString('base64url');
      const bodyBytes = Buffer.from(body, 'utf8');
      const signature = signInternalRequest({
        keyId: input.keyId,
        method: 'POST',
        path,
        timestamp,
        nonce,
        body: bodyBytes,
      }, input.secret);
      const response = await fetcher(new URL(path, input.apiBaseUrl), {
        method: 'POST',
        headers: {
          'x-ivg-key-id': input.keyId,
          'x-ivg-timestamp': timestamp,
          'x-ivg-nonce': nonce,
          'x-ivg-signature': signature,
          'content-type': 'application/json',
          'accept-encoding': 'identity',
        },
        body,
        redirect: 'error',
        signal: AbortSignal.timeout(7_000),
      });
      if (!response.ok) {
        throw new MembershipOutboxError(`ivg_http_${response.status}`, retryDelay(row.attempts));
      }
      const responseBody: unknown = await response.json();
      parseResponse(responseBody, snapshot.legacyGrantVersion);

      const completed = await input.rpc('complete_ivg_integration_outbox', {
        p_id: row.id,
        p_lease_token: row.lease_token,
      });
      if (completed.error) throw new MembershipOutboxError('outbox_complete_failed', 30);
      summary.delivered += 1;
    } catch (error) {
      const failure = error instanceof MembershipOutboxError
        ? error
        : new MembershipOutboxError('ivg_delivery_failed', retryDelay(row.attempts));
      const failed = await input.rpc('fail_ivg_integration_outbox', {
        p_id: row.id,
        p_lease_token: row.lease_token,
        p_error_code: failure.code,
        p_retry_after_seconds: failure.retryAfterSeconds,
      });
      if (failed.error) throw new MembershipOutboxError('outbox_fail_update_failed', 30);
      summary.failed += 1;
    }
  }

  return summary;
}
