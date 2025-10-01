const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const database = require('../utils/database');
const logger = require('../utils/logger');

class JWTService {
  constructor() {
    this.algorithm = 'HS256';
    this.accessTokenExpirySeconds = 15 * 60; // 15 minutes
    this.refreshTokenExpiryMs = 7 * 24 * 60 * 60 * 1000; // 7 days
    this.issuer = 'authjet-saas';
    this.audience = 'client-app';

    this.secret = process.env.JWT_SECRET;
    if (!this.secret) {
      this.secret = crypto.randomBytes(64).toString('hex');
      logger.warn('JWT_SECRET not set. Generated a temporary secret. Set JWT_SECRET in environment for stability.');
    }
  }

  getPublicJwk() {
    // For HMAC, this exposes the secret and should not be used in production.
    // Kept for compatibility with existing /.well-known/jwks.json endpoint in dev.
    return {
      kty: 'oct',
      use: 'sig',
      alg: this.algorithm,
      k: Buffer.from(this.secret).toString('base64url'),
    };
  }

  async generateAccessToken(payload) {
    const tokenPayload = {
      ...payload,
      iss: this.issuer,
      aud: this.audience,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + this.accessTokenExpirySeconds,
    };

    return new Promise((resolve, reject) => {
      jwt.sign(tokenPayload, this.secret, { algorithm: this.algorithm }, (err, token) => {
        if (err) {
          logger.error('Failed to generate access token:', err);
          reject(err);
        } else {
          resolve(token);
        }
      });
    });
  }

  async generateRefreshToken(userId, clientId, deviceInfo = {}) {
    const refreshToken = crypto.randomBytes(40).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(refreshToken).digest('hex');
    
    const expiresAt = new Date(Date.now() + this.refreshTokenExpiryMs);

    // Store refresh token in database
    const query = `
      INSERT INTO sessions (user_id, client_id, refresh_token_hash, device_info, expires_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `;
    
    await database.query(query, [
      userId, 
      clientId, 
      hashedToken, 
      JSON.stringify(deviceInfo), 
      expiresAt
    ]);

    return refreshToken;
  }

  async verifyToken(token) {
    return new Promise((resolve, reject) => {
      jwt.verify(token, this.secret, { algorithms: [this.algorithm] }, (err, decoded) => {
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
    const hashedToken = crypto.createHash('sha256').update(refreshToken).digest('hex');
    
    // Find and validate refresh token
    const query = `
      SELECT s.*, u.email, u.email_verified, c.id as client_id
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      JOIN clients c ON s.client_id = c.id
      WHERE s.refresh_token_hash = $1 AND s.expires_at > NOW() AND s.revoked = false
    `;

    const result = await database.query(query, [hashedToken]);
    
    if (result.rows.length === 0) {
      throw new Error('Invalid or expired refresh token');
    }

    const session = result.rows[0];
    
    // Generate new tokens
    const newAccessToken = await this.generateAccessToken({
      sub: session.user_id,
      email: session.email,
      client_id: session.client_id,
      email_verified: session.email_verified,
    });

    // Rotate refresh token (optional - for enhanced security)
    const newRefreshToken = await this.generateRefreshToken(
      session.user_id, 
      session.client_id, 
      session.device_info
    );

    // Revoke old refresh token
    await this.revokeRefreshToken(hashedToken);

    return {
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      token_type: 'Bearer',
      expires_in: 15 * 60, // 15 minutes
    };
  }

  async revokeRefreshToken(tokenHash) {
    const query = `
      UPDATE sessions 
      SET revoked = true, revoked_at = NOW() 
      WHERE refresh_token_hash = $1
    `;
    
    await database.query(query, [tokenHash]);
  }

  async revokeAllUserSessions(userId, clientId) {
    const query = `
      UPDATE sessions 
      SET revoked = true, revoked_at = NOW() 
      WHERE user_id = $1 AND client_id = $2 AND revoked = false
    `;
    
    await database.query(query, [userId, clientId]);
  }

  async getActiveSessions(userId, clientId) {
    const query = `
      SELECT id, device_info, ip_address, created_at, last_used_at
      FROM sessions 
      WHERE user_id = $1 AND client_id = $2 AND revoked = false AND expires_at > NOW()
      ORDER BY last_used_at DESC
    `;
    
    const result = await database.query(query, [userId, clientId]);
    return result.rows;
  }
}

module.exports = new JWTService();