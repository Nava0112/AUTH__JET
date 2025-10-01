const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const compression = require('compression');
const session = require('express-session');

const database = require('./utils/database');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');

// Route imports
const authRoutes = require('./routes/auth.routes');
const clientRoutes = require('./routes/client.routes');
const userRoutes = require('./routes/user.routes');
const webhookRoutes = require('./routes/webhook.routes');

class AuthJetApp {
  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();

    // Simple in-memory request spike guard (development only)
    this.app.use((req, res, next) => {
      const now = Date.now();
      const clientIP = req.ip || req.connection?.remoteAddress;
      if (!this.app.requestCounts) {
        this.app.requestCounts = new Map();
      }
      const entry = this.app.requestCounts.get(clientIP) || { count: 0, lastReset: now };
      if (now - entry.lastReset > 60000) {
        entry.count = 0;
        entry.lastReset = now;
      }
      entry.count++;
      this.app.requestCounts.set(clientIP, entry);
      if (entry.count > 50 && process.env.NODE_ENV !== 'production') {
        console.warn(`Excessive requests from ${clientIP}: ${entry.count} in last minute`);
      }
      next();
    });
  }

  setupMiddleware() {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }));

    // CORS with dynamic origin validation
    this.app.use(cors({
      origin: (origin, callback) => {
        const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
    }));

    // Rate limiting
    const globalLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later.',
    });

    const authLimiter = rateLimit({
      windowMs: 60 * 60 * 1000, // 1 hour
      max: process.env.NODE_ENV === 'development' ? 1000 : 5, // 5 login attempts per hour
      message: 'Too many authentication attempts, please try again later.',
    });

    this.app.use(globalLimiter);
    this.app.use('/api/auth', authLimiter);

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Session middleware for OAuth flows
    this.app.use(session({
      secret: process.env.SESSION_SECRET || 'authjet-session-secret-change-in-production',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 10 * 60 * 1000, // 10 minutes for OAuth flows
      },
    }));

    // Disable ETag to avoid 304 loops on dynamic auth endpoints
    this.app.set('etag', false);

    // Logging
    this.app.use(morgan('combined', { stream: logger.stream }));

    // Compression
    this.app.use(compression());
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV,
      });
    });

    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/clients', clientRoutes);
    this.app.use('/api/users', userRoutes);
    this.app.use('/api/webhooks', webhookRoutes);
    this.app.use('/api/analytics', require('./routes/analytics.routes'));

    // JWKS endpoint
    this.app.get('/.well-known/jwks.json', (req, res) => {
      try {
        const jwk = require('./services/jwt.service').getPublicJwk();
        res.json({ keys: [jwk] });
      } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve JWKS' });
      }
    });
  }

  setupErrorHandling() {
    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Route not found',
        path: req.originalUrl,
        method: req.method,
      });
    });

    // Global error handler
    this.app.use(errorHandler);
  }

  async start() {
    try {
      await database.connect();
      logger.info('Database connected successfully');

      const PORT = process.env.PORT || 5000;
      this.server = this.app.listen(PORT, () => {
        logger.info(`AuthJet server running on port ${PORT}`);
        logger.info(`Environment: ${process.env.NODE_ENV}`);
      });

      return this.server;
    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  async stop() {
    if (this.server) {
      this.server.close();
      await database.disconnect();
      logger.info('Server stopped gracefully');
    }
  }
}

module.exports = AuthJetApp;