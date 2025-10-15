const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const database = require('../utils/database');
const logger = require('../utils/logger');

class UserJWTService {
  constructor() {
    this.algorithm = 'RS256';
    this.accessTokenExpiry = process.env.NODE_ENV === 'production' ? '1h' : '15m';
    this.refreshTokenExpiryMs = 7 * 24 * 60 * 60 * 1000; // 7 days
    this.issuer = 'authjet-saas';
    this.audience = 'client-app-users';
    
    this.privateKey = this.loadOrGeneratePrivateKey();
    this.publicKey = this.loadOrGeneratePublicKey();
  }

  loadOrGeneratePrivateKey() {
    const keyPath = path.join(__dirname, '../../keys/private.key');
    
    try {
      if (fs.existsSync(keyPath)) {
        return fs.readFileSync(keyPath, 'utf8');
      }
      
      // Generate new RSA key pair
      const { generateKeyPairSync } = require('crypto');
      const { privateKey, publicKey } = generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem'
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem'
        }
      });
      
      // Ensure directory exists
      const keysDir = path.dirname(keyPath);
      if (!fs.existsSync(keysDir)) {
        fs.mkdirSync(keysDir, { recursive: true });
      }
      
      // Save keys
      fs.writeFileSync(keyPath, privateKey);
      fs.writeFileSync(path.join(__dirname, '../../keys/public.key'), publicKey);
      
      logger.info('Generated new RSA key pair for JWT');
      return privateKey;
      
    } catch (error) {
      logger.error('Failed to load/generate JWT keys:', error);
      throw error;
    }
  }

  loadOrGeneratePublicKey() {
    const keyPath = path.join(__dirname, '../../keys/public.key');
    return fs.readFileSync(keyPath, 'utf8');
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