const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const logger = require('./logger');

class CryptoUtils {
  constructor() {
    this.saltRounds = 12;
  }

  async hashPassword(password) {
    try {
      const salt = await bcrypt.genSalt(this.saltRounds);
      const hash = await bcrypt.hash(password, salt);
      return hash;
    } catch (error) {
      logger.error('Password hashing error:', error);
      throw new Error('Failed to hash password');
    }
  }

  async verifyPassword(password, hash) {
    try {
      const isValid = await bcrypt.compare(password, hash);
      return isValid;
    } catch (error) {
      logger.error('Password verification error:', error);
      throw new Error('Failed to verify password');
    }
  }

  async verifyHash(data, hash) {
    try {
      const isValid = await bcrypt.compare(data, hash);
      return isValid;
    } catch (error) {
      logger.error('Hash verification error:', error);
      throw new Error('Failed to verify hash');
    }
  }

  randomString(length = 32) {
    return crypto.randomBytes(length).toString('hex').slice(0, length);
  }

  generateApiKey(prefix = 'cli') {
    return `${prefix}_${this.randomString(16)}`;
  }

  generateSecretKey() {
    return this.randomString(32);
  }

  generateHMACSignature(data, secret) {
    return crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(data))
      .digest('hex');
  }

  verifyHMACSignature(data, signature, secret) {
    const expectedSignature = this.generateHMACSignature(data, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  encryptText(text, key) {
    const algorithm = 'aes-256-gcm';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(algorithm, key);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      iv: iv.toString('hex'),
      data: encrypted,
      authTag: authTag.toString('hex'),
    };
  }

  decryptText(encryptedData, key) {
    const algorithm = 'aes-256-gcm';
    const decipher = crypto.createDecipher(algorithm, key);
    
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  generateToken(length = 64) {
    return this.randomString(length);
  }

  hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  generateUUID() {
    return crypto.randomUUID();
  }

  generateCode(length = 6) {
    const chars = '0123456789';
    let code = '';
    for (let i = 0; i < length; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }
  // Add missing createHash method for compatibility
  createHash(algorithm) {
    return crypto.createHash(algorithm);
  }

  // Add missing randomBytes method for compatibility
  randomBytes(size) {
    return crypto.randomBytes(size);
  }

}

module.exports = new CryptoUtils();