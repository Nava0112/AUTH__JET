const crypto = require('crypto');
const database = require('../utils/database');
const logger = require('../utils/logger');

class ClientKeyService {
  constructor() {
    this.algorithm = 'RS256';
    this.keySize = 2048;
    this.accessTokenExpiry = 15 * 60; // 15 minutes
    
    // Use a fixed encryption key for development
    this.encryptionKey = process.env.KEY_ENCRYPTION_KEY || this.getFixedEncryptionKey();
  }

  /**
   * Get fixed encryption key for development
   */
  getFixedEncryptionKey() {
    // Use a fixed key for development to avoid regeneration issues
    const fixedKey = 'authjet-dev-encryption-key-32-chars-long!';
    logger.warn('KEY_ENCRYPTION_KEY not set. Using development key. Set KEY_ENCRYPTION_KEY in production.');
    return Buffer.from(fixedKey).toString('hex').substring(0, 64); // 32 bytes hex
  }

  /**
   * Generate RSA key pair for a client
   */
  async generateKeyPair(clientId) {
    try {
      logger.info('Generating RSA key pair for client', { clientId });

      // Check if client already has an active key
      const existingKey = await this.getActiveKey(clientId);
      if (existingKey) {
        throw new Error('Client already has an active key. Revoke it first or use key rotation.');
      }

      const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: this.keySize,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem',
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem',
        },
      });

      // Generate unique key IDs
      const keyId = `key_${crypto.randomBytes(8).toString('hex')}`;
      const kid = `kid_${crypto.randomBytes(6).toString('hex')}`;

      // Encrypt private key for storage
      const encryptedPrivateKey = this.encryptPrivateKey(privateKey);

      // Store keys in database
      const query = `
        INSERT INTO client_keys (
          client_id, key_id, public_key, private_key_encrypted, 
          algorithm, key_type, key_size, kid
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;

      const result = await database.query(query, [
        clientId,
        keyId,
        publicKey,
        encryptedPrivateKey,
        this.algorithm,
        'RSA',
        this.keySize,
        kid
      ]);

      logger.info('RSA key pair generated and stored for client', { 
        clientId, 
        keyId,
        kid 
      });

      return {
        keyId,
        kid,
        publicKey,
        privateKey, // Only returned once during generation
        algorithm: this.algorithm
      };

    } catch (error) {
      logger.error('Failed to generate key pair for client:', error);
      throw error;
    }
  }

  /**
   * Encrypt private key for secure storage (SIMPLIFIED VERSION)
   */
  encryptPrivateKey(privateKey) {
    try {
      const iv = crypto.randomBytes(16);
      const keyBuffer = Buffer.from(this.encryptionKey, 'hex');
      
      const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv);
      
      let encrypted = cipher.update(privateKey, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      return JSON.stringify({
        iv: iv.toString('hex'),
        data: encrypted
      });
    } catch (error) {
      logger.error('Failed to encrypt private key:', error);
      throw error;
    }
  }

  /**
   * Decrypt private key for signing (SIMPLIFIED VERSION)
   */
  decryptPrivateKey(encryptedData) {
    try {
      const { iv, data } = JSON.parse(encryptedData);
      const keyBuffer = Buffer.from(this.encryptionKey, 'hex');
      const ivBuffer = Buffer.from(iv, 'hex');
      
      const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, ivBuffer);
      
      let decrypted = decipher.update(data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      logger.error('Failed to decrypt private key:', error);
      throw error;
    }
  }

  /**
   * Get active key for a client
   */
  async getActiveKey(clientId) {
    try {
      const query = `
        SELECT * FROM client_keys 
        WHERE client_id = $1 AND is_active = true 
        ORDER BY created_at DESC 
        LIMIT 1
      `;

      const result = await database.query(query, [clientId]);
      
      if (result.rows.length === 0) {
        return null;
      }

      const key = result.rows[0];
      
      // Decrypt private key if needed
      if (key.private_key_encrypted) {
        key.private_key = this.decryptPrivateKey(key.private_key_encrypted);
      }

      return key;
    } catch (error) {
      logger.error('Failed to get active key for client:', error);
      throw error;
    }
  }

  /**
   * Get public JWK for a client's key
   */
  async getPublicJwk(clientId, keyId = null) {
    try {
      let query, params;
      
      if (keyId) {
        query = `SELECT * FROM client_keys WHERE client_id = $1 AND key_id = $2`;
        params = [clientId, keyId];
      } else {
        query = `SELECT * FROM client_keys WHERE client_id = $1 AND is_active = true ORDER BY created_at DESC LIMIT 1`;
        params = [clientId];
      }

      const result = await database.query(query, params);
      
      if (result.rows.length === 0) {
        throw new Error('No key found for client');
      }

      const key = result.rows[0];
      return this.generateJwkFromPublicKey(key.public_key, key.kid);
    } catch (error) {
      logger.error('Failed to get public JWK for client:', error);
      throw error;
    }
  }

  /**
   * Generate JWK from public key
   */
  generateJwkFromPublicKey(publicKeyPem, kid) {
    try {
      // Simplified JWK - use base64 encoded public key
      const publicKeyBase64 = Buffer.from(publicKeyPem).toString('base64url');
      
      return {
        kty: 'RSA',
        use: 'sig',
        alg: 'RS256',
        kid: kid,
        n: publicKeyBase64,
        e: 'AQAB'
      };
    } catch (error) {
      logger.error('Failed to generate JWK from public key:', error);
      throw error;
    }
  }

  /**
   * Sign JWT with client's private key
   */
  async signJwt(clientId, payload) {
    try {
      const key = await this.getActiveKey(clientId);
      
      if (!key || !key.private_key) {
        throw new Error('No active key found for client');
      }

      return new Promise((resolve, reject) => {
        const jwt = require('jsonwebtoken');
        
        jwt.sign(
          payload, 
          key.private_key, 
          { 
            algorithm: this.algorithm,
            keyid: key.kid,
            issuer: `client-${clientId}`,
            expiresIn: this.accessTokenExpiry
          }, 
          (err, token) => {
            if (err) {
              logger.error('JWT signing error:', err);
              reject(err);
            } else {
              resolve(token);
            }
          }
        );
      });
    } catch (error) {
      logger.error('Failed to sign JWT for client:', error);
      throw error;
    }
  }

  /**
   * Verify JWT with client's public key
   */
  async verifyJwt(clientId, token) {
    try {
      const key = await this.getActiveKey(clientId);
      
      if (!key) {
        throw new Error('No active key found for client');
      }

      return new Promise((resolve, reject) => {
        const jwt = require('jsonwebtoken');
        
        jwt.verify(
          token, 
          key.public_key, 
          { 
            algorithms: [this.algorithm],
            issuer: `client-${clientId}`
          }, 
          (err, decoded) => {
            if (err) {
              reject(err);
            } else {
              resolve(decoded);
            }
          }
        );
      });
    } catch (error) {
      logger.error('Failed to verify JWT for client:', error);
      throw error;
    }
  }

  /**
   * Rotate client keys (generate new, revoke old)
   */
  async rotateKeys(clientId) {
    try {
      // Revoke current active key
      const revokeQuery = `
        UPDATE client_keys 
        SET is_active = false, revoked_at = NOW() 
        WHERE client_id = $1 AND is_active = true
      `;
      await database.query(revokeQuery, [clientId]);

      // Generate new key pair
      const newKey = await this.generateKeyPair(clientId);

      logger.info('Key rotation completed for client', { clientId });

      return newKey;
    } catch (error) {
      logger.error('Failed to rotate keys for client:', error);
      throw error;
    }
  }

  /**
   * Get all keys for a client (for management)
   */
  async getClientKeys(clientId) {
    try {
      const query = `
        SELECT 
          key_id, kid, algorithm, key_type, key_size,
          is_active, created_at, revoked_at
        FROM client_keys 
        WHERE client_id = $1 
        ORDER BY created_at DESC
      `;

      const result = await database.query(query, [clientId]);
      return result.rows;
    } catch (error) {
      logger.error('Failed to get client keys:', error);
      throw error;
    }
  }

  /**
   * Revoke a specific key
   */
  async revokeKey(clientId, keyId) {
    try {
      const query = `
        UPDATE client_keys 
        SET is_active = false, revoked_at = NOW() 
        WHERE client_id = $1 AND key_id = $2
        RETURNING key_id
      `;

      const result = await database.query(query, [clientId, keyId]);
      
      if (result.rows.length === 0) {
        throw new Error('Key not found');
      }

      logger.info('Key revoked', { clientId, keyId });
      return result.rows[0];
    } catch (error) {
      logger.error('Failed to revoke key:', error);
      throw error;
    }
  }
}

module.exports = new ClientKeyService();