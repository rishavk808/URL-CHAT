import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { connectDB } from './config/db.js';
import ragRoutes from './routes/ragRoutes.js';
import { rehydrateVectorStoreFromDb } from './services/ragService.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';

// Fail fast on missing required configuration
const requiredEnvVars = ['GOOGLE_API_KEY'];
const missingEnvVars = requiredEnvVars.filter((key) => !process.env[key]);
if (missingEnvVars.length > 0) {
  console.error(`[Startup Error] Missing required environment variable(s): ${missingEnvVars.join(', ')}`);
  console.error('Set them in server/.env locally, or in the host dashboard in production.');
  process.exit(1);
}
if (!process.env.MONGO_URI) {
  console.warn('[Startup Warning] MONGO_URI is not set. The server will run in in-memory-only mode (data will not persist across restarts).');
}

const app = express();
const PORT = process.env.PORT || 5000;

app.disable('x-powered-by');
app.set('trust proxy', 1);

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: false, // Disabled to keep local dev/preview of the SPA simple
    crossOriginEmbedderPolicy: false
  })
);

// Compression
app.use(compression());

// CORS setup. CLIENT_URL may be a comma-separated list so the Vercel production
// domain and any custom/preview domains can all be allowed.
const clientUrls = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const allowedOrigins = Array.from(
  new Set([...clientUrls, 'http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:5000', 'http://127.0.0.1:5000'])
);
const isLocalhostOrigin = (origin) => /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow same-origin/non-browser requests (no Origin header) and whitelisted origins.
      // In development, also allow any localhost port since Vite auto-increments the
      // port when the default one is already taken by another local project.
      if (!origin || allowedOrigins.includes(origin) || (!isProduction && isLocalhostOrigin(origin))) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true
  })
);

// Body Parser Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logger middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Rate limiting for expensive AI/scraping endpoints
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down and try again shortly.' }
});
app.use('/api', apiLimiter);

// API Routes
app.use('/api', ragRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    environment: NODE_ENV,
    timestamp: new Date().toISOString(),
    service: 'URL RAG Chat Server'
  });
});

// Serve the built client as static assets in production (single-port deployment)
const clientDistPath = path.resolve(__dirname, '../../client/dist');
if (isProduction && fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path === '/health') return next();
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found.' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Error]:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

let server;

// Start Server and Connect Database
const startServer = async () => {
  try {
    await connectDB();

    server = app.listen(PORT, () => {
      console.log(`=================================================`);
      console.log(`🚀 RAG Backend Server running on port ${PORT} [${NODE_ENV}]`);
      console.log(`🌐 Allowed Client URL(s): ${allowedOrigins.join(', ')}`);
      if (isProduction) {
        console.log(
          fs.existsSync(clientDistPath)
            ? `📦 Serving production client build from ${clientDistPath}`
            : `⚠️  No client build found at ${clientDistPath}. Run "npm run build" in /client first.`
        );
      }
      console.log(`=================================================`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`[Startup Error] Port ${PORT} is already in use. Stop the other process or set a different PORT in .env.`);
      } else {
        console.error('[Server Error]:', err);
      }
      process.exit(1);
    });

    // Rehydrate vector store from existing documents in DB asynchronously
    rehydrateVectorStoreFromDb();
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
const shutdown = (signal) => {
  console.log(`\n[${signal}] Shutting down gracefully...`);
  if (server) {
    server.close(() => {
      console.log('HTTP server closed.');
      process.exit(0);
    });
    // Force-exit if close hangs
    setTimeout(() => process.exit(1), 10000).unref();
  } else {
    process.exit(0);
  }
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  console.error('[Unhandled Rejection]:', reason);
});
process.on('uncaughtException', (err) => {
  // Process state is no longer reliable after an uncaught exception — exit rather
  // than keep running as a zombie (e.g. a failed port bind that leaves nothing listening).
  console.error('[Uncaught Exception]:', err);
  process.exit(1);
});

startServer();
