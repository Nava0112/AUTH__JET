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
   * Convert custom client_id string to database client ID
   */
  async getClientDbId(clientId) {
    // Check if clientId is already a numeric database ID
    if (!isNaN(clientId) && Number.isInteger(Number(clientId))) {
      return parseInt(clientId);
    }

    // If it's a string client_id (like "cli_..."), look up the numeric ID
    const clientQuery = await database.query(
      'SELECT id FROM clients WHERE client_id = $1',
      [clientId]
    );

    if (clientQuery.rows.length === 0) {
      throw new Error('Client not found');
    }

    return clientQuery.rows[0].id;
  }

  /**
   * Generate RSA key pair for a client - FIXED VERSION
   */
  async generateKeyPair(clientId) {
    try {
      // Convert custom client_id string to database client ID
      const clientDbId = await this.getClientDbId(clientId);

      logger.info('Generating RSA key pair for client', { clientId, clientDbId });

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

      // Store keys in database - use clientDbId (integer)
      const query = `
        INSERT INTO client_keys (
          client_id, key_id, public_key, private_key_encrypted, 
          algorithm, key_type, key_size, kid
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;

      const result = await database.query(query, [
        clientDbId, // Use database ID here
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
   * Encrypt private key for secure storage - FIXED GCM VERSION
   */
  encryptPrivateKey(privateKey) {
    try {
      const iv = crypto.randomBytes(16); // 16 bytes for GCM
      const keyBuffer = Buffer.from(this.encryptionKey, 'hex');

      // Use AES-GCM for authenticated encryption
      const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);

      let encrypted = cipher.update(privateKey, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Get auth tag for GCM
      const authTag = cipher.getAuthTag();

      return JSON.stringify({
        iv: iv.toString('hex'),
        data: encrypted,
        authTag: authTag.toString('hex')
      });
    } catch (error) {
      logger.error('Failed to encrypt private key:', error);
      throw error;
    }
  }

  /**
   * Decrypt private key for signing - FIXED GCM VERSION
   */
  decryptPrivateKey(encryptedData) {
    try {
      const dataObj = JSON.parse(encryptedData);
      const { iv, authTag } = dataObj;
      const ciphertext = dataObj.data || dataObj.encrypted;

      if (!iv || !ciphertext) {
        throw new Error('Invalid encrypted data format: missing iv or ciphertext');
      }

      const keyBuffer = Buffer.from(this.encryptionKey, 'hex');
      const ivBuffer = Buffer.from(iv, 'hex');

      if (authTag) {
        // Use AES-GCM for decryption
        const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, ivBuffer);
        decipher.setAuthTag(Buffer.from(authTag, 'hex'));

        let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
      } else {
        // Fallback to AES-CBC for older keys (if any)
        logger.warn('Decryption falling back to aes-256-cbc (missing authTag)');
        const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, ivBuffer);
        let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
      }
    } catch (error) {
      logger.error('Failed to decrypt private key:', error);
      throw error;
    }
  }

  /**
   * Get active key for a client - FIXED VERSION
   */
  async getActiveKey(clientId) {
    try {
      // Convert custom client_id string to database client ID
      const clientDbId = await this.getClientDbId(clientId);

      const query = `
        SELECT * FROM client_keys 
        WHERE client_id = $1 AND is_active = true 
        ORDER BY created_at DESC 
        LIMIT 1
      `;

      const result = await database.query(query, [clientDbId]);

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
   * Get active key pair for a client - FIXED VERSION
   */
  async getActiveKeyPair(clientId) {
    try {
      // Convert custom client_id string to database client ID
      const clientDbId = await this.getClientDbId(clientId);

      const query = `
        SELECT * FROM client_keys 
        WHERE client_id = $1 AND is_active = true 
        ORDER BY created_at DESC 
        LIMIT 1
      `;

      const result = await database.query(query, [clientDbId]);

      if (result.rows.length === 0) {
        return null;
      }

      const key = result.rows[0];

      // Decrypt private key
      if (key.private_key_encrypted) {
        key.private_key = this.decryptPrivateKey(key.private_key_encrypted);
      }

      return key;
    } catch (error) {
      logger.error('Failed to get active key pair for client:', error);
      throw error;
    }
  }

  /**
   * Get public JWK for a client's key - FIXED VERSION
   */
  async getPublicJwk(clientId, keyId = null) {
    try {
      // Convert custom client_id string to database client ID
      const clientDbId = await this.getClientDbId(clientId);

      let query, params;

      if (keyId) {
        query = `SELECT * FROM client_keys WHERE client_id = $1 AND key_id = $2`;
        params = [clientDbId, keyId];
      } else {
        query = `SELECT * FROM client_keys WHERE client_id = $1 AND is_active = true ORDER BY created_at DESC LIMIT 1`;
        params = [clientDbId];
      }

      const result = await database.query(query, params);

      if (result.rows.length === 0) {
        throw new Error('No key found for client');
      }

      const key = result.rows[0];
      return this.generateProperJwkFromPublicKey(key.public_key, key.kid);
    } catch (error) {
      logger.error('Failed to get public JWK for client:', error);
      throw error;
    }
  }

  /**
   * Generate proper JWK from public key - FIXED VERSION
   * Extracts actual RSA modulus (n) and exponent (e) from PEM
   */
  generateProperJwkFromPublicKey(publicKeyPem, kid) {
    try {
      // Create public key object from PEM
      const publicKey = crypto.createPublicKey(publicKeyPem);

      // Export as JWK to get proper n and e values
      const jwk = publicKey.export({ format: 'jwk' });

      return {
        kty: jwk.kty,
        use: 'sig',
        alg: 'RS256',
        kid: kid,
        n: jwk.n,  // RSA modulus (base64url encoded)
        e: jwk.e   // RSA exponent (base64url encoded)
      };
    } catch (error) {
      logger.error('Failed to generate proper JWK from public key:', error);

      // Fallback method if the above fails
      return this.generateJwkFallback(publicKeyPem, kid);
    }
  }

  /**
   * Fallback method to extract RSA components from PEM
   */
  generateJwkFallback(publicKeyPem, kid) {
    try {
      // Parse PEM to extract ASN.1 structure
      const publicKey = crypto.createPublicKey(publicKeyPem);

      // Get the key in DER format
      const der = publicKey.export({ format: 'der', type: 'spki' });

      // For Node.js < 15 or if export fails, use manual parsing
      // This is a simplified approach - in production, use a proper ASN.1 parser
      const asn1 = this.parseRsaPublicKey(der);

      return {
        kty: 'RSA',
        use: 'sig',
        alg: 'RS256',
        kid: kid,
        n: asn1.n,
        e: asn1.e
      };
    } catch (error) {
      logger.error('Fallback JWK generation also failed:', error);
      throw new Error('Failed to convert public key to JWK format');
    }
  }

  /**
   * Simple RSA public key parser (basic implementation)
   */
  parseRsaPublicKey(derBuffer) {
    try {
      // This is a very basic parser for RSA public keys
      // In production, consider using a proper ASN.1 library like 'asn1.js'

      // RSA public key structure in DER is typically:
      // SEQUENCE { SEQUENCE { OID, NULL }, BITSTRING { SEQUENCE { n, e } } }

      // For now, use the crypto module's built-in capability
      const publicKey = crypto.createPublicKey({
        key: derBuffer,
        format: 'der',
        type: 'spki'
      });

      // Try to export as JWK again
      const jwk = publicKey.export({ format: 'jwk' });

      if (jwk.kty === 'RSA' && jwk.n && jwk.e) {
        return {
          n: jwk.n,
          e: jwk.e
        };
      }

      throw new Error('Could not extract RSA components');
    } catch (error) {
      logger.error('Failed to parse RSA public key:', error);
      throw error;
    }
  }

  /**
   * Sign JWT with client's private key - FIXED VERSION
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
   * Verify JWT with client's public key - FIXED VERSION
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
   * Rotate client keys (generate new, revoke old) - FIXED VERSION
   */
  async rotateKeys(clientId) {
    try {
      // Convert custom client_id string to database client ID
      const clientDbId = await this.getClientDbId(clientId);

      // Revoke current active key
      const revokeQuery = `
        UPDATE client_keys 
        SET is_active = false, revoked_at = NOW() 
        WHERE client_id = $1 AND is_active = true
      `;
      await database.query(revokeQuery, [clientDbId]);

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
   * Get all keys for a client (for management) - FIXED VERSION
   */
  async getClientKeys(clientId) {
    try {
      // Convert custom client_id string to database client ID
      const clientDbId = await this.getClientDbId(clientId);

      const query = `
        SELECT 
          key_id, kid, algorithm, key_type, key_size,
          is_active, created_at, revoked_at
        FROM client_keys 
        WHERE client_id = $1 
        ORDER BY created_at DESC
      `;

      const result = await database.query(query, [clientDbId]);
      return result.rows;
    } catch (error) {
      logger.error('Failed to get client keys:', error);
      throw error;
    }
  }

  /**
   * Revoke a specific key - FIXED VERSION
   */
  async revokeKey(clientId, keyId) {
    try {
      // Convert custom client_id string to database client ID
      const clientDbId = await this.getClientDbId(clientId);

      const query = `
        UPDATE client_keys 
        SET is_active = false, revoked_at = NOW() 
        WHERE client_id = $1 AND key_id = $2
        RETURNING key_id
      `;

      const result = await database.query(query, [clientDbId, keyId]);

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

  /**
   * Test JWK generation for a specific key - FIXED VERSION
   */
  async testJwkGeneration(clientId) {
    try {
      const key = await this.getActiveKeyPair(clientId);
      if (!key) {
        throw new Error('No active key found');
      }

      const jwk = await this.generateProperJwkFromPublicKey(key.public_key, key.kid);

      logger.info('JWK generation test successful', {
        clientId,
        kid: jwk.kid,
        n_length: jwk.n ? jwk.n.length : 0,
        e: jwk.e
      });

      return jwk;
    } catch (error) {
      logger.error('JWK generation test failed:', error);
      throw error;
    }
  }

  /**
   * Get key by key ID - FIXED VERSION
   */
  async getKeyByKeyId(clientId, keyId) {
    try {
      // Convert custom client_id string to database client ID
      const clientDbId = await this.getClientDbId(clientId);

      const query = `
        SELECT * FROM client_keys 
        WHERE client_id = $1 AND key_id = $2
      `;

      const result = await database.query(query, [clientDbId, keyId]);

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
      logger.error('Failed to get key by key ID:', error);
      throw error;
    }
  }

  // Add this temporary debug method to your ClientKeyService
  async debugEncryptionIssue(clientId) {
    try {
      // Get the encrypted data from database
      const clientDbId = await this.getClientDbId(clientId);
      const result = await database.query(
        'SELECT private_key_encrypted FROM client_keys WHERE client_id = $1 AND is_active = true',
        [clientDbId]
      );

      if (result.rows.length === 0) {
        return { error: 'No key found' };
      }

      const encryptedData = result.rows[0].private_key_encrypted;
      const { iv, data, authTag } = JSON.parse(encryptedData);

      console.log('Encryption details:', {
        ivLength: iv.length,
        dataLength: data.length,
        authTagLength: authTag.length,
        encryptionKey: this.encryptionKey,
        encryptionKeyLength: this.encryptionKey.length
      });

      // Try to decrypt with current key
      try {
        const keyBuffer = Buffer.from(this.encryptionKey, 'hex');
        const ivBuffer = Buffer.from(iv, 'hex');
        const authTagBuffer = Buffer.from(authTag, 'hex');

        const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, ivBuffer);
        decipher.setAuthTag(authTagBuffer);

        let decrypted = decipher.update(data, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return { success: true, decryptedLength: decrypted.length };
      } catch (decryptError) {
        return {
          success: false,
          error: decryptError.message,
          currentKey: this.encryptionKey
        };
      }
    } catch (error) {
      return { error: error.message };
    }
  }

  /**
   * Check if client has any active keys - FIXED VERSION
   */
  async hasActiveKey(clientId) {
    try {
      // Convert custom client_id string to database client ID
      const clientDbId = await this.getClientDbId(clientId);

      const query = `
        SELECT COUNT(*) as key_count FROM client_keys 
        WHERE client_id = $1 AND is_active = true
      `;

      const result = await database.query(query, [clientDbId]);
      return parseInt(result.rows[0].key_count) > 0;
    } catch (error) {
      logger.error('Failed to check active keys:', error);
      throw error;
    }
  }
}

module.exports = new ClientKeyService();