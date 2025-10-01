const rateLimit = require('express-rate-limit');
const Redis = require('ioredis');
const logger = require('../utils/logger');

let redisClient;

// Initialize Redis client if available
if (process.env.REDIS_URL) {
  redisClient = new Redis(process.env.REDIS_URL);
  
  redisClient.on('error', (err) => {
    logger.error('Redis connection error:', err);
  });
}

const createRateLimitStore = () => {
  if (redisClient) {
    const RedisStore = require('rate-limit-redis');
    return new RedisStore({
      client: redisClient,
      prefix: 'authjet:ratelimit:',
    });
  }
  
  // Fallback to in-memory store
  return undefined;
};

// General API rate limiting
const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createRateLimitStore(),
});

// Strict rate limiting for authentication endpoints
const authRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 login attempts per hour
  message: {
    error: 'Too many authentication attempts, please try again later.',
    code: 'AUTH_RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createRateLimitStore(),
});

// Client API rate limiting (per API key)
const clientRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // Limit each client to 60 requests per minute
  keyGenerator: (req) => {
    return req.client?.api_key || req.ip;
  },
  message: {
    error: 'API rate limit exceeded for this client.',
    code: 'CLIENT_RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createRateLimitStore(),
});

// Webhook rate limiting
const webhookRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Limit each client to 10 webhook calls per minute
  keyGenerator: (req) => {
    return req.client?.api_key || req.ip;
  },
  message: {
    error: 'Webhook rate limit exceeded.',
    code: 'WEBHOOK_RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: createRateLimitStore(),
});

// User-based rate limiting
const createUserRateLimit = (maxRequests = 100, windowMinutes = 15) => {
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    max: maxRequests,
    keyGenerator: (req) => {
      return req.user?.id || req.ip;
    },
    message: {
      error: 'Rate limit exceeded for this user.',
      code: 'USER_RATE_LIMIT_EXCEEDED',
    },
    standardHeaders: true,
    legacyHeaders: false,
    store: createRateLimitStore(),
  });
};

module.exports = {
  generalRateLimit,
  authRateLimit,
  clientRateLimit,
  webhookRateLimit,
  createUserRateLimit,
};