import rateLimit from 'express-rate-limit';

const makeLimiter = (windowMs: number, max: number, message: string) => rateLimit({
  windowMs, max, message: { error: message }, standardHeaders: true, legacyHeaders: false,
  skip: (req) => req.path.startsWith('/worker'),
});

export const apiLimiter = makeLimiter(15 * 60 * 1000, 240, 'Too many requests. Please try again later.');
export const authLimiter = makeLimiter(15 * 60 * 1000, 10, 'Too many authentication attempts. Please try again later.');
export const paymentLimiter = makeLimiter(60 * 60 * 1000, 3, 'Too many payment submissions. Please try again later.');
export const supportLimiter = makeLimiter(15 * 60 * 1000, 30, 'Too many support requests. Please try again later.');
