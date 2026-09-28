import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  resolveAuthorizedWalkingPOVVideo,
  VideoResolutionError,
  type VideoResolutionStore,
} from '../services/instantvidgrabVideoResolution.js';

const input = {
  walkingpovUserId: '123e4567-e89b-42d3-a456-426614174000',
  instantvidgrabUserId: 'ivg-synthetic-user',
  videoId: '123e4567-e89b-42d3-a456-426614174001',
  mediaOrigin: 'https://media.candidfan.com',
  mediaSigningSecret: 'synthetic-media-signing-secret-at-least-32-bytes',
  now: new Date('2026-09-24T12:00:00.000Z'),
  signMediaKey: (key: string, expires: number, secret: string) => `${key}.${expires}.${secret.length}`,
};

function store(overrides: Partial<VideoResolutionStore> = {}): VideoResolutionStore {
  return {
    readIdentityLink: async () => ({ instantvidgrabUserId: input.instantvidgrabUserId, state: 'verified' }),
    readUser: async () => ({ membershipStatus: 'premium', isAdmin: false }),
    readReadyVideo: async () => ({ updatedAt: '2026-09-24T11:00:00.000Z' }),
    readMediaAsset: async () => ({
      storageKey: '123e4567-e89b-42d3-a456-426614174002',
      contentType: 'video/mp4',
      sizeBytes: 123_456,
    }),
    ...overrides,
  };
}

test('resolved metadata is limited to opaque media details and an expiring signed URL', async () => {
  const result = await resolveAuthorizedWalkingPOVVideo({ ...input, store: store() });
  const url = new URL(result.downloadUrl);
  assert.equal(url.origin, 'https://media.candidfan.com');
  assert.equal(url.pathname, '/download/123e4567-e89b-42d3-a456-426614174002');
  assert.equal(url.searchParams.get('expires'), '1790254800');
  assert.match(url.searchParams.get('sig') || '', /^[0-9a-f-]+\.\d+\.\d+$/);
  assert.equal(result.sizeBytes, 123_456);
  assert.equal(result.contentType, 'video/mp4');
  assert.equal(result.expiresAt, '2026-09-24T13:00:00.000Z');
  assert.equal('title' in result, false);
  assert.equal('storageKey' in result, false);
  assert.equal('walkingpovUserId' in result, false);
});

test('authorization requires an exact verified identity link and current legacy premium', async () => {
  await assert.rejects(
    resolveAuthorizedWalkingPOVVideo({
      ...input,
      store: store({
        readIdentityLink: async () => ({ instantvidgrabUserId: 'another-user', state: 'verified' }),
      }),
    }),
    (error: unknown) => error instanceof VideoResolutionError && error.status === 409,
  );
  await assert.rejects(
    resolveAuthorizedWalkingPOVVideo({
      ...input,
      store: store({ readUser: async () => ({ membershipStatus: 'free', isAdmin: false }) }),
    }),
    (error: unknown) => error instanceof VideoResolutionError && error.status === 403,
  );
});

test('linking a direct InstantVidGrab buyer does not confer CandidFan download access', async () => {
  let mediaRead = false;
  await assert.rejects(
    resolveAuthorizedWalkingPOVVideo({
      ...input,
      store: store({
        readUser: async () => ({ membershipStatus: 'free', isAdmin: false }),
        async readMediaAsset() {
          mediaRead = true;
          return {
            storageKey: '123e4567-e89b-42d3-a456-426614174002',
            contentType: 'video/mp4',
            sizeBytes: 123_456,
          };
        },
      }),
    }),
    (error: unknown) => error instanceof VideoResolutionError && error.status === 403,
  );
  assert.equal(mediaRead, false, 'authorization must fail before reading the protected asset');
});

test('an administrator can resolve a ready file without a premium membership flag', async () => {
  const result = await resolveAuthorizedWalkingPOVVideo({
    ...input,
    store: store({ readUser: async () => ({ membershipStatus: 'free', isAdmin: true }) }),
  });
  assert.equal(result.contentType, 'video/mp4');
});

test('rejects missing, non-MP4, empty, and malformed media assets', async () => {
  for (const media of [
    null,
    { storageKey: 'not-opaque', contentType: 'video/mp4', sizeBytes: 10 },
    { storageKey: '123e4567-e89b-42d3-a456-426614174002', contentType: 'text/html', sizeBytes: 10 },
    { storageKey: '123e4567-e89b-42d3-a456-426614174002', contentType: 'video/mp4', sizeBytes: 0 },
  ]) {
    await assert.rejects(
      resolveAuthorizedWalkingPOVVideo({
        ...input,
        store: store({ readMediaAsset: async () => media }),
      }),
      (error: unknown) => error instanceof VideoResolutionError && error.status === 404,
    );
  }
});

test('rejects a non-allowlisted media origin', async () => {
  await assert.rejects(
    resolveAuthorizedWalkingPOVVideo({ ...input, mediaOrigin: 'https://attacker.example', store: store() }),
    (error: unknown) => error instanceof VideoResolutionError && error.status === 503,
  );
});
