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
const oauthService = require('./services/oauth.service');

// Route imports
const authRoutes = require('./routes/auth.routes');
const clientRoutes = require('./routes/client.routes');
const userRoutes = require('./routes/user.routes');
const webhookRoutes = require('./routes/webhook.routes');

// New multi-tenant routes
const adminRoutes = require('./routes/admin.routes');
const clientAuthRoutes = require('./routes/clientAuth.routes');
const userAuthRoutes = require('./routes/userAuth.routes');
const jwksRoutes = require('./routes/jwks.routes');

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

    // FLEXIBLE CORS CONFIGURATION
    this.app.use(cors({
      origin: (origin, callback) => {
        // Default allowed origins
        const defaultOrigins = [
          'http://localhost:3000', 
          'http://localhost:3001',
          'http://localhost:8000',
          'http://localhost:5173', // Vite/React dev server
          'https://localhost:5173', // HTTPS for local development
          'http://127.0.0.1:3000',
          'http://127.0.0.1:3001', 
          'http://127.0.0.1:8000',
          'http://127.0.0.1:5173',
          'https://127.0.0.1:5173'
        ];

        // Combine environment variable origins with defaults
        const envOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()).filter(o => o) || [];
        const allowedOrigins = [...new Set([...defaultOrigins, ...envOrigins])];
        
        // Development mode: allow all localhost and common dev origins
        if (process.env.NODE_ENV === 'development') {
          const isDevelopmentOrigin = !origin || 
            origin.includes('localhost') || 
            origin.includes('127.0.0.1') ||
            origin.includes('192.168.') || // Local network
            origin.includes('10.0.') ||    // Local network
            origin.includes('0.0.0.0') ||
            allowedOrigins.includes(origin);
          
          if (isDevelopmentOrigin) {
            logger.debug(`CORS allowed (development): ${origin || 'no-origin'}`);
            callback(null, true);
            return;
          }
        }
        
        // Production mode: strict origin checking
        if (process.env.NODE_ENV === 'production') {
          if (!origin) {
            // Allow requests with no origin in production (mobile apps, server-to-server)
            logger.debug('CORS allowed (no origin): server-to-server request');
            callback(null, true);
            return;
          }
          
          if (allowedOrigins.includes(origin)) {
            logger.debug(`CORS allowed (production): ${origin}`);
            callback(null, true);
            return;
          }
        }
        
        // Fallback: check against allowed origins
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          logger.warn(`CORS blocked: ${origin}. Allowed: ${allowedOrigins.join(', ')}`);
          callback(new Error(`Not allowed by CORS. Origin: ${origin}`));
        }
      },
      credentials: true, // Allow cookies and authentication headers
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      allowedHeaders: [
        'Content-Type', 
        'Authorization', 
        'X-Requested-With',
        'X-Client-ID',
        'X-Application-ID',
        'Accept',
        'Origin',
        'Cache-Control'
      ],
      exposedHeaders: [
        'X-Total-Count',
        'X-RateLimit-Limit',
        'X-RateLimit-Remaining'
      ],
      maxAge: 86400, // 24 hours for preflight cache
    }));

    // Handle preflight requests globally
    this.app.options('*', cors());

    // Rate limiting
    const globalLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: process.env.NODE_ENV === 'development' ? 1000 : 100, // More lenient in development
      message: {
        error: 'Too many requests from this IP, please try again later.',
        code: 'RATE_LIMIT_EXCEEDED'
      },
      standardHeaders: true,
      legacyHeaders: false,
    });

    const authLimiter = rateLimit({
      windowMs: 60 * 60 * 1000, // 1 hour
      max: process.env.NODE_ENV === 'development' ? 1000 : 10, // More lenient in development
      message: {
        error: 'Too many authentication attempts, please try again later.',
        code: 'AUTH_RATE_LIMIT_EXCEEDED'
      },
      standardHeaders: true,
      legacyHeaders: false,
    });

    const strictAuthLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: process.env.NODE_ENV === 'development' ? 100 : 5, // Stricter for sensitive endpoints
      message: {
        error: 'Too many attempts, please try again later.',
        code: 'STRICT_RATE_LIMIT_EXCEEDED'
      },
      standardHeaders: true,
      legacyHeaders: false,
    });

    // Apply rate limiting
    this.app.use(globalLimiter);
    this.app.use('/api/auth', authLimiter);
    this.app.use('/api/auth/login', strictAuthLimiter);
    this.app.use('/api/auth/register', strictAuthLimiter);
    this.app.use('/api/user/login', strictAuthLimiter);

    // Body parsing
    this.app.use(express.json({ 
      limit: '10mb',
      verify: (req, res, buf) => {
        try {
          JSON.parse(buf);
        } catch (e) {
          res.status(400).json({
            error: 'Invalid JSON in request body',
            code: 'INVALID_JSON'
          });
          throw new Error('Invalid JSON');
        }
      }
    }));
    
    this.app.use(express.urlencoded({ 
      extended: true, 
      limit: '10mb',
      parameterLimit: 100 // Maximum number of URL-encoded parameters
    }));

    // Session middleware for OAuth flows
    this.app.use(session({
      secret: process.env.SESSION_SECRET || 'authjet-session-secret-change-in-production',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 10 * 60 * 1000, // 10 minutes for OAuth flows
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
      },
      store: process.env.NODE_ENV === 'production' ? 
        // In production, you might want to use a proper session store
        // For now, we'll use MemoryStore with a warning
        new session.MemoryStore() : 
        new session.MemoryStore()
    }));

    // Disable ETag to avoid 304 loops on dynamic auth endpoints
    this.app.set('etag', false);

    // Enhanced logging
    this.app.use(morgan('combined', { 
      stream: logger.stream,
      skip: (req, res) => {
        // Skip logging for health checks and OPTIONS requests in production
        if (process.env.NODE_ENV === 'production') {
          return req.path === '/health' || req.method === 'OPTIONS';
        }
        return false;
      }
    }));

    // Compression (skip for certain endpoints)
    this.app.use(compression({
      filter: (req, res) => {
        if (req.headers['x-no-compression']) {
          return false;
        }
        return compression.filter(req, res);
      },
      level: 6
    }));

    // Initialize OAuth service
    this.app.use(oauthService.getPassportMiddleware());
    this.app.use(oauthService.getPassportSession());

    // Add security headers
    this.app.use((req, res, next) => {
      // Remove potentially sensitive headers
      res.removeHeader('X-Powered-By');
      
      // Add security headers
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      
      // Add CORS headers for all responses
      const origin = req.headers.origin;
      if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      }
      
      next();
    });
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV,
        memory: process.memoryUsage(),
        version: process.env.npm_package_version || '1.0.0'
      });
    });

    // Enhanced health check with database connectivity
    this.app.get('/health/detailed', async (req, res) => {
      try {
        const dbCheck = await database.query('SELECT NOW() as time');
        res.status(200).json({
          status: 'OK',
          timestamp: new Date().toISOString(),
          database: 'connected',
          database_time: dbCheck.rows[0].time,
          environment: process.env.NODE_ENV,
          node_version: process.version
        });
      } catch (error) {
        res.status(503).json({
          status: 'ERROR',
          timestamp: new Date().toISOString(),
          database: 'disconnected',
          error: error.message,
          environment: process.env.NODE_ENV
        });
      }
    });

    // 🔐 FIX KEYS ROUTE - Add this to fix the encryption key issue
    this.app.post('/api/fix-keys', async (req, res) => {
      try {
        const clientKeyService = require('./services/clientKey.service');
        const database = require('./utils/database');
        
        const clientId = 'cli_a213a4990d48cb89eb4d9f6555d39280';
        
        console.log('🔐 Current encryption key:', clientKeyService.encryptionKey);
        
        // Step 1: Revoke all existing keys for this client
        const clientDbId = await clientKeyService.getClientDbId(clientId);
        await database.query(
          'UPDATE client_keys SET is_active = false, revoked_at = NOW() WHERE client_id = $1',
          [clientDbId]
        );
        
        console.log('✅ Revoked existing keys');
        
        // Step 2: Generate new key pair with current encryption key
        const newKey = await clientKeyService.generateKeyPair(clientId);
        
        console.log('✅ Generated new key:', {
          keyId: newKey.keyId,
          kid: newKey.kid
        });
        
        // Step 3: Verify the new key works
        const activeKey = await clientKeyService.getActiveKey(clientId);
        if (activeKey && activeKey.private_key) {
          console.log('✅ New key decryption successful!');
          
          res.json({
            success: true,
            message: 'New key generated successfully',
            keyId: newKey.keyId,
            kid: newKey.kid,
            canDecrypt: true
          });
        } else {
          throw new Error('Failed to verify new key');
        }
        
      } catch (error) {
        console.error('❌ Fix keys error:', error);
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // PUBLIC JWKS ENDPOINTS (NO AUTH REQUIRED) - Must be registered BEFORE authenticated routes
    this.app.use('/api/client', require('./routes/jwks.routes'));

    // OAuth 2.0 routes
    this.app.use('/oauth', require('./routes/oauth.routes'));
    this.app.use('/auth', require('./routes/oauth.routes'));
    
    // Social OAuth routes
    this.app.use('/api/auth', require('./routes/socialAuth.routes'));

    // Dashboard routes
    this.app.use('/api/dashboard', require('./routes/dashboard.routes'));

    // Legacy routes (for backward compatibility)
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/clients', clientRoutes);
    this.app.use('/api/users', userRoutes);
    this.app.use('/api/webhooks', webhookRoutes);
    
    this.app.use('/api/analytics', require('./routes/analytics.routes'));

    // New multi-tenant routes
    this.app.use('/api/admin', adminRoutes);
    this.app.use('/api/client', clientAuthRoutes);
    
    // User authentication routes
    this.app.use('/api/user', userAuthRoutes);
    this.app.use('/api/user', jwksRoutes);
    this.app.use('/api/client', require('./routes/clientKeys.routes'));

    // JWKS endpoint
    this.app.get('/.well-known/jwks.json', (req, res) => {
      try {
        const jwtService = require('./services/jwt.service');
        const jwk = jwtService.getPublicJwk();
        
        if (!jwk) {
          return res.status(501).json({ 
            error: 'JWKS not supported with current configuration',
            code: 'JWKS_NOT_SUPPORTED'
          });
        }
        
        res.json({ keys: [jwk] });
      } catch (error) {
        logger.error('JWKS endpoint error:', error);
        res.status(500).json({ 
          error: 'Failed to retrieve JWKS',
          code: 'JWKS_ERROR'
        });
      }
    });

    // API information endpoint
    this.app.get('/api', (req, res) => {
      res.json({
        name: 'AuthJet OAuth Provider',
        version: process.env.npm_package_version || '1.0.0',
        description: 'Multi-tenant OAuth 2.0 authentication service',
        documentation: '/api/docs', // You can add Swagger docs later
        endpoints: {
          auth: '/api/auth',
          user: '/api/user',
          client: '/api/client',
          admin: '/api/admin',
          oauth: '/oauth'
        }
      });
    });
  }

  setupErrorHandling() {
    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Route not found',
        path: req.originalUrl,
        method: req.method,
        code: 'ROUTE_NOT_FOUND'
      });
    });

    // Global error handler
    this.app.use(errorHandler);
  }

  async start() {
    try {
      await database.connect();
      logger.info('Database connected successfully');

      const PORT = process.env.PORT || 8000;
      this.server = this.app.listen(PORT, () => {
        logger.info(`AuthJet server running on port ${PORT}`);
        logger.info(`Environment: ${process.env.NODE_ENV}`);
        logger.info(`CORS enabled for origins: ${process.env.ALLOWED_ORIGINS || 'default development origins'}`);
        
        if (process.env.NODE_ENV === 'development') {
          logger.info('Development mode: CORS is permissive for localhost origins');
          logger.info('Available endpoints:');
          logger.info('  Health: http://localhost:' + PORT + '/health');
          logger.info('  API Info: http://localhost:' + PORT + '/api');
          logger.info('  JWKS: http://localhost:' + PORT + '/.well-known/jwks.json');
        }
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