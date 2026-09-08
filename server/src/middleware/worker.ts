import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export function requireWorker(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.WORKER_TOKEN || '';
  const supplied = req.headers['x-worker-token'];
  if (!expected || typeof supplied !== 'string') return res.status(401).json({ error: 'Worker authentication required' });
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(401).json({ error: 'Invalid worker credential' });
  next();
}

