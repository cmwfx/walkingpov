import crypto from 'node:crypto';
import { NextFunction, Request, Response } from 'express';

const COOKIE = 'candidfan_csrf';
const HEADER = 'x-csrf-token';

export function generateCsrfToken(req: Request, res: Response, next: NextFunction) {
  const token = crypto.randomBytes(32).toString('hex');
  res.cookie(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000,
  });
  (req as Request & { csrfToken?: () => string }).csrfToken = () => token;
  return next();
}

export function verifyCsrfToken(req: Request, res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const cookieToken = req.cookies?.[COOKIE] as string | undefined;
  const headerToken = req.headers[HEADER] as string | undefined;
  if (!cookieToken || !headerToken || cookieToken.length !== headerToken.length ||
      !crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  return next();
}
