import crypto from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const maxThumbnailBytes = 12 * 1024 * 1024;
const MAX_MEDIA_LINK_VALIDITY_SECONDS = 60 * 60;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const defaultCorsOrigins = [
  'https://candidfan.com',
  'https://www.candidfan.com',
];

function signatureFor(key: string, expires: number, signingSecret: string) {
  return crypto.createHmac('sha256', signingSecret).update(`${key}.${expires}`).digest('hex');
}

export function verifyRequest(
  key: string,
  expiresText: string,
  provided: string,
  now = Math.floor(Date.now() / 1000),
  signingSecret = process.env.MEDIA_SIGNING_SECRET || '',
) {
  if (!signingSecret || !uuidPattern.test(key) || !/^\d{10}$/.test(expiresText) || !/^[0-9a-f]{64}$/i.test(provided)) return false;
  const expires = Number(expiresText);
  if (!Number.isSafeInteger(expires) || expires < now || expires > now + MAX_MEDIA_LINK_VALIDITY_SECONDS) return false;
  const expected = signatureFor(key, expires, signingSecret);
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(provided, 'hex'));
}

function send(res: ServerResponse, status: number, body = '', headers: Record<string, string> = {}) {
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
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

export type MediaHandlerOptions = {
  mediaRoot?: string;
  thumbnailRoot?: string;
  signingSecret: string;
  allowedOrigins?: readonly string[];
  now?: () => number;
};

type ConfiguredMediaOptions = {
  mediaRoot: string;
  thumbnailRoot: string;
  signingSecret: string;
  allowedOrigins: Set<string>;
  now: () => number;
};

function normalizeCorsOrigins(origins: readonly string[]) {
  const allowed = new Set<string>();
  for (const value of origins) {
    try {
      const url = new URL(value);
      if (
        url.origin === value &&
        !url.username &&
        !url.password &&
        (url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))
      ) {
        allowed.add(url.origin);
      }
    } catch {
      // Ignore malformed configuration entries; never reflect an unvalidated Origin.
    }
  }
  return allowed;
}

async function handle(req: IncomingMessage, res: ServerResponse, options: ConfiguredMediaOptions) {
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
    if (!verifyRequest(key, expires, signature, options.now(), options.signingSecret)) return send(res, 403);
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

    const thumbnailPath = path.join(options.thumbnailRoot, `${key}.jpg`);
    const temporaryPath = path.join(options.thumbnailRoot, `.${key}.${process.pid}.part`);
    try {
      await writeFile(temporaryPath, body, { flag: 'wx', mode: 0o640 });
      await rename(temporaryPath, thumbnailPath);
      return send(res, 201);
    } catch {
      return send(res, 500);
    }
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
  if (!verifyRequest(key, expires, signature, options.now(), options.signingSecret)) return send(res, 403);

  if (req.method === 'OPTIONS') {
    const origin = String(req.headers.origin || '');
    const requestedMethod = String(req.headers['access-control-request-method'] || '').toUpperCase();
    const requestedHeaders = String(req.headers['access-control-request-headers'] || '')
      .split(',')
      .map((header) => header.trim().toLowerCase())
      .filter(Boolean);
    if (
      !options.allowedOrigins.has(origin) ||
      !['GET', 'HEAD'].includes(requestedMethod) ||
      requestedHeaders.some((header) => !['range', 'if-range'].includes(header))
    ) {
      return send(res, 403, '', { Vary: 'Origin' });
    }
    return send(res, 204, '', {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, If-Range',
      'Access-Control-Max-Age': '600',
      Vary: 'Origin',
    });
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405);

  const mediaPath = path.join(options.mediaRoot, `${key}.mp4`);
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

export function createMediaHandler(input: MediaHandlerOptions) {
  if (!input.signingSecret) throw new Error('MEDIA_SIGNING_SECRET is required');
  const options = {
    mediaRoot: path.resolve(input.mediaRoot || '/srv/candidfan/media'),
    thumbnailRoot: path.resolve(input.thumbnailRoot || '/srv/candidfan/thumbnails'),
    signingSecret: input.signingSecret,
    allowedOrigins: normalizeCorsOrigins(input.allowedOrigins || defaultCorsOrigins),
    now: input.now || (() => Math.floor(Date.now() / 1000)),
  };
  return (req: IncomingMessage, res: ServerResponse) => {
    void handle(req, res, options).catch(() => send(res, 500));
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const server = createServer(
    createMediaHandler({
      mediaRoot: process.env.MEDIA_ROOT,
      thumbnailRoot: process.env.THUMBNAIL_ROOT,
      signingSecret: process.env.MEDIA_SIGNING_SECRET || '',
      allowedOrigins: (process.env.CORS_ORIGINS || defaultCorsOrigins.join(','))
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    }),
  );
  server.keepAliveTimeout = 5_000;
  server.headersTimeout = 10_000;
  server.listen(Number(process.env.PORT || 3100), '127.0.0.1', () => console.log('candidfan-media-verifier-ready'));
}
