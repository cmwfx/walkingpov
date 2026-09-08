import assert from 'node:assert/strict';
import test from 'node:test';

process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.MEDIA_SIGNING_SECRET = 'test-media-secret-0123456789012345';

const { encrypt, decrypt } = await import('../dist/services/encryption.js');
const { createSignedMediaUrl } = await import('../dist/services/mediaSigning.js');

test('payment proof encryption round-trips without exposing plaintext', () => {
  const plaintext = 'gift-card-proof-reference';
  const ciphertext = encrypt(plaintext);
  assert.notEqual(ciphertext, plaintext);
  assert.equal(decrypt(ciphertext), plaintext);
});

test('media signatures are generated for the requested media path', () => {
  const signed = createSignedMediaUrl('video-id/output.mp4', 120);
  assert.match(signed.url, /\/media\/full\/video-id\/output\.mp4\?/);
  assert.ok(Date.parse(signed.expiresAt) > Date.now());
});
