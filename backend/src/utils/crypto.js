const crypto = require('crypto');
const bcrypt = require('bcrypt');
const logger = require('./logger');

class CryptoUtils {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32;
    this.ivLength = 16;
    this.authTagLength = 16;
    this.saltRounds = 12;
  }

  // ============================================
  // ENCRYPTION METHODS
  // ============================================

  getEncryptionKey() {
    let key = process.env.KEY_ENCRYPTION_KEY;
    
    if (!key) {
      logger.warn('KEY_ENCRYPTION_KEY not found, using JWT secret as fallback');
      key = process.env.JWT_SECRET;
    }
    
    if (!key) {
      throw new Error('No encryption key available. Set KEY_ENCRYPTION_KEY environment variable.');
    }
    
    return crypto.createHash('sha256').update(key).digest();
  }

  encrypt(plaintext, password = null) {
    try {
      const key = password ? crypto.createHash('sha256').update(password).digest() : this.getEncryptionKey();
      const iv = crypto.randomBytes(this.ivLength);
      
      const cipher = crypto.createCipher(this.algorithm, key);
      cipher.setAAD(Buffer.from('authjet-saas'));
      
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      const result = Buffer.concat([
        iv,
        authTag,
        Buffer.from(encrypted, 'hex')
      ]).toString('base64');
      
      return result;
    } catch (error) {
      logger.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  decrypt(encryptedData, password = null) {
    try {
      const key = password ? crypto.createHash('sha256').update(password).digest() : this.getEncryptionKey();
      const buffer = Buffer.from(encryptedData, 'base64');
      
      const iv = buffer.slice(0, this.ivLength);
      const authTag = buffer.slice(this.ivLength, this.ivLength + this.authTagLength);
      const encrypted = buffer.slice(this.ivLength + this.authTagLength);
      
      const decipher = crypto.createDecipher(this.algorithm, key);
      decipher.setAAD(Buffer.from('authjet-saas'));
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      logger.error('Decryption error:', error);
      throw new Error('Failed to decrypt data - possibly invalid key or corrupted data');
    }
  }

  // ============================================
  // PASSWORD METHODS
  // ============================================

  async hashPassword(password) {
    try {
      if (!password || typeof password !== 'string') {
        throw new Error('Password must be a non-empty string');
      }
      return await bcrypt.hash(password, this.saltRounds);
    } catch (error) {
      logger.error('Password hashing error:', error);
      throw new Error('Failed to hash password');
    }
  }

  async verifyPassword(password, hash) {
    try {
      if (!password || !hash) {
        return false;
      }
      return await bcrypt.compare(password, hash);
    } catch (error) {
      logger.error('Password verification error:', error);
      return false;
    }
  }

  validatePasswordStrength(password) {
    const requirements = {
      minLength: 8,
      hasUpperCase: /[A-Z]/.test(password),
      hasLowerCase: /[a-z]/.test(password),
      hasNumbers: /\d/.test(password),
      hasSpecialChar: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
    };

    const isStrong = 
      password.length >= requirements.minLength &&
      requirements.hasUpperCase &&
      requirements.hasLowerCase &&
      requirements.hasNumbers &&
      requirements.hasSpecialChar;

    return {
      isStrong,
      requirements,
      meetsMinLength: password.length >= requirements.minLength,
      score: this.calculatePasswordScore(password)
    };
  }

  calculatePasswordScore(password) {
    let score = 0;
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[a-z]/.test(password)) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    return Math.min(score, 6);
  }

  // ============================================
  // TOKEN & HASH METHODS
  // ============================================

  hashToken(token) {
    if (!token) {
      throw new Error('Token cannot be empty');
    }
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  generateRandomToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  generateSecureToken(length = 32) {
    return this.generateRandomToken(length);
  }

  generateNumericCode(length = 6) {
    let code = '';
    for (let i = 0; i < length; i++) {
      code += crypto.randomInt(0, 10).toString();
    }
    return code;
  }

  // ============================================
  // KEY PAIR GENERATION
  // ============================================

  async generateRSAKeyPair(modulusLength = 2048) {
    return new Promise((resolve, reject) => {
      crypto.generateKeyPair('rsa', {
        modulusLength: modulusLength,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem'
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem'
        }
      }, (err, publicKey, privateKey) => {
        if (err) {
          reject(err);
        } else {
          resolve({ 
            publicKey, 
            privateKey,
            keyId: this.generateKeyId()
          });
        }
      });
    });
  }

  async generateECKeyPair() {
    return new Promise((resolve, reject) => {
      crypto.generateKeyPair('ec', {
        namedCurve: 'prime256v1',
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem'
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem'
        }
      }, (err, publicKey, privateKey) => {
        if (err) {
          reject(err);
        } else {
          resolve({ 
            publicKey, 
            privateKey,
            keyId: this.generateKeyId()
          });
        }
      });
    });
  }

  generateKeyId(prefix = 'kid') {
    return `${prefix}_${this.randomString(8)}_${Date.now().toString(36)}`;
  }

  // ============================================
  // HMAC & SIGNATURE METHODS
  // ============================================

  createHmac(data, secret, algorithm = 'sha256') {
    if (typeof data !== 'string') {
      data = JSON.stringify(data);
    }
    return crypto.createHmac(algorithm, secret)
      .update(data)
      .digest('hex');
  }

  verifyHmac(data, signature, secret, algorithm = 'sha256') {
    try {
      const expectedSignature = this.createHmac(data, secret, algorithm);
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch (error) {
      return false;
    }
  }

  createSignature(data, privateKey, algorithm = 'RSA-SHA256') {
    const sign = crypto.createSign(algorithm);
    sign.update(data);
    sign.end();
    return sign.sign(privateKey, 'base64');
  }

  verifySignature(data, signature, publicKey, algorithm = 'RSA-SHA256') {
    try {
      const verify = crypto.createVerify(algorithm);
      verify.update(data);
      verify.end();
      return verify.verify(publicKey, signature, 'base64');
    } catch (error) {
      return false;
    }
  }

  // ============================================
  // RANDOM GENERATION METHODS
  // ============================================

  randomString(length = 16) {
    return crypto.randomBytes(Math.ceil(length / 2))
      .toString('hex')
      .slice(0, length);
  }

  randomInt(min, max) {
    return crypto.randomInt(min, max);
  }

  randomBytes(length) {
    return crypto.randomBytes(length);
  }

  // ============================================
  // KEY DERIVATION METHODS
  // ============================================

  deriveKeyFromPassword(password, salt, iterations = 100000, keyLength = 32) {
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(password, salt, iterations, keyLength, 'sha256', (err, derivedKey) => {
        if (err) {
          reject(err);
        } else {
          resolve(derivedKey.toString('hex'));
        }
      });
    });
  }

  // ============================================
  // JWT HELPERS
  // ============================================

  generateJWTSecret() {
    return this.randomString(64);
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  base64Encode(data) {
    if (typeof data === 'object') {
      data = JSON.stringify(data);
    }
    return Buffer.from(data).toString('base64');
  }

  base64Decode(encodedData, parseJson = false) {
    const decoded = Buffer.from(encodedData, 'base64').toString('utf8');
    return parseJson ? JSON.parse(decoded) : decoded;
  }

  urlSafeBase64Encode(data) {
    return this.base64Encode(data)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  urlSafeBase64Decode(encodedData, parseJson = false) {
    let base64 = encodedData
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    
    // Add padding if necessary
    while (base64.length % 4) {
      base64 += '=';
    }
    
    return this.base64Decode(base64, parseJson);
  }

  // ============================================
  // VALIDATION METHODS
  // ============================================

  isValidHash(hash) {
    return typeof hash === 'string' && 
           hash.length === 64 && 
           /^[a-f0-9]+$/.test(hash);
  }

  isValidToken(token, minLength = 16) {
    return typeof token === 'string' && 
           token.length >= minLength;
  }

  isValidKeyFormat(key) {
    if (typeof key !== 'string') return false;
    
    // Check for PEM format
    if (key.includes('-----BEGIN') && key.includes('-----END')) {
      return true;
    }
    
    // Check for base64 format
    try {
      Buffer.from(key, 'base64');
      return true;
    } catch {
      return false;
    }
  }

  // ============================================
  // SECURITY UTILITIES
  // ============================================

  constantTimeCompare(a, b) {
    try {
      return crypto.timingSafeEqual(
        Buffer.from(a),
        Buffer.from(b)
      );
    } catch {
      return false;
    }
  }

  generateCSRFToken() {
    return this.randomString(32);
  }

  generateSessionId() {
    return `sess_${this.randomString(24)}`;
  }

  // ============================================
  // BATCH OPERATIONS
  // ============================================

  async hashMultiple(tokens) {
    const hashes = {};
    for (const token of tokens) {
      hashes[token] = this.hashToken(token);
    }
    return hashes;
  }

  async encryptMultiple(dataObjects, password = null) {
    const encrypted = {};
    for (const [key, value] of Object.entries(dataObjects)) {
      encrypted[key] = this.encrypt(JSON.stringify(value), password);
    }
    return encrypted;
  }

  async decryptMultiple(encryptedObjects, password = null) {
    const decrypted = {};
    for (const [key, value] of Object.entries(encryptedObjects)) {
      try {
        decrypted[key] = JSON.parse(this.decrypt(value, password));
      } catch (error) {
        decrypted[key] = null;
      }
    }
    return decrypted;
  }
}

module.exports = new CryptoUtils();