import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { apiLimiter } from './middleware/rateLimiter.js';
import { generateCsrfToken, verifyCsrfToken } from './middleware/csrf.js';
import { verifyToken, requireAdmin, type AuthRequest } from './middleware/auth.js';
import { supabaseAdmin } from './config/supabase.js';
import videos from './routes/videos.js';
import payments from './routes/payments.js';
import support from './routes/support.js';
import imports from './routes/imports.js';

const app = express();
const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || '127.0.0.1';
const frontendUrl = (process.env.FRONTEND_URL || 'https://candidfan.com').replace(/\/$/, '');
const supabaseUrl = process.env.SUPABASE_URL || '';
const mediaUrl = (process.env.MEDIA_PUBLIC_URL || 'https://media.candidfan.com').replace(/\/$/, '');

app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'none'"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', mediaUrl],
      mediaSrc: ["'self'", mediaUrl],
      connectSrc: ["'self'", supabaseUrl, mediaUrl],
      fontSrc: ["'self'", 'data:'],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));
app.use(cors({ origin: frontendUrl, credentials: true }));
app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false, limit: '2mb' }));
app.use(cookieParser());

app.get('/api/csrf-token', generateCsrfToken, (req, res) => res.json({ csrfToken: (req as RequestWithCsrf).csrfToken?.() || '' }));
app.use('/api', apiLimiter);
app.use('/api', verifyCsrfToken);

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'candidfan-api', timestamp: new Date().toISOString() }));
app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'candidfan-api', timestamp: new Date().toISOString() }));
app.get('/api/me', verifyToken, (req: AuthRequest, res) => res.json({ user: req.user }));
app.get('/api/admin/stats', verifyToken, requireAdmin, async (_req: AuthRequest, res) => {
  try {
    const [videosResult, usersResult, paymentsResult, ticketsResult, jobsResult] = await Promise.all([
      supabaseAdmin.from('videos').select('id', { count: 'exact', head: true }).eq('status', 'published'),
      supabaseAdmin.from('users').select('id', { count: 'exact', head: true }),
      supabaseAdmin.from('payment_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabaseAdmin.from('support_tickets').select('id', { count: 'exact', head: true }).eq('status', 'open'),
      supabaseAdmin.from('import_jobs').select('id,status,discovered_count,processing_count,published_count,duplicate_count,failed_count').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    res.json({ published_videos: videosResult.count || 0, users: usersResult.count || 0, pending_payments: paymentsResult.count || 0, open_tickets: ticketsResult.count || 0, import_job: jobsResult.data || null });
  } catch (error) {
    console.error('admin stats failed', error);
    res.status(500).json({ error: 'Unable to load admin stats' });
  }
});

app.use('/api/videos', videos);
app.use('/api/payments', payments);
app.use('/api/support', support);
app.use('/api', imports);

app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('unhandled API error', error);
  res.status(500).json({ error: 'Internal server error' });
});

interface RequestWithCsrf extends express.Request { csrfToken?: () => string }

app.listen(port, host, () => {
  console.log('CandidFan API listening on ' + host + ':' + port);
});
