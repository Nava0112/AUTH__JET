const crypto = require('crypto');
const logger = require('../utils/logger');

class JWTConfig {
  constructor() {
    this.privateKey = null;
    this.publicKey = null;
    this.algorithm = 'RS256';
    this.accessTokenExpiry = 15 * 60; // 15 minutes in seconds
    this.refreshTokenExpiry = 7 * 24 * 60 * 60; // 7 days in seconds
    this.issuer = 'authjet-saas';
    this.audience = 'client-app';
    
    this.init();
  }

  init() {
    // Try to load keys from environment variables first
    this.privateKey = process.env.JWT_PRIVATE_KEY;
    this.publicKey = process.env.JWT_PUBLIC_KEY;

    // If no keys in environment, generate new ones
    if (!this.privateKey || !this.publicKey) {
      this.generateKeyPair();
    }

    logger.info('JWT configuration initialized');
  }

  generateKeyPair() {
    try {
      const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem',
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem',
        },
      });

      this.privateKey = privateKey;
      this.publicKey = publicKey;

      logger.info('RSA key pair generated successfully');

      // Log warning in production about using generated keys
      if (process.env.NODE_ENV === 'production') {
        logger.warn('Using auto-generated JWT keys. For production, set JWT_PRIVATE_KEY and JWT_PUBLIC_KEY environment variables.');
      }
    } catch (error) {
      logger.error('Failed to generate RSA key pair:', error);
      throw error;
    }
  }

  getPrivateKey() {
    if (!this.privateKey) {
      throw new Error('JWT private key not available');
    }
    return this.privateKey;
  }

  getPublicKey() {
    if (!this.publicKey) {
      throw new Error('JWT public key not available');
    }
    return this.publicKey;
  }

  getPublicJwk() {
    if (!this.publicKey) {
      throw new Error('Public key not available');
    }

    try {
      const key = crypto.createPublicKey(this.publicKey);
      const der = key.export({ type: 'spki', format: 'der' });
      
      // Extract modulus (n) from DER format
      // This is a simplified extraction - in production, use a proper ASN.1 parser
      const derBuffer = Buffer.from(der);
      const modulusStart = derBuffer.indexOf(Buffer.from([0x02, 0x82])) + 4;
      const modulusLength = derBuffer.readUInt16BE(modulusStart - 2);
      const modulus = derBuffer.slice(modulusStart, modulusStart + modulusLength);

      return {
        kty: 'RSA',
        use: 'sig',
        alg: 'RS256',
        n: modulus.toString('base64url'),
        e: 'AQAB', // Standard exponent for RSA
      };
    } catch (error) {
      logger.error('Failed to generate JWK:', error);
      throw error;
    }
  }

  getAccessTokenExpiry() {
    return this.accessTokenExpiry;
  }

  getRefreshTokenExpiry() {
    return this.refreshTokenExpiry;
  }

  getIssuer() {
    return this.issuer;
  }

  getAudience() {
    return this.audience;
  }

  getAlgorithm() {
    return this.algorithm;
  }

  // Method to update configuration (useful for testing)
  setConfig(newConfig) {
    if (newConfig.accessTokenExpiry) {
      this.accessTokenExpiry = newConfig.accessTokenExpiry;
    }
    if (newConfig.refreshTokenExpiry) {
      this.refreshTokenExpiry = newConfig.refreshTokenExpiry;
    }
    if (newConfig.issuer) {
      this.issuer = newConfig.issuer;
    }
    if (newConfig.audience) {
      this.audience = newConfig.audience;
    }
    if (newConfig.algorithm) {
      this.algorithm = newConfig.algorithm;
    }
  }

  // Method to validate JWT configuration
  validate() {
    const errors = [];

    if (!this.privateKey) {
      errors.push('JWT private key is required');
    }

    if (!this.publicKey) {
      errors.push('JWT public key is required');
    }

    if (this.accessTokenExpiry <= 0) {
      errors.push('Access token expiry must be positive');
    }

    if (this.refreshTokenExpiry <= 0) {
      errors.push('Refresh token expiry must be positive');
    }

    if (this.accessTokenExpiry >= this.refreshTokenExpiry) {
      errors.push('Access token expiry must be less than refresh token expiry');
    }

    if (!this.issuer) {
      errors.push('JWT issuer is required');
    }

    if (!this.audience) {
      errors.push('JWT audience is required');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // Get configuration for debugging (without exposing private key)
  getConfig() {
    return {
      algorithm: this.algorithm,
      accessTokenExpiry: this.accessTokenExpiry,
      refreshTokenExpiry: this.refreshTokenExpiry,
      issuer: this.issuer,
      audience: this.audience,
      publicKeyAvailable: !!this.publicKey,
      privateKeyAvailable: !!this.privateKey,
    };
  }
}

module.exports = new JWTConfig();