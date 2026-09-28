import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export type InternalHmacKey = { id: string; secret: string };

export type InternalSignedRequest = {
  keyId: string;
  method: string;
  path: string;
  timestamp: string;
  nonce: string;
  signature: string;
  body: Uint8Array;
};

export type InternalVerification =
  | { ok: true; keyId: string; nonce: string; timestamp: number }
  | { ok: false; reason: 'invalid' | 'stale' | 'unknown_key' };

export function canonicalInternalRequest(input: Pick<InternalSignedRequest, 'keyId' | 'method' | 'path' | 'timestamp' | 'nonce' | 'body'>) {
  const bodyHash = createHash('sha256').update(input.body).digest('hex');
  return [
    'IVG1',
    input.keyId,
    input.method.toUpperCase(),
    input.path,
    input.timestamp,
    input.nonce,
    bodyHash,
  ].join('\n');
}

export function signInternalRequest(input: Omit<InternalSignedRequest, 'signature'>, secret: string) {
  return createHmac('sha256', secret).update(canonicalInternalRequest(input)).digest('hex');
}

export function verifyInternalRequest(
  input: InternalSignedRequest,
  keys: InternalHmacKey[],
  nowSeconds = Math.floor(Date.now() / 1_000),
  maxSkewSeconds = 300,
): InternalVerification {
  if (!/^[a-z0-9_-]{1,64}$/i.test(input.keyId)
    || !/^[A-Z]+$/i.test(input.method)
    || !input.path.startsWith('/')
    || input.path.startsWith('//')
    || /[\r\n]/.test(input.path)
    || !/^[0-9]{1,12}$/.test(input.timestamp)
    || !/^[A-Za-z0-9_-]{24,96}$/.test(input.nonce)
    || !/^[0-9a-f]{64}$/i.test(input.signature)) {
    return { ok: false, reason: 'invalid' };
  }

  const timestamp = Number(input.timestamp);
  if (!Number.isSafeInteger(timestamp) || Math.abs(nowSeconds - timestamp) > maxSkewSeconds) {
    return { ok: false, reason: 'stale' };
  }
  const key = keys.find((candidate) => candidate.id === input.keyId);
  if (!key || Buffer.byteLength(key.secret, 'utf8') < 32) return { ok: false, reason: 'unknown_key' };

  const expected = Buffer.from(signInternalRequest(input, key.secret), 'hex');
  const received = Buffer.from(input.signature, 'hex');
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return { ok: false, reason: 'invalid' };
  }
  return { ok: true, keyId: key.id, nonce: input.nonce, timestamp };
}
