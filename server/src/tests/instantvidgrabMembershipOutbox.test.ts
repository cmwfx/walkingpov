import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyInternalRequest } from '../services/ivgInternalSignature.js';
import {
  processLegacyMembershipOutbox,
  type OutboxRpc,
} from '../services/instantvidgrabMembershipOutbox.js';

const walkingpovUserId = '123e4567-e89b-42d3-a456-426614174001';
const instantvidgrabUserId = 'ivg_synthetic_user';
const secret = 'synthetic-secret-0123456789abcdef0123456789';
const event = {
  id: 'ffb71854-163e-48aa-8e68-abdd718e273a',
  kind: 'legacy_membership_snapshot',
  aggregate_id: walkingpovUserId,
  payload: {
    eventId: `wpv_legacy_membership_${walkingpovUserId}_grant_01234567-89ab-cdef-0123-456789abcdef_v1_active`,
    walkingpovUserId,
    instantvidgrabUserId,
  },
  attempts: 1,
  lease_token: '1d7b82d3-846e-4661-8b4f-7d8f69e65ac5',
};

function fakeRpc(claimedEvent = event) {
  const calls: Array<{ functionName: string; parameters: Record<string, unknown> }> = [];
  let claimCount = 0;
  const rpc: OutboxRpc = async (functionName, parameters) => {
    calls.push({ functionName, parameters });
    if (functionName === 'claim_ivg_integration_outbox') {
      claimCount += 1;
      return { data: claimCount === 1 ? [claimedEvent] : [], error: null };
    }
    return { data: true, error: null };
  };
  return { rpc, calls };
}

test('delivers a fresh membership snapshot over signed HMAC and completes the durable event', async () => {
  const { rpc, calls } = fakeRpc();
  let sentBody = '';
  let signedPath = '';
  const result = await processLegacyMembershipOutbox({
    rpc,
    async resolveSnapshot(userId) {
      assert.equal(userId, walkingpovUserId);
      // This is read when the event is delivered, rather than captured when it was queued.
      return { legacyPremium: true, legacyGrantVersion: 4 };
    },
    workerId: 'synthetic-worker',
    apiBaseUrl: 'https://synthetic.appwrite.network',
    keyId: 'synthetic-key',
    secret,
    now: new Date(1_800_000_000_000),
    fetcher: async (url, init) => {
      signedPath = new URL(String(url)).pathname;
      sentBody = String(init?.body);
      const headers = init?.headers as Record<string, string>;
      const verification = verifyInternalRequest({
        keyId: headers['x-ivg-key-id'] || '',
        method: String(init?.method),
        path: signedPath,
        timestamp: headers['x-ivg-timestamp'] || '',
        nonce: headers['x-ivg-nonce'] || '',
        signature: headers['x-ivg-signature'] || '',
        body: Buffer.from(sentBody, 'utf8'),
      }, [{ id: 'synthetic-key', secret }], 1_800_000_000);
      assert.equal(verification.ok, true);
      return Response.json({ accepted: true, applied: true, legacyGrantVersion: 4 });
    },
  });

  assert.deepEqual(result, { claimed: 1, delivered: 1, failed: 0 });
  assert.equal(signedPath, '/api/internal/integrations/walkingpov/legacy-membership');
  assert.deepEqual(JSON.parse(sentBody), {
    ...event.payload,
    legacyPremium: true,
    legacyGrantVersion: 4,
  });
  assert.doesNotMatch(sentBody, /whop|payment|checkout|order|origin|referral/i);
  assert.equal(calls[1]?.functionName, 'complete_ivg_integration_outbox');
});

test('records only a safe retry code when InstantVidGrab is unavailable', async () => {
  const { rpc, calls } = fakeRpc();
  const result = await processLegacyMembershipOutbox({
    rpc,
    async resolveSnapshot() {
      return { legacyPremium: false, legacyGrantVersion: 0 };
    },
    workerId: 'synthetic-worker',
    apiBaseUrl: 'https://synthetic.appwrite.network',
    keyId: 'synthetic-key',
    secret,
    now: new Date(1_800_000_000_000),
    fetcher: async () => new Response('synthetic failure', { status: 503 }),
  });

  assert.deepEqual(result, { claimed: 1, delivered: 0, failed: 1 });
  assert.equal(calls[1]?.functionName, 'fail_ivg_integration_outbox');
  assert.equal(calls[1]?.parameters.p_error_code, 'ivg_http_503');
  assert.equal(calls[1]?.parameters.p_retry_after_seconds, 30);
});

test('rejects a mismatched aggregate before making the external request', async () => {
  const { rpc, calls } = fakeRpc({
    ...event,
    aggregate_id: '123e4567-e89b-42d3-a456-426614174099',
  });
  let fetchCalls = 0;
  const result = await processLegacyMembershipOutbox({
    rpc,
    async resolveSnapshot() {
      return { legacyPremium: true, legacyGrantVersion: 1 };
    },
    workerId: 'synthetic-worker',
    apiBaseUrl: 'https://synthetic.appwrite.network',
    keyId: 'synthetic-key',
    secret,
    fetcher: async () => {
      fetchCalls += 1;
      return Response.json({ accepted: true, applied: true, legacyGrantVersion: 1 });
    },
  });

  assert.deepEqual(result, { claimed: 1, delivered: 0, failed: 1 });
  assert.equal(fetchCalls, 0);
  assert.equal(calls[1]?.functionName, 'fail_ivg_integration_outbox');
  assert.equal(calls[1]?.parameters.p_error_code, 'invalid_membership_outbox_event');
});
