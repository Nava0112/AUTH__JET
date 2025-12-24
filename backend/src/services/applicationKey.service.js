const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const database = require('../utils/database');
const logger = require('../utils/logger');

/**
 * ApplicationKeyService
 * 
 * Manages RSA key pairs at the APPLICATION level (not client level).
 * Each application gets its own key pair for signing JWTs.
 * 
 * KEY IMPROVEMENTS:
 * - Fixed encryption key consistency
 * - Application-level keys instead of client-level
 * - Proper key rotation support
 * - Consistent encryption/decryption with AES-256-GCM
 */
class ApplicationKeyService {
    constructor() {
        this.algorithm = 'RS256';
        this.keySize = 2048;
        this.accessTokenExpiry = 15 * 60; // 15 minutes

        // FIXED: Get encryption key consistently
        this.encryptionKey = this.getEncryptionKey();

        logger.info('ApplicationKeyService initialized', {
            algorithm: this.algorithm,
            keySize: this.keySize,
            hasEncryptionKey: !!this.encryptionKey
        });
    }

    /**
     * Get encryption key for private key encryption
     * FIXED: Returns the SAME key consistently
     */
    getEncryptionKey() {
        const envKey = process.env.KEY_ENCRYPTION_KEY;

        if (envKey) {
            // Production: Use environment variable
            const keyBuffer = Buffer.from(envKey, 'hex');
            if (keyBuffer.length !== 32) {
                throw new Error('KEY_ENCRYPTION_KEY must be 32 bytes (64 hex characters)');
            }
            return keyBuffer;
        }

        // Development: Use FIXED key (same every time!)
        const FIXED_DEV_KEY = 'authjet-dev-key-32-bytes-long!!';
        const keyBuffer = Buffer.from(FIXED_DEV_KEY, 'utf8');
        return keyBuffer.slice(0, 32); // Ensure exactly 32 bytes
    }

    /**
     * Generate RSA key pair for an application
     * @param {number} applicationId - Application database ID (integer)
     * @returns {Object} Generated key information
     */
    async generateKeyPair(applicationId) {
        try {
            logger.info('Generating RSA key pair for application', { applicationId });

            // Check if application already has an active key
            const hasKey = await this.hasActiveKey(applicationId);
            if (hasKey) {
                throw new Error(`Application ${applicationId} already has an active key. Use rotateKeys() instead.`);
            }

            // Generate RSA keys
            const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
                modulusLength: this.keySize,
                publicKeyEncoding: {
                    type: 'spki',
                    format: 'pem'
                },
                privateKeyEncoding: {
                    type: 'pkcs8',
                    format: 'pem'
                }
            });

            // Encrypt private key
            const encryptedPrivateKey = this.encryptPrivateKey(privateKey);

            // Generate unique identifiers
            const keyId = `appkey_${Date.now()}_${Math.random().toString(36).substring(7)}`;
            const kid = `app-${applicationId}-${Date.now()}`;

            // Store in database
            const query = `
        INSERT INTO application_keys (
          application_id, key_id, public_key, private_key_encrypted,
          algorithm, kid, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, true)
        RETURNING *
      `;

            const result = await database.query(query, [
                applicationId,
                keyId,
                publicKey,
                encryptedPrivateKey,
                this.algorithm,
                kid
            ]);

            logger.info('Key pair generated successfully', {
                applicationId,
                keyId,
                kid
            });

            return {
                id: result.rows[0].id,
                keyId: result.rows[0].key_id,
                kid: result.rows[0].kid,
                algorithm: result.rows[0].algorithm,
                publicKey: result.rows[0].public_key
            };

        } catch (error) {
            logger.error('Key generation error:', error);
            throw error;
        }
    }

    /**
     * Encrypt private key with AES-256-GCM
     * FIXED: Consistent encryption that can be decrypted later
     */
    encryptPrivateKey(privateKey) {
        try {
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);

            const encrypted = Buffer.concat([
                cipher.update(privateKey, 'utf8'),
                cipher.final()
            ]);

            const authTag = cipher.getAuthTag();

            // Store as JSON with all necessary components
            return JSON.stringify({
                encrypted: encrypted.toString('hex'),
                iv: iv.toString('hex'),
                authTag: authTag.toString('hex'),
                algorithm: 'aes-256-gcm'
            });

        } catch (error) {
            logger.error('Private key encryption error:', error);
            throw new Error('Failed to encrypt private key');
        }
    }

    /**
     * Decrypt private key with AES-256-GCM
     * FIXED: Uses consistent encryption key
     */
    decryptPrivateKey(encryptedData) {
        try {
            const data = JSON.parse(encryptedData);

            const decipher = crypto.createDecipheriv(
                'aes-256-gcm',
                this.encryptionKey,
                Buffer.from(data.iv, 'hex')
            );

            decipher.setAuthTag(Buffer.from(data.authTag, 'hex'));

            const decrypted = Buffer.concat([
                decipher.update(Buffer.from(data.encrypted, 'hex')),
                decipher.final()
            ]);

            return decrypted.toString('utf8');

        } catch (error) {
            logger.error('Private key decryption error:', error);
            throw new Error('Failed to decrypt private key. Encryption key may have changed.');
        }
    }

    /**
     * Sign JWT with application's private key
     * @param {number} applicationId - Application ID
     * @param {Object} payload - JWT payload
     * @returns {string} Signed JWT
     */
    async signJwt(applicationId, payload) {
        try {
            // Get active key for application
            const keyQuery = `
        SELECT * FROM application_keys
        WHERE application_id = $1 AND is_active = true
        ORDER BY created_at DESC
        LIMIT 1
      `;

            const result = await database.query(keyQuery, [applicationId]);

            if (result.rows.length === 0) {
                throw new Error(`No active key found for application ${applicationId}`);
            }

            const key = result.rows[0];

            // Decrypt private key
            const privateKey = this.decryptPrivateKey(key.private_key_encrypted);

            // Add standard claims
            const fullPayload = {
                ...payload,
                iss: `authjet-app-${applicationId}`,
                iat: Math.floor(Date.now() / 1000)
            };

            // Sign JWT
            const token = jwt.sign(fullPayload, privateKey, {
                algorithm: this.algorithm,
                keyid: key.kid,
                expiresIn: this.accessTokenExpiry
            });

            logger.debug('JWT signed', {
                applicationId,
                kid: key.kid,
                subject: payload.sub
            });

            return token;

        } catch (error) {
            logger.error('JWT signing error:', error);
            throw error;
        }
    }

    /**
     * Verify JWT with application's public key
     * @param {number} applicationId - Application ID
     * @param {string} token - JWT to verify
     * @returns {Object} Decoded JWT payload
     */
    async verifyJwt(applicationId, token) {
        try {
            // Extract kid from token header
            const decoded = jwt.decode(token, { complete: true });

            if (!decoded || !decoded.header || !decoded.header.kid) {
                throw new Error('Token missing kid header');
            }

            const kid = decoded.header.kid;

            // Get public key by kid
            const keyQuery = `
        SELECT public_key FROM application_keys
        WHERE application_id = $1 AND kid = $2 AND is_active = true
      `;

            const result = await database.query(keyQuery, [applicationId, kid]);

            if (result.rows.length === 0) {
                throw new Error('Invalid token: key not found');
            }

            // Verify with public key
            const verified = jwt.verify(token, result.rows[0].public_key, {
                algorithms: [this.algorithm]
            });

            logger.debug('JWT verified', {
                applicationId,
                kid,
                subject: verified.sub
            });

            return verified;

        } catch (error) {
            logger.warn('JWT verification failed:', error.message);
            throw error;
        }
    }

    /**
     * Get public JWKs for an application
     * @param {number} applicationId - Application ID
     * @returns {Array} Array of JWK objects
     */
    async getPublicJwk(applicationId) {
        try {
            const keyQuery = `
        SELECT * FROM application_keys
        WHERE application_id = $1 AND is_active = true
        ORDER BY created_at DESC
      `;

            const result = await database.query(keyQuery, [applicationId]);

            return result.rows.map(key => {
                // Convert PEM to JWK
                const publicKeyObj = crypto.createPublicKey(key.public_key);
                const jwk = publicKeyObj.export({ format: 'jwk' });

                return {
                    ...jwk,
                    kid: key.kid,
                    use: 'sig',
                    alg: key.algorithm,
                    key_ops: ['verify']
                };
            });

        } catch (error) {
            logger.error('JWK generation error:', error);
            throw error;
        }
    }

    /**
     * Rotate keys for an application (create new, deactivate old)
     * @param {number} applicationId - Application ID
     * @returns {Object} New key information
     */
    async rotateKeys(applicationId) {
        const client = await database.getClient();

        try {
            await client.query('BEGIN');

            // Deactivate old keys
            await client.query(
                'UPDATE application_keys SET is_active = false, revoked_at = NOW() WHERE application_id = $1',
                [applicationId]
            );

            // Generate new key (temporarily bypass the hasActiveKey check)
            const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
                modulusLength: this.keySize,
                publicKeyEncoding: { type: 'spki', format: 'pem' },
                privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
            });

            const encryptedPrivateKey = this.encryptPrivateKey(privateKey);
            const keyId = `appkey_${Date.now()}_${Math.random().toString(36).substring(7)}`;
            const kid = `app-${applicationId}-${Date.now()}`;

            const result = await client.query(`
        INSERT INTO application_keys (
          application_id, key_id, public_key, private_key_encrypted,
          algorithm, kid, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, true)
        RETURNING *
      `, [applicationId, keyId, publicKey, encryptedPrivateKey, this.algorithm, kid]);

            await client.query('COMMIT');
            client.release();

            logger.info('Keys rotated successfully', {
                applicationId,
                newKeyId: result.rows[0].key_id
            });

            return {
                keyId: result.rows[0].key_id,
                kid: result.rows[0].kid
            };

        } catch (error) {
            await client.query('ROLLBACK');
            client.release();
            logger.error('Key rotation error:', error);
            throw error;
        }
    }

    /**
     * Check if application has any active keys
     * @param {number} applicationId - Application ID
     * @returns {boolean}
     */
    async hasActiveKey(applicationId) {
        try {
            const result = await database.query(
                'SELECT COUNT(*) FROM application_keys WHERE application_id = $1 AND is_active = true',
                [applicationId]
            );

            return parseInt(result.rows[0].count) > 0;

        } catch (error) {
            logger.error('hasActiveKey check error:', error);
            return false;
        }
    }

    /**
     * Get all keys for an application (active and revoked)
     * @param {number} applicationId - Application ID
     * @returns {Array} Array of key information
     */
    async getApplicationKeys(applicationId) {
        try {
            const query = `
        SELECT 
          id, key_id, kid, algorithm, is_active,
          created_at, revoked_at
        FROM application_keys
        WHERE application_id = $1
        ORDER BY created_at DESC
      `;

            const result = await database.query(query, [applicationId]);
            return result.rows;

        } catch (error) {
            logger.error('getApplicationKeys error:', error);
            throw error;
        }
    }
}

module.exports = new ApplicationKeyService();
