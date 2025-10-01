const crypto = require('crypto');
const logger = require('../utils/logger');

class JWTConfig {
  constructor() {
    this.algorithm = 'HS256'; // Use HMAC instead of RSA for simplicity
    this.accessTokenExpiry = 15 * 60; // 15 minutes in seconds
    this.refreshTokenExpiry = 7 * 24 * 60 * 60; // 7 days in seconds
    this.issuer = 'authjet-saas';
    this.audience = 'client-app';
    
    this.init();
  }

  init() {
    // Use JWT_SECRET from environment or generate one
    this.secret = process.env.JWT_SECRET;
    
    if (!this.secret) {
      // Generate a secure secret
      this.secret = crypto.randomBytes(64).toString('hex');
      logger.warn('No JWT_SECRET found, using generated secret. Set JWT_SECRET in .env for production.');
    }

    logger.info('JWT configuration initialized with HMAC');
  }

  getSecret() {
    if (!this.secret) {
      throw new Error('JWT secret not available');
    }
    return this.secret;
  }

  // For HMAC, we don't need separate public/private keys
  getPrivateKey() {
    return this.getSecret();
  }

  getPublicKey() {
    return this.getSecret();
  }

  // Simple JWK for HMAC (not typically used, but for compatibility)
  getPublicJwk() {
    return {
      kty: 'oct',
      use: 'sig',
      alg: 'HS256',
      k: Buffer.from(this.secret).toString('base64url')
    };
  }

  getConfig() {
    return {
      algorithm: this.algorithm,
      secret: this.secret,
      accessTokenExpiry: this.accessTokenExpiry,
      refreshTokenExpiry: this.refreshTokenExpiry,
      issuer: this.issuer,
      audience: this.audience,
    };
  }
}

module.exports = new JWTConfig();
