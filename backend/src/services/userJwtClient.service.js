const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const database = require('../utils/database');
const logger = require('../utils/logger');
const ClientKeyService = require('./clientKey.service');

/**
 * User JWT Service using CLIENT-SPECIFIC RSA keys
 * This is the CORRECT implementation for multi-tenant architecture
 * 
 * Each client has their own RSA key pair in client_keys table
 * User tokens are signed with the client's private key
 * Client applications verify tokens with their public key from JWKS endpoint
 */
class UserJwtClientService {
  constructor() {
    this.algorithm = 'RS256';
    this.accessTokenExpiry = process.env.NODE_ENV === 'production' ? '1h' : '15m';
    this.refreshTokenExpiryMs = 7 * 24 * 60 * 60 * 1000; // 7 days
  }

  /**
   * Generate access token signed with CLIENT'S private key
   */
  async generateAccessToken(user, clientId, applicationId) {
    try {
      // Get client's active key
      const key = await ClientKeyService.getActiveKey(clientId);
      
      if (!key || !key.private_key) {
        throw new Error(`No active RSA key found for client ${clientId}. Client must generate keys first.`);
      }

      const tokenPayload = {
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        client_id: clientId,
        application_id: applicationId,
        iss: `authjet-client-${clientId}`, // Issuer identifies the client
        aud: `application-${applicationId}`, // Audience is the specific application
        iat: Math.floor(Date.now() / 1000),
      };

      return new Promise((resolve, reject) => {
        jwt.sign(
          tokenPayload, 
          key.private_key, 
          { 
            algorithm: this.algorithm,
            expiresIn: this.accessTokenExpiry,
            keyid: key.kid // Include key ID in JWT header
          }, 
          (err, token) => {
            if (err) {
              logger.error('Failed to generate client-specific access token:', err);
              reject(err);
            } else {
              logger.info('Access token generated with client key', { 
                clientId, 
                applicationId, 
                userId: user.id,
                kid: key.kid 
              });
              resolve(token);
            }
          }
        );
      });
    } catch (error) {
      logger.error('Failed to generate client-specific access token:', error);
      throw error;
    }
  }

  /**
   * Generate refresh token and store in database
   */
  async generateRefreshToken(userId, clientId, applicationId) {
    try {
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

      logger.info('Refresh token generated', { userId, clientId, applicationId });

      return refreshToken;
    } catch (error) {
      logger.error('Failed to generate refresh token:', error);
      throw error;
    }
  }

  /**
   * Verify token with CLIENT'S public key
   */
  async verifyToken(token, clientId) {
    try {
      // Get client's active key
      const key = await ClientKeyService.getActiveKey(clientId);
      
      if (!key) {
        throw new Error(`No active key found for client ${clientId}`);
      }

      return new Promise((resolve, reject) => {
        jwt.verify(
          token, 
          key.public_key, 
          { 
            algorithms: [this.algorithm],
            issuer: `authjet-client-${clientId}`
          }, 
          (err, decoded) => {
            if (err) {
              logger.warn('Token verification failed:', err.message);
              reject(err);
            } else {
              resolve(decoded);
            }
          }
        );
      });
    } catch (error) {
      logger.error('Failed to verify token:', error);
      throw error;
    }
  }

  /**
   * Refresh tokens - generates new access and refresh tokens
   */
  async refreshTokens(refreshToken) {
    try {
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

      // Generate new tokens with CLIENT-SPECIFIC keys
      const user = {
        id: session.user_id,
        email: session.email,
        name: session.name,
        role: session.role
      };

      const newAccessToken = await this.generateAccessToken(
        user,
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

      logger.info('Tokens refreshed successfully', { 
        userId: session.user_id, 
        clientId: session.client_id 
      });

      return {
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
        token_type: 'Bearer',
        expires_in: process.env.NODE_ENV === 'production' ? 3600 : 900,
      };
    } catch (error) {
      logger.error('Failed to refresh tokens:', error);
      throw error;
    }
  }

  /**
   * Revoke a specific refresh token
   */
  async revokeRefreshToken(refreshToken) {
    const query = `
      UPDATE user_sessions 
      SET revoked = true, revoked_at = NOW() 
      WHERE refresh_token = $1
    `;
    
    await database.query(query, [refreshToken]);
    logger.info('Refresh token revoked', { refreshToken: refreshToken.substring(0, 8) + '...' });
  }

  /**
   * Revoke all sessions for a user
   */
  async revokeAllUserSessions(userId, clientId, applicationId) {
    const query = `
      UPDATE user_sessions 
      SET revoked = true, revoked_at = NOW() 
      WHERE user_id = $1 AND client_id = $2 AND application_id = $3 AND revoked = false
    `;
    
    await database.query(query, [userId, clientId, applicationId]);
    logger.info('All user sessions revoked', { userId, clientId, applicationId });
  }

  /**
   * Generate token pair (access + refresh) for a user
   */
  async generateTokenPair(user, clientId, applicationId) {
    try {
      const accessToken = await this.generateAccessToken(user, clientId, applicationId);
      const refreshToken = await this.generateRefreshToken(user.id, clientId, applicationId);

      return {
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'Bearer',
        expires_in: process.env.NODE_ENV === 'production' ? 3600 : 900,
      };
    } catch (error) {
      logger.error('Failed to generate token pair:', error);
      throw error;
    }
  }
}

module.exports = new UserJwtClientService();

