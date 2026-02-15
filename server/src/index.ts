import express from 'express';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { apiLimiter } from './middleware/rateLimiter.js';
import { generateCsrfToken, verifyCsrfToken } from './middleware/csrf.js';
import uploadRoutes from './routes/upload.js';
import videoRoutes from './routes/videos.js';
import bulkUploadRoutes from './routes/bulk-upload.js';
import paymentRoutes from './routes/payments.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Security headers with helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  frameguard: {
    action: 'deny',
  },
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin',
  },
}));

// Middleware
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true
}));

// Enable GZIP/Brotli compression
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6
}));

// Trust proxy (Nginx) for correct protocol/IP
app.set('trust proxy', 1);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Apply rate limiting to all API routes
app.use('/api', apiLimiter);

// Endpoint to get CSRF token
app.get('/api/csrf-token', generateCsrfToken, (req, res) => {
  res.json({ csrfToken: (req as any).csrfToken() });
});

// Apply CSRF protection to all state-changing API routes
app.use('/api', verifyCsrfToken);

// Serve uploaded files statically with caching
const uploadDir = process.env.UPLOAD_DIR || './uploads';
app.use('/uploads', express.static(path.resolve(uploadDir), {
  maxAge: '1y', // Cache for 1 year
  immutable: true,
  setHeaders: (res, filePath) => {
    // Set cache control headers
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.set('Vary', 'Accept-Encoding');
  }
}));

// Routes
app.use('/api/upload', uploadRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/bulk-upload', bulkUploadRoutes);
app.use('/api/payments', paymentRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Log full error details server-side
  console.error('Server error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString(),
  });

  // In production, return generic error messages to prevent information disclosure
  const isProduction = process.env.NODE_ENV === 'production';

  res.status(err.status || 500).json({
    error: isProduction
      ? 'An error occurred. Please try again later.'
      : err.message || 'Internal server error',
    ...(isProduction ? {} : { stack: err.stack }), // Include stack trace only in development
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📁 Upload directory: ${path.resolve(uploadDir)}`);
  console.log(`🌐 CORS enabled for: ${FRONTEND_URL}`);
});
