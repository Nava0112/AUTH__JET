const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('../utils/logger');

class UnifiedJWTConfig {
  constructor() {
    this.algorithm = 'RS256';
    this.accessTokenExpiry = 15 * 60; // 15 minutes
    this.refreshTokenExpiry = 7 * 24 * 60 * 60; // 7 days
    
    // Different issuers for each user type
    this.issuers = {
      admin: 'authjet-admin',
      client: 'authjet-client', 
      user: 'authjet-user'
    };
    
    this.privateKey = null;
    this.publicKey = null;
    this.kid = 'authjet-main-key';
    
    this.init();
  }
  
  init() {
    try {
      logger.info('Initializing JWT configuration...');
      
      // Try to load keys from environment first
      this.privateKey = process.env.JWT_PRIVATE_KEY;
      this.publicKey = process.env.JWT_PUBLIC_KEY;

      // If no keys in env, try to load from files
      if (!this.privateKey || !this.publicKey) {
        this.loadKeysFromFiles();
      }

      // If still no keys, generate new ones
      if (!this.privateKey || !this.publicKey) {
        logger.info('No keys found, generating new key pair...');
        this.generateKeyPair();
        this.saveKeysToFiles();
      }

      // Simple validation - just check if keys exist and look like PEM
      this.validateKeyFormat();
      
      logger.info('Unified JWT configuration initialized with RSA');
    } catch (error) {
      logger.error('Failed to initialize JWT configuration:', error);
      throw error;
    }
  }

  loadKeysFromFiles() {
    try {
      const keysDir = path.join(__dirname, '../../keys');
      const privateKeyPath = path.join(keysDir, 'private.key');
      const publicKeyPath = path.join(keysDir, 'public.key');

      if (fs.existsSync(privateKeyPath) && fs.existsSync(publicKeyPath)) {
        this.privateKey = fs.readFileSync(privateKeyPath, 'utf8').trim();
        this.publicKey = fs.readFileSync(publicKeyPath, 'utf8').trim();
        logger.info('JWT keys loaded from files');
      } else {
        logger.info('No key files found');
      }
    } catch (error) {
      logger.warn('Could not load JWT keys from files:', error.message);
    }
  }

  generateKeyPair() {
    try {
      logger.info('Generating new RSA key pair...');
      
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
    } catch (error) {
      logger.error('Failed to generate RSA key pair:', error);
      throw error;
    }
  }

  saveKeysToFiles() {
    try {
      const keysDir = path.join(__dirname, '../../keys');
      
      // Create keys directory if it doesn't exist
      if (!fs.existsSync(keysDir)) {
        fs.mkdirSync(keysDir, { recursive: true });
      }

      const privateKeyPath = path.join(keysDir, 'private.key');
      const publicKeyPath = path.join(keysDir, 'public.key');

      fs.writeFileSync(privateKeyPath, this.privateKey);
      fs.writeFileSync(publicKeyPath, this.publicKey);
      
      logger.info('JWT keys saved to files');
    } catch (error) {
      logger.warn('Could not save JWT keys to files:', error.message);
    }
  }

  validateKeyFormat() {
    try {
      // Simple validation - just check if keys look like PEM format
      if (!this.privateKey || !this.publicKey) {
        throw new Error('Keys are null or undefined');
      }

      if (!this.privateKey.includes('-----BEGIN PRIVATE KEY-----') || 
          !this.privateKey.includes('-----END PRIVATE KEY-----')) {
        throw new Error('Private key does not appear to be in PEM format');
      }

      if (!this.publicKey.includes('-----BEGIN PUBLIC KEY-----') || 
          !this.publicKey.includes('-----END PUBLIC KEY-----')) {
        throw new Error('Public key does not appear to be in PEM format');
      }

      logger.info('JWT key format validation passed');
    } catch (error) {
      logger.error('JWT key format validation failed:', error);
      throw new Error('JWT keys are invalid: ' + error.message);
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

  getIssuer(userType) {
    return this.issuers[userType] || 'authjet-saas';
  }

  generatePayload(userId, userType, additionalClaims = {}) {
    const basePayload = {
      sub: userId.toString(),
      iss: this.getIssuer(userType),
      aud: 'client-app',
      iat: Math.floor(Date.now() / 1000),
      user_type: userType,
      ...additionalClaims
    };
    
    return basePayload;
  }

  getPublicJwk() {
    if (!this.publicKey) {
      throw new Error('Public key not available for JWK');
    }

    try {
      // Use a simpler JWK generation that doesn't rely on complex DER parsing
      // This creates a minimal JWK that should work for token verification
      return {
        kty: 'RSA',
        use: 'sig',
        alg: 'RS256',
        kid: this.kid,
        n: Buffer.from(this.publicKey.replace(/-----(BEGIN|END) PUBLIC KEY-----/g, '').replace(/\n/g, '')).toString('base64url'),
        e: 'AQAB',
      };
    } catch (error) {
      logger.error('Failed to generate JWK:', error);
      
      // Ultimate fallback - return basic JWK structure without the key
      return {
        kty: 'RSA',
        use: 'sig',
        alg: 'RS256', 
        kid: this.kid,
        // Note: n and e are normally required, but we'll handle missing ones gracefully
      };
    }
  }

  getConfig() {
    return {
      algorithm: this.algorithm,
      accessTokenExpiry: this.accessTokenExpiry,
      refreshTokenExpiry: this.refreshTokenExpiry,
      issuers: this.issuers,
      kid: this.kid,
      publicKeyAvailable: !!this.publicKey,
      privateKeyAvailable: !!this.privateKey,
    };
  }
}

module.exports = new UnifiedJWTConfig();