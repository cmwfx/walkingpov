import crypto from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const port = Number(process.env.PORT || 3100);
const mediaRoot = path.resolve(process.env.MEDIA_ROOT || '/srv/candidfan/media');
const signingSecret = process.env.MEDIA_SIGNING_SECRET || '';
const thumbnailRoot = path.resolve(process.env.THUMBNAIL_ROOT || '/srv/candidfan/thumbnails');
const maxThumbnailBytes = 12 * 1024 * 1024;
const MAX_MEDIA_LINK_VALIDITY_SECONDS = 60 * 60;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

if (!signingSecret) throw new Error('MEDIA_SIGNING_SECRET is required');

function signatureFor(key: string, expires: number) {
  return crypto.createHmac('sha256', signingSecret).update(`${key}.${expires}`).digest('hex');
}

export function verifyRequest(key: string, expiresText: string, provided: string, now = Math.floor(Date.now() / 1000)) {
  if (!uuidPattern.test(key) || !/^\d{10}$/.test(expiresText) || !/^[0-9a-f]{64}$/i.test(provided)) return false;
  const expires = Number(expiresText);
  if (!Number.isSafeInteger(expires) || expires < now || expires > now + MAX_MEDIA_LINK_VALIDITY_SECONDS) return false;
  const expected = signatureFor(key, expires);
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(provided, 'hex'));
}

function send(res: ServerResponse, status: number, body = '') {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

async function readBody(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const piece = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += piece.length;
    if (total > maxThumbnailBytes) throw new Error('body_too_large');
    chunks.push(piece);
  }
  return Buffer.concat(chunks);
}

async function handle(req: IncomingMessage, res: ServerResponse) {
  let requestUrl: URL;
  try {
    requestUrl = new URL(req.url || '/', 'http://127.0.0.1');
  } catch {
    return send(res, 400);
  }
  const uploadMatch = requestUrl.pathname.match(/^\/upload-thumbnail\/([^/]+)$/);
  if (uploadMatch) {
    if (req.method !== 'PUT') return send(res, 405);
    const key = decodeURIComponent(uploadMatch[1]);
    const expires = requestUrl.searchParams.get('expires') || '';
    const signature = requestUrl.searchParams.get('sig') || '';
    if (!verifyRequest(key, expires, signature)) return send(res, 403);
    const contentType = String(req.headers['content-type'] || '').split(';', 1)[0].toLowerCase();
    if (contentType !== 'image/jpeg') return send(res, 415);
    const contentLength = Number(req.headers['content-length'] || 0);
    if (!Number.isSafeInteger(contentLength) || contentLength <= 0 || contentLength > maxThumbnailBytes) return send(res, 413);

    let body: Buffer;
    try {
      body = await readBody(req);
    } catch (error) {
      return send(res, error instanceof Error && error.message === 'body_too_large' ? 413 : 400);
    }
    if (body.length !== contentLength) return send(res, 400);

    const thumbnailPath = path.join(thumbnailRoot, `${key}.jpg`);
    const temporaryPath = path.join(thumbnailRoot, `.${key}.${process.pid}.part`);
    try {
      await writeFile(temporaryPath, body, { flag: 'wx', mode: 0o640 });
      await rename(temporaryPath, thumbnailPath);
      return send(res, 201);
    } catch {
      return send(res, 500);
    }
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405);
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
