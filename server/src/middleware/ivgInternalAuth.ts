import type { NextFunction, Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { verifyInternalRequest, type InternalHmacKey } from '../services/ivgInternalSignature.js';

type RawBodyRequest = Request & { rawBody?: Buffer };

function readInboundKeys(): InternalHmacKey[] | null {
  const currentId = process.env.IVG_TO_WALKINGPOV_HMAC_CURRENT_KEY_ID || '';
  const currentSecret = process.env.IVG_TO_WALKINGPOV_HMAC_CURRENT_SECRET || '';
  const previousId = process.env.IVG_TO_WALKINGPOV_HMAC_PREVIOUS_KEY_ID || '';
  const previousSecret = process.env.IVG_TO_WALKINGPOV_HMAC_PREVIOUS_SECRET || '';
  if (!currentId || !currentSecret || (!!previousId !== !!previousSecret)) return null;
  const keys = [{ id: currentId, secret: currentSecret }];
  if (previousId && previousSecret) keys.push({ id: previousId, secret: previousSecret });
  if (keys.some((key) => !/^[a-z0-9_-]{1,64}$/i.test(key.id) || Buffer.byteLength(key.secret, 'utf8') < 32)) return null;
  if (new Set(keys.map((key) => key.id)).size !== keys.length) return null;
  return keys;
}

export async function requireIvgInternalAuth(req: Request, res: Response, next: NextFunction) {
  const keys = readInboundKeys();
  if (!keys) return res.status(503).json({ error: { code: 'integration_unavailable' } });

  const keyId = req.get('x-ivg-key-id') || '';
  const timestamp = req.get('x-ivg-timestamp') || '';
  const nonce = req.get('x-ivg-nonce') || '';
  const signature = req.get('x-ivg-signature') || '';
  const contentEncoding = req.get('content-encoding');
  const rawRequest = req as RawBodyRequest;
  const body = rawRequest.rawBody || Buffer.alloc(0);
  if ((contentEncoding && contentEncoding.toLowerCase() !== 'identity') || (!rawRequest.rawBody && Number(req.get('content-length') || 0) > 0)) {
    return res.status(401).json({ error: { code: 'invalid_internal_auth' } });
  }

  const verified = verifyInternalRequest({
    keyId,
    method: req.method,
    path: req.originalUrl,
    timestamp,
    nonce,
    signature,
    body,
  }, keys);
  if (!verified.ok) return res.status(401).json({ error: { code: 'invalid_internal_auth' } });

  const nowSeconds = Math.floor(Date.now() / 1_000);
  const expiresAt = new Date((Math.max(nowSeconds, verified.timestamp) + 360) * 1_000).toISOString();
  const { error } = await supabaseAdmin.from('ivg_internal_nonces').insert({
    key_id: verified.keyId,
    nonce: verified.nonce,
    expires_at: expiresAt,
  });
  if (error?.code === '23505') return res.status(401).json({ error: { code: 'replayed_internal_request' } });
  if (error) return res.status(503).json({ error: { code: 'integration_unavailable' } });

  return next();
}
