import crypto from 'node:crypto';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_MEDIA_LINK_VALIDITY_SECONDS = 60 * 60;

export function signMediaKey(key: string, expires: number, secret: string) {
  return crypto.createHmac('sha256', secret).update(`${key}.${expires}`).digest('hex');
}

export function verifyMediaSignature(key: string, expiresText: string, provided: string, secret: string, now = Math.floor(Date.now() / 1000)) {
  if (!uuidPattern.test(key) || !/^\d{10}$/.test(expiresText) || !/^[0-9a-f]{64}$/i.test(provided)) return false;
  const expires = Number(expiresText);
  if (expires < now || expires > now + MAX_MEDIA_LINK_VALIDITY_SECONDS) return false;
  const expected = signMediaKey(key, expires, secret);
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(provided, 'hex'));
}
