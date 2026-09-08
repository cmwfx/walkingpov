import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const COOKIE = 'cf_csrf';

export function generateCsrfToken(req: Request, res: Response, next: NextFunction) {
  const token = crypto.randomBytes(32).toString('hex');
  res.cookie(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000,
  });
  (req as Request & { csrfToken?: () => string }).csrfToken = () => token;
  next();
}

export function verifyCsrfToken(req: Request, res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method) || req.path.startsWith('/worker')) return next();
  const cookie = req.cookies?.[COOKIE];
  const header = req.headers['x-csrf-token'];
  if (!cookie || typeof header !== 'string' || cookie !== header) return res.status(403).json({ error: 'Invalid CSRF token' });
  next();
}

