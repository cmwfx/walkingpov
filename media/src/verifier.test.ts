import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import { createMediaHandler } from './verifier.js';

const signingSecret = 'synthetic-media-signing-secret-0123456789abcdef';
const now = 1_800_000_000;
const videoId = '123e4567-e89b-42d3-a456-426614174000';
const expires = String(now + 300);
const origin = 'https://candidfan.com';
let root = '';
let baseUrl = '';
let server: ReturnType<typeof createServer>;

function signedUrl() {
  const signature = createHmac('sha256', signingSecret)
    .update(`${videoId}.${expires}`)
    .digest('hex');
  return `${baseUrl}/verify/${videoId}?expires=${expires}&sig=${signature}`;
}

before(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'candidfan-media-test-'));
  const mediaRoot = path.join(root, 'media');
  const thumbnailRoot = path.join(root, 'thumbnails');
  await mkdir(mediaRoot);
  await mkdir(thumbnailRoot);
  await writeFile(path.join(mediaRoot, `${videoId}.mp4`), Buffer.from([1, 2, 3]));
  server = createServer(
    createMediaHandler({
      mediaRoot,
      thumbnailRoot,
      signingSecret,
      allowedOrigins: [origin],
      now: () => now,
    }),
  );
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  if (root) await rm(root, { recursive: true, force: true });
});

describe('signed media access and CORS preflight', () => {
  it('allows only a valid signed range preflight from an exact configured origin', async () => {
    const response = await fetch(signedUrl(), {
      method: 'OPTIONS',
      headers: {
        Origin: origin,
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'range, if-range',
      },
    });
    assert.equal(response.status, 204);
    assert.equal(response.headers.get('access-control-allow-origin'), origin);
    assert.equal(response.headers.get('access-control-allow-methods'), 'GET, HEAD, OPTIONS');
    assert.equal(response.headers.get('access-control-allow-headers'), 'Range, If-Range');
    assert.equal(response.headers.get('vary'), 'Origin');
  });

  it('rejects unconfigured origins, unsafe requested headers, and invalid signatures', async () => {
    const deniedOrigin = await fetch(signedUrl(), {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://attacker.example',
        'Access-Control-Request-Method': 'GET',
      },
    });
    assert.equal(deniedOrigin.status, 403);
    assert.equal(deniedOrigin.headers.get('access-control-allow-origin'), null);

    const retiredInstantVidGrabOrigin = await fetch(signedUrl(), {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://instantvidgrab.online',
        'Access-Control-Request-Method': 'GET',
      },
    });
    assert.equal(retiredInstantVidGrabOrigin.status, 403);
    assert.equal(retiredInstantVidGrabOrigin.headers.get('access-control-allow-origin'), null);

    const deniedHeader = await fetch(signedUrl(), {
      method: 'OPTIONS',
      headers: {
        Origin: origin,
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'authorization',
      },
    });
    assert.equal(deniedHeader.status, 403);

    const invalidSignature = await fetch(signedUrl().replace(/sig=[^&]+/, 'sig=0'.repeat(64)), {
      method: 'OPTIONS',
      headers: {
        Origin: origin,
        'Access-Control-Request-Method': 'GET',
      },
    });
    assert.equal(invalidSignature.status, 403);
  });

  it('verifies authorization before returning private media metadata', async () => {
    const response = await fetch(signedUrl(), { method: 'HEAD', headers: { Origin: origin } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'video/mp4');
    assert.equal(response.headers.get('content-length'), '3');
    assert.equal(response.headers.get('accept-ranges'), 'bytes');
    assert.equal(response.headers.get('x-accel-redirect'), `/__candidfan_media/${videoId}.mp4`);
  });
});
