const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const database = require('../utils/database');
const logger = require('../utils/logger');

class UserJWTService {
  constructor() {
    this.algorithm = 'RS256';
    this.accessTokenExpiry = process.env.NODE_ENV === 'production' ? '1h' : '15m';
    this.refreshTokenExpiryMs = 7 * 24 * 60 * 60 * 1000; // 7 days
    this.issuer = 'authjet-saas';
    this.audience = 'client-app-users';
    
    this.privateKey = this.loadPrivateKeyFromEnv();
    this.publicKey = this.loadPublicKeyFromEnv();
    
    // Remove validation in constructor to prevent startup crashes
    this.validateKeysAsync().catch(error => {
      logger.warn('Initial key validation failed, but continuing:', error.message);
    });
  }

  loadPrivateKeyFromEnv() {
    try {
      let privateKey = process.env.JWT_PRIVATE_KEY;
      
      if (!privateKey) {
        // Fallback to file-based keys if env vars not set
        logger.warn('JWT_PRIVATE_KEY not found in environment, checking for key files...');
        return this.loadPrivateKeyFromFile();
      }

      // Handle different key formats
      privateKey = privateKey.trim();
      
      // If it contains BEGIN PRIVATE KEY, it's likely PEM format
      if (privateKey.includes('BEGIN PRIVATE KEY')) {
        return privateKey.replace(/\\n/g, '\n');
      }
      
      // If it's base64 encoded without PEM headers, try to decode
      try {
        const decoded = Buffer.from(privateKey, 'base64').toString('utf8');
        if (decoded.includes('BEGIN')) {
          return decoded.replace(/\\n/g, '\n');
        }
      } catch (e) {
        // Not base64, use as-is
      }
      
      // If we get here, assume it's PEM format but might need formatting
      return this.formatPemKey(privateKey, 'PRIVATE KEY');
      
    } catch (error) {
      logger.error('Failed to load private key:', error);
      throw new Error('JWT private key configuration error');
    }
  }

  loadPublicKeyFromEnv() {
    try {
      let publicKey = process.env.JWT_PUBLIC_KEY;
      
      if (!publicKey) {
        // Fallback to file-based keys if env vars not set
        logger.warn('JWT_PUBLIC_KEY not found in environment, checking for key files...');
        return this.loadPublicKeyFromFile();
      }

      // Handle different key formats
      publicKey = publicKey.trim();
      
      // If it contains BEGIN PUBLIC KEY, it's likely PEM format
      if (publicKey.includes('BEGIN PUBLIC KEY')) {
        return publicKey.replace(/\\n/g, '\n');
      }
      
      // If it's base64 encoded without PEM headers, try to decode
      try {
        const decoded = Buffer.from(publicKey, 'base64').toString('utf8');
        if (decoded.includes('BEGIN')) {
          return decoded.replace(/\\n/g, '\n');
        }
      } catch (e) {
        // Not base64, use as-is
      }
      
      // If we get here, assume it's PEM format but might need formatting
      return this.formatPemKey(publicKey, 'PUBLIC KEY');
      
    } catch (error) {
      logger.error('Failed to load public key:', error);
      throw new Error('JWT public key configuration error');
    }
  }

  // Fallback to file-based keys for backward compatibility
  loadPrivateKeyFromFile() {
    const fs = require('fs');
    const path = require('path');
    const keyPath = path.join(__dirname, '../../keys/private.key');
    
    if (fs.existsSync(keyPath)) {
      logger.info('Loading private key from file');
      return fs.readFileSync(keyPath, 'utf8');
    }
    
    throw new Error('No JWT private key found in environment or files');
  }

  loadPublicKeyFromFile() {
    const fs = require('fs');
    const path = require('path');
    const keyPath = path.join(__dirname, '../../keys/public.key');
    
    if (fs.existsSync(keyPath)) {
      logger.info('Loading public key from file');
      return fs.readFileSync(keyPath, 'utf8');
    }
    
    throw new Error('No JWT public key found in environment or files');
  }

  formatPemKey(key, keyType) {
    // Ensure proper PEM formatting
    let formattedKey = key.trim();
    
    // Add PEM headers if missing
    if (!formattedKey.includes('BEGIN')) {
      formattedKey = `-----BEGIN ${keyType}-----\n${formattedKey}\n-----END ${keyType}-----`;
    }
    
    // Ensure proper newlines
    formattedKey = formattedKey.replace(/\\n/g, '\n');
    formattedKey = formattedKey.replace(/ /g, '\n');
    
    return formattedKey;
  }

  async validateKeysAsync() {
    try {
      // Simple test to verify keys work
      const testPayload = { test: true, iat: Math.floor(Date.now() / 1000) };
      const token = jwt.sign(testPayload, this.privateKey, { 
        algorithm: this.algorithm,
        expiresIn: '1m'
      });
      
      const decoded = jwt.verify(token, this.publicKey, { algorithms: [this.algorithm] });
      
      if (decoded.test) {
        logger.info('JWT keys validated successfully');
        return true;
      }
    } catch (error) {
      logger.warn('JWT key validation failed (this might be OK if keys are being rotated):', error.message);
      return false;
    }
  }

  async generateAccessToken(user, clientId, applicationId) {
    const tokenPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      client_id: clientId,
      application_id: applicationId,
      role: user.role,
      iss: this.issuer,
      aud: this.audience,
      iat: Math.floor(Date.now() / 1000),
    };

    return new Promise((resolve, reject) => {
      jwt.sign(tokenPayload, this.privateKey, { 
        algorithm: this.algorithm,
        expiresIn: this.accessTokenExpiry 
      }, (err, token) => {
        if (err) {
          logger.error('Failed to generate access token:', err);
          reject(err);
        } else {
          resolve(token);
        }
      });
    });
  }

  async generateRefreshToken(userId, clientId, applicationId) {
    const refreshToken = crypto.randomBytes(40).toString('hex');
    const expiresAt = new Date(Date.now() + this.refreshTokenExpiryMs);

    // Store refresh token in database
    const query = `
      INSERT INTO user_sessions (
        user_id, client_id, application_id, refresh_token,
        expires_at, use_count
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `;
    
    await database.query(query, [
      userId, 
      clientId, 
      applicationId, 
      refreshToken,
      expiresAt,
      0 // Initial use count
    ]);

    return refreshToken;
  }

  async verifyToken(token) {
    return new Promise((resolve, reject) => {
      jwt.verify(token, this.publicKey, { algorithms: [this.algorithm] }, (err, decoded) => {
        if (err) {
          logger.warn('Token verification failed:', err.message);
          reject(err);
        } else {
          resolve(decoded);
        }
      });
    });
  }

  async refreshTokens(refreshToken) {
    // Find and validate refresh token
    const query = `
      SELECT us.*, u.email, u.name, u.role, u.is_active
      FROM user_sessions us
      JOIN users u ON us.user_id = u.id
      WHERE us.refresh_token = $1 AND us.expires_at > NOW() AND us.revoked = false AND u.is_active = true
    `;

    const result = await database.query(query, [refreshToken]);
    
    if (result.rows.length === 0) {
      throw new Error('Invalid or expired refresh token');
    }

    const session = result.rows[0];
    
    // Check use count - allow up to 3 uses
    if (session.use_count >= 3) {
      await this.revokeRefreshToken(refreshToken);
      throw new Error('Refresh token exceeded maximum uses');
    }

    // Generate new tokens
    const newAccessToken = await this.generateAccessToken(
      { id: session.user_id, email: session.email, name: session.name, role: session.role },
      session.client_id,
      session.application_id
    );

    const newRefreshToken = await this.generateRefreshToken(
      session.user_id,
      session.client_id,
      session.application_id
    );

    // Increment use count of old token
    await database.query(
      'UPDATE user_sessions SET use_count = use_count + 1 WHERE refresh_token = $1',
      [refreshToken]
    );

    return {
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      token_type: 'Bearer',
      expires_in: process.env.NODE_ENV === 'production' ? 3600 : 900, // 1h or 15m
    };
  }

  async revokeRefreshToken(refreshToken) {
    const query = `
      UPDATE user_sessions 
      SET revoked = true, revoked_at = NOW() 
      WHERE refresh_token = $1
    `;
    
    await database.query(query, [refreshToken]);
  }

  async revokeAllUserSessions(userId, clientId, applicationId) {
    const query = `
      UPDATE user_sessions 
      SET revoked = true, revoked_at = NOW() 
      WHERE user_id = $1 AND client_id = $2 AND application_id = $3 AND revoked = false
    `;
    
    await database.query(query, [userId, clientId, applicationId]);
  }
}

module.exports = new UserJWTService();