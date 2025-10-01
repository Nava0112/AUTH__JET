const logger = require('../utils/logger');

class ServerConfig {
  constructor() {
    this.port = process.env.PORT || 5000;
    this.nodeEnv = process.env.NODE_ENV || 'development';
    this.isProduction = this.nodeEnv === 'production';
    this.isDevelopment = this.nodeEnv === 'development';
    this.isTest = this.nodeEnv === 'test';
    
    this.corsOrigins = this.parseCorsOrigins();
    this.rateLimit = this.getRateLimitConfig();
    this.security = this.getSecurityConfig();
    this.logging = this.getLoggingConfig();
    
    this.validate();
  }

  parseCorsOrigins() {
    const origins = process.env.ALLOWED_ORIGINS;
    
    if (!origins) {
      return this.isProduction ? [] : ['http://localhost:3000'];
    }

    return origins.split(',').map(origin => origin.trim());
  }

  getRateLimitConfig() {
    return {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
      authWindowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 60 * 60 * 1000, // 1 hour
      authMax: parseInt(process.env.AUTH_RATE_LIMIT_MAX_ATTEMPTS) || 5, // 5 login attempts per hour
      clientWindowMs: parseInt(process.env.CLIENT_RATE_LIMIT_WINDOW_MS) || 60 * 1000, // 1 minute
      clientMax: parseInt(process.env.CLIENT_RATE_LIMIT_MAX_REQUESTS) || 60, // 60 requests per minute per client
    };
  }

  getSecurityConfig() {
    return {
      bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 12,
      jwtAlgorithm: process.env.JWT_ALGORITHM || 'RS256',
      accessTokenExpiry: parseInt(process.env.ACCESS_TOKEN_EXPIRY) || 15 * 60, // 15 minutes
      refreshTokenExpiry: parseInt(process.env.REFRESH_TOKEN_EXPIRY) || 7 * 24 * 60 * 60, // 7 days
      helmetConfig: {
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
          },
        },
      },
      corsConfig: {
        origin: (origin, callback) => {
          // Allow requests with no origin (like mobile apps or curl requests)
          if (!origin) return callback(null, true);
          
          if (this.corsOrigins.includes(origin)) {
            callback(null, true);
          } else {
            callback(new Error(`Origin ${origin} not allowed by CORS`));
          }
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Client-Secret'],
      },
    };
  }

  getLoggingConfig() {
    return {
      level: process.env.LOG_LEVEL || (this.isProduction ? 'info' : 'debug'),
      file: {
        error: 'logs/error.log',
        combined: 'logs/combined.log',
        exceptions: 'logs/exceptions.log',
        rejections: 'logs/rejections.log',
      },
      maxSize: '5m',
      maxFiles: '5',
    };
  }

  validate() {
    const errors = [];

    if (this.port < 1 || this.port > 65535) {
      errors.push('PORT must be between 1 and 65535');
    }

    if (!['development', 'production', 'test'].includes(this.nodeEnv)) {
      errors.push('NODE_ENV must be one of: development, production, test');
    }

    if (this.rateLimit.windowMs <= 0) {
      errors.push('RATE_LIMIT_WINDOW_MS must be positive');
    }

    if (this.rateLimit.max <= 0) {
      errors.push('RATE_LIMIT_MAX_REQUESTS must be positive');
    }

    if (this.security.bcryptRounds < 10 || this.security.bcryptRounds > 15) {
      errors.push('BCRYPT_ROUNDS must be between 10 and 15');
    }

    if (this.security.accessTokenExpiry <= 0) {
      errors.push('ACCESS_TOKEN_EXPIRY must be positive');
    }

    if (this.security.refreshTokenExpiry <= 0) {
      errors.push('REFRESH_TOKEN_EXPIRY must be positive');
    }

    if (this.security.accessTokenExpiry >= this.security.refreshTokenExpiry) {
      errors.push('ACCESS_TOKEN_EXPIRY must be less than REFRESH_TOKEN_EXPIRY');
    }

    if (errors.length > 0) {
      logger.error('Server configuration validation failed:', errors);
      throw new Error(`Invalid server configuration: ${errors.join(', ')}`);
    }

    logger.info('Server configuration validated successfully');
  }

  // Get configuration for debugging
  getConfig() {
    return {
      port: this.port,
      nodeEnv: this.nodeEnv,
      isProduction: this.isProduction,
      isDevelopment: this.isDevelopment,
      isTest: this.isTest,
      corsOrigins: this.corsOrigins,
      rateLimit: this.rateLimit,
      security: {
        ...this.security,
        // Don't expose sensitive config details
        corsConfig: '***',
        helmetConfig: '***',
      },
      logging: this.logging,
    };
  }

  // Check if a feature is enabled
  isFeatureEnabled(feature) {
    const features = {
      rateLimiting: process.env.ENABLE_RATE_LIMITING !== 'false',
      cors: process.env.ENABLE_CORS !== 'false',
      helmet: process.env.ENABLE_HELMET !== 'false',
      compression: process.env.ENABLE_COMPRESSION !== 'false',
      requestLogging: process.env.ENABLE_REQUEST_LOGGING !== 'false',
    };

    return features[feature] ?? true;
  }

  // Get database configuration
  getDatabaseConfig() {
    return {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'authjet',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      max: parseInt(process.env.DB_POOL_MAX) || 20,
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 2000,
      ssl: this.isProduction ? { rejectUnauthorized: false } : false,
    };
  }
}

module.exports = new ServerConfig();