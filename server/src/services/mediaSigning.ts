import crypto from 'node:crypto';

const secret = process.env.MEDIA_SIGNING_SECRET;
if (!secret || secret.length < 32) {
  throw new Error('MEDIA_SIGNING_SECRET must be at least 32 characters');
}

export function createSignedMediaUrl(assetKey: string, _durationSeconds: number): { url: string; expiresAt: string } {
  const expires = Math.floor(Date.now() / 1000) + 30 * 60;
  const path = '/media/full/' + assetKey.replace(/^\/+/, '');
  const digest = crypto.createHash('md5').update(expires + path + ' ' + secret).digest('base64url');
  const base = (process.env.MEDIA_PUBLIC_URL || 'https://media.candidfan.com').replace(/\/$/, '');
  return { url: base + path + '?expires=' + expires + '&md5=' + encodeURIComponent(digest), expiresAt: new Date(expires * 1000).toISOString() };
}

