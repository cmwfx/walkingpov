import assert from 'node:assert/strict';
import { test } from 'node:test';
import { verifyMediaSignature, signMediaKey } from '../services/mediaSignature.js';

test('media signatures accept a valid opaque key and reject tampering, expiry, and traversal', () => {
  const key = '11111111-1111-4111-8111-111111111111';
  const now = 1_800_000_000;
  const expires = now + 900;
  const secret = 'test-media-signing-secret';
  const signature = signMediaKey(key, expires, secret);
  assert.equal(verifyMediaSignature(key, String(expires), signature, secret, now), true);
  assert.equal(verifyMediaSignature(key, String(expires), `${signature.slice(0, -1)}0`, secret, now), false);
  assert.equal(verifyMediaSignature(key, String(now - 1), signMediaKey(key, now - 1, secret), secret, now), false);
  assert.equal(verifyMediaSignature('../source.mp4', String(expires), signature, secret, now), false);
});

test('payment proof encryption authenticates and refuses modified ciphertext', async () => {
  process.env.ENCRYPTION_KEY = '00'.repeat(32);
  const { encrypt, decrypt, isEncrypted } = await import('../services/encryption.js');
  const encrypted = encrypt('synthetic-gift-card-proof');
  assert.equal(isEncrypted(encrypted), true);
  assert.equal(decrypt(encrypted), 'synthetic-gift-card-proof');
  const parts = encrypted.split(':');
  parts[2] = `${parts[2]}00`;
  assert.throws(() => decrypt(parts.join(':')));
});
