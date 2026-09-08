import 'dotenv/config';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import path from 'node:path';
import { apiLimiter, readApiLimiter } from './middleware/rateLimiter.js';
import { generateCsrfToken, verifyCsrfToken } from './middleware/csrf.js';
import { AuthRequest, verifyToken } from './middleware/auth.js';
import videos from './routes/videos.js';
import payments from './routes/payments.js';
import support from './routes/support.js';
import imports from './routes/imports.js';
import admin from './routes/admin.js';
import { supabaseAdmin } from './config/supabase.js';

const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
const importerToken = process.env.IMPORTER_TOKEN || '';

function isInternalImporterRequest(req: Request) {
  return req.path.startsWith('/import/') && importerToken && req.headers.authorization === `Bearer ${importerToken}`;
}

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https://media.candidfan.com'],
        connectSrc: ["'self'", 'https://ghredjydntjlfykgrqqq.supabase.co'],
        mediaSrc: ["'none'"],
      },
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    frameguard: { action: 'deny' },
    hsts: process.env.NODE_ENV === 'production' ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
  }));
  app.use(cors({ origin: frontendUrl, credentials: true, methods: ['GET', 'HEAD', 'POST', 'PATCH'] }));
  app.use(compression());
  app.use(express.json({ limit: '64kb' }));
  app.use(cookieParser());

  app.get(['/health', '/api/health'], async (_req, res) => {
    const { error } = await supabaseAdmin.from('videos').select('id', { head: true, count: 'exact' }).eq('status', 'ready');
    if (error) return res.status(503).json({ status: 'degraded' });
    return res.json({ status: 'ok' });
  });

  app.use('/api', (req, res, next) => {
    if (isInternalImporterRequest(req)) return next();
    if (req.method === 'GET' && (req.path === '/videos' || req.path.startsWith('/videos/'))) return next();
    return ['GET', 'HEAD'].includes(req.method) ? readApiLimiter(req, res, next) : apiLimiter(req, res, next);
  });
  app.get('/api/csrf-token', generateCsrfToken, (req, res) => {
    const token = (req as Request & { csrfToken?: () => string }).csrfToken?.();
    return res.json({ csrfToken: token });
  });
  app.use('/api', verifyCsrfToken);

  app.get('/api/me', verifyToken, (req: AuthRequest, res) => res.json({ user: req.user }));
  app.use('/api/videos', videos);
  app.use('/api/payments', payments);
  app.use('/api/support', support);
  app.use('/api/import', imports);
  app.use('/api/admin', admin);

  app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    void error;
    void _next;
    console.error('request-failed');
    return res.status(500).json({ error: 'Unable to complete request' });
  });
  return app;
}

const isMain = process.argv[1] && path.basename(process.argv[1]) === 'index.js';
if (isMain) {
  const port = Number(process.env.PORT || 3001);
  const app = createApp();
  app.listen(port, '127.0.0.1', () => console.log('candidfan-api-ready'));
}
