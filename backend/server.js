import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Import routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import detectionRoutes from './routes/detections.js';
import chatRoutes from './routes/chats.js';
import messageRoutes from './routes/messages.js';
import analyticsRoutes from './routes/analytics.js';
import adminRoutes from './routes/admin.js';
import mlRoutes from './routes/ml.js';
import publicDetectionRoutes from './routes/publicDetection.js';

// Import middleware
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/logger.js';
import { authMiddleware } from './middleware/auth.js';

// Import services
import { cyberbullyingDetector } from './services/CyberbullyingDetector.js';
import { connectDB } from './config/database.js';
import { createAdminUser } from './scripts/createAdmin.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"],
    },
  },
}));

app.use(compression());
app.use(mongoSanitize());

// Rate limiting
const limiter = rateLimit({
  windowMs: (parseInt(process.env.RATE_LIMIT_WINDOW) || 15) * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// Stricter rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: {
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: '15 minutes'
  },
  skipSuccessfulRequests: true
});

// CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://CyberGuard.app', 'https://www.CyberGuard.app']
    : ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(requestLogger);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', authMiddleware, userRoutes);
app.use('/api/detections', authMiddleware, detectionRoutes);
app.use('/api/chats', authMiddleware, chatRoutes);
app.use('/api/messages', authMiddleware, messageRoutes);
app.use('/api/analytics', authMiddleware, analyticsRoutes);
app.use('/api/ml', authMiddleware, mlRoutes);
app.use('/api/admin', authMiddleware, adminRoutes);

// Public detection endpoints (no auth required)
app.use('/api/public', publicDetectionRoutes);

// Static file serving for ML model and data
app.use('/data', express.static(path.join(__dirname, 'data')));

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
    availableEndpoints: [
      'GET /health',
      'POST /api/auth/register',
      'POST /api/auth/login',
      'GET /api/users/profile',
      'POST /api/detections',
      'GET /api/chats',
      'GET /api/analytics/overview',
      'GET /api/ml/model'
    ]
  });
});

// Global error handlers
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Initialize server
async function startServer() {
  try {
    // Connect to database (optional)
    try {
      const connected = await connectDB();
      if (connected !== false) {
        console.log('✅ Database connected');
        // Create admin user if it doesn't exist
        try {
          await createAdminUser();
          console.log('✅ Admin user verified');
        } catch (err) {
          console.warn('⚠️  Failed to verify admin user:', err.message || err);
        }
      } else {
        console.warn('⚠️  Database not connected; running in offline mode');
      }
    } catch (err) {
      console.warn('⚠️  Database connection failed; running in offline mode', err);
    }

    // Initialize ML model
    await cyberbullyingDetector.initialize();
    console.log('✅ ML model loaded');

    // Ensure data directory exists
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Start server
    const server = app.listen(PORT, () => {
      console.log(`🚀 Cyber Sentinel Backend running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV}`);
      console.log(`🔒 Rate limiting: ${process.env.RATE_LIMIT_MAX} requests per ${process.env.RATE_LIMIT_WINDOW} minutes`);
      console.log(`🤖 ML Detection: ${cyberbullyingDetector.isModelLoaded() ? 'Active' : 'Inactive'}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down gracefully');
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('SIGINT received, shutting down gracefully');
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();