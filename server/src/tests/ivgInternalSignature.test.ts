import assert from 'node:assert/strict';
import { test } from 'node:test';
import { signInternalRequest, verifyInternalRequest } from '../services/ivgInternalSignature.js';
import { createAuthorizationCode, createVerifierChallenge, deriveWalkingPOVAccessSnapshot, digestAuthorizationValue, instantVidGrabAuthorizationSchema } from '../services/instantvidgrabHandoff.js';

const secret = 'synthetic-integration-secret-32bytes';
const signedRequest = (overrides: Partial<Parameters<typeof signInternalRequest>[0]> = {}) => {
  const request = {
    keyId: 'ivg-test-key-v1',
    method: 'POST',
    path: '/api/internal/entitlements',
    timestamp: '1800000000',
    nonce: 'syntheticNonce0123456789ABCDE',
    body: Buffer.from('{"eventId":"synthetic-event-1"}', 'utf8'),
    ...overrides,
  };
  return {
    ...request,
    signature: signInternalRequest(request, secret),
  };
};

test('internal HMAC accepts only the signed method, path, timestamp, nonce, and exact body bytes', () => {
  const request = signedRequest();
  assert.deepEqual(
    verifyInternalRequest(request, [{ id: request.keyId, secret }], 1_800_000_000),
    { ok: true, keyId: request.keyId, nonce: request.nonce, timestamp: 1_800_000_000 },
  );

  assert.equal(verifyInternalRequest({ ...request, path: '/api/internal/other' }, [{ id: request.keyId, secret }], 1_800_000_000).ok, false);
  assert.equal(verifyInternalRequest({ ...request, method: 'PUT' }, [{ id: request.keyId, secret }], 1_800_000_000).ok, false);
  assert.equal(verifyInternalRequest({ ...request, body: Buffer.from('{"eventId":"changed"}', 'utf8') }, [{ id: request.keyId, secret }], 1_800_000_000).ok, false);
});

test('internal HMAC rejects stale timestamps, unknown keys, malformed nonces, and short secrets', () => {
  const request = signedRequest();
  assert.deepEqual(verifyInternalRequest(request, [{ id: request.keyId, secret }], 1_800_000_301), { ok: false, reason: 'stale' });
  assert.deepEqual(verifyInternalRequest(request, [{ id: 'another-key', secret }], 1_800_000_000), { ok: false, reason: 'unknown_key' });
  assert.equal(verifyInternalRequest({ ...request, nonce: 'short' }, [{ id: request.keyId, secret }], 1_800_000_000).ok, false);
  assert.equal(verifyInternalRequest(request, [{ id: request.keyId, secret: 'short' }], 1_800_000_000).ok, false);
});

test('key identifiers are covered by the HMAC and prevent cross-key replay', () => {
  const request = signedRequest();
  assert.equal(verifyInternalRequest({ ...request, keyId: 'replacement-key' }, [{ id: 'replacement-key', secret }], 1_800_000_000).ok, false);
});

test('handoff codes are high entropy, hashed for storage, and PKCE-bound', () => {
  const code = createAuthorizationCode();
  const verifier = 'synthetic-verifier-that-is-long-enough-for-pkce-0123456789';
  assert.match(code, /^[A-Za-z0-9_-]{43}$/);
  assert.match(digestAuthorizationValue(code), /^\\x[0-9a-f]{64}$/);
  assert.match(createVerifierChallenge(verifier), /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(createVerifierChallenge(verifier), createVerifierChallenge(`${verifier}x`));
});

test('authorization request validation allows only fixed intents and requires a video for download', () => {
  const state = 'S'.repeat(43);
  const challenge = 'C'.repeat(43);
  assert.equal(instantVidGrabAuthorizationSchema.safeParse({ state, challenge, intent: 'checkout' }).success, true);
  assert.equal(instantVidGrabAuthorizationSchema.safeParse({ state, challenge, intent: 'download' }).success, false);
  assert.equal(instantVidGrabAuthorizationSchema.safeParse({ state, challenge, intent: 'other' }).success, false);
  assert.equal(instantVidGrabAuthorizationSchema.safeParse({ state, challenge, intent: 'connect', callback: 'https://attacker.invalid' }).success, false);
});

test('legacy complimentary access derives only from active WalkingPOV product grants', () => {
  assert.deepEqual(deriveWalkingPOVAccessSnapshot([
    { product: 'walkingpov', state: 'active', version: 2 },
    { product: 'walkingpov', state: 'revoked', version: '3' },
    { product: 'instantvidgrab', state: 'active', version: 99 },
  ]), { legacyPremium: true, legacyGrantVersion: 5 });

  assert.deepEqual(deriveWalkingPOVAccessSnapshot([
    { product: 'walkingpov', state: 'revoked', version: 2 },
    { product: 'instantvidgrab', state: 'active', version: 99 },
  ]), { legacyPremium: false, legacyGrantVersion: 2 });

  assert.equal(deriveWalkingPOVAccessSnapshot([]).legacyPremium, false);
  assert.throws(() => deriveWalkingPOVAccessSnapshot([
    { product: 'walkingpov', state: 'active', version: 0 },
  ]));
  assert.throws(() => deriveWalkingPOVAccessSnapshot([
    { product: 'walkingpov', state: 'active', version: 2147483648 },
  ]));
});
