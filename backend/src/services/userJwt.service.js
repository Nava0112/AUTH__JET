const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const database = require('../utils/database');
const logger = require('../utils/logger');
const ApplicationKeyService = require('./applicationKey.service');
const Session = require('../models/Session');
const User = require('../models/User');

/**
 * User JWT Service
 * 
 * Handles JWT operations for end users of client applications.
 * UPDATED: Now uses ApplicationKeyService for application-level keys.
 */
class UserJwtService {
  constructor() {
    this.accessTokenExpiry = 15 * 60; // 15 minutes
    this.refreshTokenExpiry = 7 * 24 * 60 * 60; // 7 days
  }

  /**
   * Generate access token for a user
   * FIXED: Uses application's key, not client's key
   * 
   * @param {number} userId - User database ID
   * @param {number} applicationId - Application ID (not client ID!)
   * @param {Object} additionalClaims - Extra claims to include
   * @returns {string} Signed JWT
   */
  async generateAccessToken(userId, applicationId, additionalClaims = {}) {
    try {
      const payload = {
        sub: userId.toString(),
        type: 'user',
        application_id: applicationId,
        iat: Math.floor(Date.now() / 1000),
        ...additionalClaims
      };

      // Sign with APPLICATION's key (not client's key!)
      const token = await ApplicationKeyService.signJwt(applicationId, payload);

      logger.debug('User access token generated', {
        userId,
        applicationId,
        expiresIn: this.accessTokenExpiry
      });

      return token;

    } catch (error) {
      logger.error('Failed to generate user access token:', error);
      throw error;
    }
  }

  /**
   * Verify access token
   * FIXED: Uses application's public key
   * 
   * @param {string} token - JWT to verify
   * @param {number} applicationId - Application ID
   * @returns {Object} Decoded token payload
   */
  async verifyAccessToken(token, applicationId) {
    try {
      const decoded = await ApplicationKeyService.verifyJwt(applicationId, token);

      logger.debug('User access token verified', {
        userId: decoded.sub,
        applicationId: decoded.application_id
      });

      return decoded;

    } catch (error) {
      logger.warn('User access token verification failed:', error.message);
      throw error;
    }
  }

  /**
   * Generate refresh token for a user
   * FIXED: Uses polymorphic sessions table
   * 
   * @param {number} userId - User database ID
   * @param {number} applicationId - Application ID
   * @param {string} ipAddress - User's IP address
   * @returns {string} Refresh token
   */
  async generateRefreshToken(userId, applicationId, ipAddress, userAgent) {
    try {
      const refreshToken = crypto.randomBytes(40).toString('hex');
      const hashedToken = crypto
        .createHash('sha256')
        .update(refreshToken)
        .digest('hex');

      await Session.create({
        session_type: 'user',
        entity_id: userId,
        refresh_token: hashedToken,
        ip_address: ipAddress,
        user_agent: userAgent
      });

      logger.debug('User refresh token generated', {
        userId,
        applicationId
      });

      return refreshToken;
    } catch (error) {
      logger.error('Refresh token generation error:', error);
      throw error;
    }
  }

  /**
   * Refresh tokens using a refresh token
   * FIXED: Uses polymorphic sessions and application keys
   * 
   * @param {string} refreshToken - The refresh token
   * @param {number} applicationId - Application ID
   * @returns {Object} New tokens
   */
  async refreshTokens(refreshToken, applicationId) {
    try {
      const hashedToken = crypto
        .createHash('sha256')
        .update(refreshToken)
        .digest('hex');

      const session = await Session.findByRefreshToken(hashedToken);

      if (!session || session.session_type !== 'user') {
        throw new Error('Invalid or expired refresh token');
      }

      const userId = session.entity_id;

      const user = await User.findById(userId);
      if (!user || user.application_id !== parseInt(applicationId)) {
        throw new Error('User does not belong to this application');
      }

      if (!user.is_active) {
        throw new Error('User account is inactive');
      }

      // Generate new access token
      const newAccessToken = await this.generateAccessToken(
        userId,
        applicationId,
        {
          email: user.email,
          role: user.role,
          email_verified: user.email_verified
        }
      );

      // Generate new refresh token
      const newRefreshToken = await this.generateRefreshToken(
        userId,
        applicationId,
        session.ip_address,
        session.user_agent
      );

      // Revoke old refresh token
      await Session.revoke(hashedToken);

      logger.info('Tokens refreshed', { userId, applicationId });

      return {
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
        token_type: 'Bearer',
        expires_in: this.accessTokenExpiry
      };
    } catch (error) {
      logger.error('Token refresh error:', error);
      throw error;
    }
  }

  async revokeRefreshToken(tokenHash) {
    try {
      await Session.revoke(tokenHash);
      logger.debug('Refresh token revoked', {
        tokenHash: tokenHash.substring(0, 16) + '...'
      });
    } catch (error) {
      logger.error('Revoke refresh token error:', error);
      throw error;
    }
  }

  /**
   * Revoke all sessions for a user
   * 
   * @param {number} userId - User database ID
   */
  async revokeAllUserSessions(userId) {
    try {
      const revokedCount = await Session.revokeAllForEntity('user', userId);
      logger.info('All user sessions revoked', { userId, count: revokedCount });
      return { revoked: revokedCount };
    } catch (error) {
      logger.error('Revoke all user sessions error:', error);
      throw error;
    }
  }

  /**
   * Get active sessions for a user
   * 
   * @param {number} userId - User database ID
   * @returns {Array} Active sessions
   */
  async getActiveSessions(userId) {
    try {
      const query = `
        SELECT 
          id,
          ip_address,
          user_agent,
          created_at,
          expires_at
        FROM sessions 
        WHERE entity_id = $1 
          AND session_type = 'user'
          AND (revoked = false OR revoked IS NULL) 
          AND expires_at > NOW()
        ORDER BY created_at DESC
      `;

      const result = await database.query(query, [userId]);

      return result.rows;

    } catch (error) {
      logger.error('Get active sessions error:', error);
      throw error;
    }
  }

  /**
   * Revoke a specific session
   * 
   * @param {number} sessionId - Session database ID
   * @param {number} userId - User ID (for verification)
   */
  async revokeSession(sessionId, userId) {
    try {
      await Session.revokeById(sessionId, 'user', userId);
      logger.info('Session revoked', { sessionId, userId });
    } catch (error) {
      logger.error('Revoke session error:', error);
      throw error;
    }
  }
}

module.exports = new UserJwtService();