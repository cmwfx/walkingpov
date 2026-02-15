import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const CSRF_TOKEN_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';

/**
 * Custom CSRF protection using double-submit cookie pattern
 * More secure and modern than deprecated csurf package
 */

/**
 * Generates a CSRF token and sets it as a cookie
 */
export function generateCsrfToken(req: Request, res: Response, next: NextFunction) {
  // Generate a random token
  const token = crypto.randomBytes(32).toString('hex');

  // Set as HTTP-only cookie
  res.cookie(CSRF_TOKEN_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  });

  // Also attach to request for immediate use
  (req as any).csrfToken = () => token;

  next();
}

/**
 * Validates CSRF token on state-changing requests (POST, PUT, PATCH, DELETE)
 */
export function verifyCsrfToken(req: Request, res: Response, next: NextFunction) {
  // Skip CSRF check for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Get token from cookie
  const cookieToken = req.cookies[CSRF_TOKEN_NAME];

  // Get token from header
  const headerToken = req.headers[CSRF_HEADER_NAME] as string;

  // Verify both exist and match
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({
      error: 'Invalid CSRF token. Please refresh the page and try again.',
    });
  }

  next();
}
