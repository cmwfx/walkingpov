import crypto from 'node:crypto';

const keyText = process.env.ENCRYPTION_KEY || '';
if (!/^[0-9a-fA-F]{64}$/.test(keyText)) {
  throw new Error('ENCRYPTION_KEY must be 32 bytes encoded as hex');
}
const key = Buffer.from(keyText, 'hex');
const algorithm = 'aes-256-gcm';

export function encrypt(plainText: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${ciphertext.toString('hex')}`;
}

export function decrypt(value: string): string {
  const parts = value.split(':');
  if (parts.length !== 3 || !/^[0-9a-f]{24}$/i.test(parts[0]) || !/^[0-9a-f]{32}$/i.test(parts[1])) {
    throw new Error('encrypted_value_invalid');
  }
  try {
    const decipher = crypto.createDecipheriv(algorithm, key, Buffer.from(parts[0], 'hex'));
    decipher.setAuthTag(Buffer.from(parts[1], 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(parts[2], 'hex')), decipher.final()]).toString('utf8');
  } catch {
    throw new Error('encrypted_value_invalid');
  }
}

export function isEncrypted(value: string): boolean {
  return /^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/i.test(value);
}
