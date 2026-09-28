import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { signMediaKey, signPreviewKey } from '../services/mediaSignature.js';

const key = '123e4567-e89b-42d3-a456-426614174000';
const expires = 1_800_000_300;
const secret = 'synthetic-media-signing-secret';

test('download signatures retain the existing wire format', () => {
  const expected = createHmac('sha256', secret).update(`${key}.${expires}`).digest('hex');
  assert.equal(signMediaKey(key, expires, secret), expected);
});

test('preview signatures are purpose-bound and differ from download signatures', () => {
  const expected = createHmac('sha256', secret).update(`preview.${key}.${expires}`).digest('hex');
  assert.equal(signPreviewKey(key, expires, secret), expected);
  assert.notEqual(signPreviewKey(key, expires, secret), signMediaKey(key, expires, secret));
});
