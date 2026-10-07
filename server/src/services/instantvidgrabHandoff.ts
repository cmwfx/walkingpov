import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';

type WalkingPOVGrantSnapshotRow = {
  product: string;
  source_type?: string;
  state: string;
  version: number | string;
};

export type WalkingPOVAccessSnapshot = {
  legacyPremium: boolean;
  legacyGrantVersion: number;
};

export function deriveWalkingPOVAccessSnapshot(
  rows: WalkingPOVGrantSnapshotRow[],
): WalkingPOVAccessSnapshot {
  let revision = 0n;
  let legacyPremium = false;
  for (const row of rows) {
    if (row.product !== 'walkingpov' || row.source_type === 'instantvidgrab_subscription') continue;
    if (!['active', 'suspended', 'revoked'].includes(row.state)) {
      throw new Error('WalkingPOV grant state is invalid.');
    }
    const versionText = String(row.version);
    if (!/^[1-9][0-9]*$/.test(versionText)) {
      throw new Error('WalkingPOV grant version is invalid.');
    }
    revision += BigInt(versionText);
    if (row.state === 'active') legacyPremium = true;
  }
  if (revision > BigInt(2_147_483_647)) {
    throw new Error('WalkingPOV grant version exceeds the supported Appwrite range.');
  }
  return { legacyPremium, legacyGrantVersion: Number(revision) };
}

const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43,128}$/);
export const instantVidGrabAuthorizationSchema = z.object({
  state: tokenSchema,
  challenge: tokenSchema,
  intent: z.enum(['checkout', 'download', 'connect']),
  selectedVideoId: z.string().uuid().optional(),
}).strict().superRefine((value, context) => {
  if (value.intent === 'download' && !value.selectedVideoId) {
    context.addIssue({ code: 'custom', path: ['selectedVideoId'], message: 'A video is required.' });
  }
});

export const instantVidGrabExchangeSchema = z.object({
  code: tokenSchema,
  state: tokenSchema,
  verifier: tokenSchema,
}).strict();

export const instantVidGrabLinkSchema = z.object({
  walkingpovUserId: z.string().uuid(),
  instantvidgrabUserId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/),
}).strict();

export function digestAuthorizationValue(value: string) {
  return `\\x${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

export function createAuthorizationCode() {
  return randomBytes(32).toString('base64url');
}

export function createVerifierChallenge(verifier: string) {
  return createHash('sha256').update(verifier, 'ascii').digest('base64url');
}

export function buildInstantVidGrabCallback(callbackUrl: string, code: string, state: string) {
  const callback = new URL(callbackUrl);
  if (callback.protocol !== 'https:' || callback.pathname !== '/connect/callback' || callback.search || callback.hash) {
    throw new Error('InstantVidGrab callback configuration is invalid.');
  }
  callback.searchParams.set('code', code);
  callback.searchParams.set('state', state);
  return callback.toString();
}
