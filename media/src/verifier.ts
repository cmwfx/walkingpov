import crypto from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { stat } from 'node:fs/promises';
import path from 'node:path';

const port = Number(process.env.PORT || 3100);
const mediaRoot = path.resolve(process.env.MEDIA_ROOT || '/srv/candidfan/media');
const signingSecret = process.env.MEDIA_SIGNING_SECRET || '';
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

if (!signingSecret) throw new Error('MEDIA_SIGNING_SECRET is required');

function signatureFor(key: string, expires: number) {
  return crypto.createHmac('sha256', signingSecret).update(`${key}.${expires}`).digest('hex');
}

export function verifyRequest(key: string, expiresText: string, provided: string, now = Math.floor(Date.now() / 1000)) {
  if (!uuidPattern.test(key) || !/^\d{10}$/.test(expiresText) || !/^[0-9a-f]{64}$/i.test(provided)) return false;
  const expires = Number(expiresText);
  if (!Number.isSafeInteger(expires) || expires < now || expires > now + 16 * 60) return false;
  const expected = signatureFor(key, expires);
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(provided, 'hex'));
}

function send(res: ServerResponse, status: number, body = '') {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

async function handle(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405);
  let requestUrl: URL;
  try {
    requestUrl = new URL(req.url || '/', 'http://127.0.0.1');
  } catch {
    return send(res, 400);
  }
  const match = requestUrl.pathname.match(/^\/verify\/([^/]+)$/);
  if (!match) return send(res, 404);
  let key: string;
  try {
    key = decodeURIComponent(match[1]);
  } catch {
    return send(res, 404);
  }
  const expires = requestUrl.searchParams.get('expires') || '';
  const signature = requestUrl.searchParams.get('sig') || '';
  if (!verifyRequest(key, expires, signature)) return send(res, 403);

  const mediaPath = path.join(mediaRoot, `${key}.mp4`);
  try {
    const details = await stat(mediaPath);
    if (!details.isFile()) return send(res, 404);
    res.writeHead(200, {
      'Content-Type': 'video/mp4',
      'Content-Length': String(details.size),
      'Content-Disposition': `attachment; filename="download-${key}.mp4"`,
      'Cache-Control': 'private, no-store',
      'Accept-Ranges': 'bytes',
      'X-Accel-Redirect': `/__candidfan_media/${key}.mp4`,
    });
    if (req.method === 'HEAD') return res.end();
    return res.end();
  } catch {
    return send(res, 404);
  }
}

const server = createServer((req, res) => {
  void handle(req, res).catch(() => send(res, 500));
});
server.keepAliveTimeout = 5_000;
server.headersTimeout = 10_000;
server.listen(port, '127.0.0.1', () => console.log('candidfan-media-verifier-ready'));
