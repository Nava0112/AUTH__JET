const ClientKeyService = require('./clientKey.service');
const database = require('../utils/database');
const logger = require('../utils/logger');

class JWTService {
  constructor() {
    this.accessTokenExpiry = 15 * 60; // 15 minutes
    this.refreshTokenExpiry = 7 * 24 * 60 * 60; // 7 days
  }

  /**
   * Generate access token using client's specific key
   */
  async generateAccessToken(userId, userType, clientId, additionalClaims = {}) {
    try {
      const payload = {
        sub: userId.toString(),
        user_type: userType,
        client_id: clientId,
        iat: Math.floor(Date.now() / 1000),
        ...additionalClaims
      };

      // Use client's specific key for signing
      const token = await ClientKeyService.signJwt(clientId, payload);
      
      logger.auth('Access token generated with client key', { 
        userId, 
        userType, 
        clientId
      });
      
      return token;
    } catch (error) {
      logger.error('Failed to generate access token:', error);
      throw error;
    }
  }

  /**
   * Generate refresh token (MATCHES YOUR EXACT SCHEMA)
   */
  async generateRefreshToken(userId, clientId, deviceInfo = {}) {
    try {
      const refreshToken = require('crypto').randomBytes(40).toString('hex');
      const hashedToken = require('crypto').createHash('sha256').update(refreshToken).digest('hex');
      
      const expiresAt = new Date(Date.now() + this.refreshTokenExpiry * 1000);

      // PERFECT MATCH: Uses only columns that exist in your schema
      const query = `
        INSERT INTO sessions (
          user_id, client_id, session_type, refresh_token, expires_at, ip_address
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `;
      
      const result = await database.query(query, [
        userId, 
        clientId, 
        'user', // session_type
        hashedToken, 
        expiresAt,
        deviceInfo.ip_address || '127.0.0.1'
        // Note: No user_agent column in your schema
      ]);

      logger.auth('Refresh token generated', { userId, clientId });
      return refreshToken;
    } catch (error) {
      logger.error('Refresh token generation error:', error);
      throw error;
    }
  }

  /**
   * Verify token using client's specific public key
   */
  async verifyToken(token, clientId = null) {
    try {
      // If clientId not provided, extract from token
      if (!clientId) {
        const decoded = require('jsonwebtoken').decode(token);
        clientId = decoded.client_id;
        
        if (!clientId && decoded.iss) {
          // Extract from issuer: "client-{id}"
          const match = decoded.iss.match(/client-(\d+)/);
          clientId = match ? match[1] : null;
        }
      }

      if (!clientId) {
        throw new Error('Client ID required for token verification');
      }

      // Use client's specific key for verification
      const decoded = await ClientKeyService.verifyJwt(clientId, token);
      
      logger.auth('Token verified with client key', { 
        userId: decoded.sub, 
        clientId: decoded.client_id 
      });
      
      return decoded;
    } catch (error) {
      logger.warn('Token verification failed:', error.message);
      throw error;
    }
  }

  /**
   * Refresh tokens using client's key
   */
  async refreshTokens(refreshToken) {
    try {
      const hashedToken = require('crypto').createHash('sha256').update(refreshToken).digest('hex');
      
      // Updated query for your exact sessions schema
      const query = `
        SELECT s.*, u.email, u.email_verified, c.id as client_id
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        JOIN clients c ON s.client_id = c.id
        WHERE s.refresh_token = $1 AND s.expires_at > NOW() AND (s.revoked = false OR s.revoked IS NULL)
      `;

      const result = await database.query(query, [hashedToken]);
      
      if (result.rows.length === 0) {
        throw new Error('Invalid or expired refresh token');
      }

      const session = result.rows[0];
      
      // Generate new access token with client's key
      const newAccessToken = await this.generateAccessToken(
        session.user_id,
        'user', // Default to user type
        session.client_id,
        {
          email: session.email,
          email_verified: session.email_verified,
        }
      );

      // Generate new refresh token
      const deviceInfo = {
        ip_address: session.ip_address
        // No user_agent in your schema
      };
      
      const newRefreshToken = await this.generateRefreshToken(
        session.user_id,
        session.client_id,
        deviceInfo
      );

      // Revoke old refresh token
      await this.revokeRefreshToken(hashedToken);

      logger.auth('Tokens refreshed with client key', { 
        userId: session.user_id, 
        clientId: session.client_id 
      });

      return {
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
        token_type: 'Bearer',
        expires_in: this.accessTokenExpiry,
      };
    } catch (error) {
      logger.error('Token refresh error:', error);
      throw error;
    }
  }

  /**
   * Revoke refresh token
   */
  async revokeRefreshToken(tokenHash) {
    try {
      const query = `
        UPDATE sessions 
        SET revoked = true, revoked_at = NOW() 
        WHERE refresh_token = $1
      `;
      
      await database.query(query, [tokenHash]);
      logger.auth('Refresh token revoked', { tokenHash: tokenHash.substring(0, 16) + '...' });
    } catch (error) {
      logger.error('Revoke refresh token error:', error);
      throw error;
    }
  }

  /**
   * Get public JWKS for a specific client
   */
  async getPublicJwks(clientId) {
    try {
      const jwk = await ClientKeyService.getPublicJwk(clientId);
      return { keys: [jwk] };
    } catch (error) {
      logger.error('Failed to get JWKS for client:', error);
      throw error;
    }
  }

  /**
   * Get single public JWK (for platform-level JWKS)
   */
  getPublicJwk() {
    try {
      // Return platform-level public key if available
      const publicKey = process.env.JWT_PUBLIC_KEY;
      if (!publicKey) {
        return null;
      }

      // Convert PEM to JWK format (simplified)
      const crypto = require('crypto');
      const keyObject = crypto.createPublicKey(publicKey);
      const jwk = keyObject.export({ format: 'jwk' });
      
      return {
        ...jwk,
        use: 'sig',
        alg: 'RS256',
        kid: 'platform-key-1'
      };
    } catch (error) {
      logger.warn('Failed to generate public JWK:', error.message);
      return null;
    }
  }

  // Session management methods updated for your schema
  async revokeAllUserSessions(userId, clientId) {
    try {
      const query = `
        UPDATE sessions 
        SET revoked = true, revoked_at = NOW() 
        WHERE user_id = $1 AND client_id = $2 AND (revoked = false OR revoked IS NULL)
      `;
      
      await database.query(query, [userId, clientId]);
      logger.auth('All user sessions revoked', { userId, clientId });
    } catch (error) {
      logger.error('Revoke all user sessions error:', error);
      throw error;
    }
  }

  async getActiveSessions(userId, clientId) {
    try {
      const query = `
        SELECT id, ip_address, created_at
        FROM sessions 
        WHERE user_id = $1 AND client_id = $2 AND (revoked = false OR revoked IS NULL) AND expires_at > NOW()
        ORDER BY created_at DESC
      `;
      
      const result = await database.query(query, [userId, clientId]);
      return result.rows;
    } catch (error) {
      logger.error('Get active sessions error:', error);
      throw error;
    }
  }
}

module.exports = new JWTService();