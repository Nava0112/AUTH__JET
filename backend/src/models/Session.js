const database = require('../utils/database');
const crypto = require('../utils/crypto');
const logger = require('../utils/logger');

class Session {
  /**
   * Create a new session
   * @param {Object} sessionData - { session_type, entity_id, refresh_token, expires_at, ip_address, user_agent }
   */
  static async create(sessionData) {
    const {
      session_type,
      entity_id,
      refresh_token,
      expires_at,
      ip_address,
      user_agent
    } = sessionData;

    try {
      // Default expiry if not provided (7 days)
      const expiry = expires_at || new Date(Date.now() + (7 * 24 * 60 * 60 * 1000));

      const query = `
        INSERT INTO sessions (
          session_type, entity_id, refresh_token, expires_at, ip_address, user_agent
        ) 
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;

      const result = await database.query(query, [
        session_type,
        entity_id,
        refresh_token,
        expiry,
        ip_address,
        user_agent
      ]);

      return result.rows[0];
    } catch (error) {
      logger.error('Session creation error:', error);
      throw error;
    }
  }

  /**
   * Find an active session by refresh token
   * @param {string} refreshToken 
   */
  static async findByRefreshToken(refreshToken) {
    try {
      const query = `
        SELECT *
        FROM sessions
        WHERE refresh_token = $1 AND expires_at > NOW() AND revoked = false
      `;

      const result = await database.query(query, [refreshToken]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Find session by refresh token error:', error);
      throw error;
    }
  }

  /**
   * Find sessions for a specific entity
   * @param {string} type - 'admin', 'client', or 'user'
   * @param {number} entityId 
   */
  static async findByEntity(type, entityId) {
    try {
      const query = `
        SELECT id, ip_address, user_agent, created_at, expires_at
        FROM sessions 
        WHERE session_type = $1 AND entity_id = $2 AND revoked = false AND expires_at > NOW()
        ORDER BY created_at DESC
      `;

      const result = await database.query(query, [type, entityId]);
      return result.rows;
    } catch (error) {
      logger.error('Find sessions by entity error:', error);
      throw error;
    }
  }

  /**
   * Revoke a session by refresh token
   * @param {string} refreshToken 
   */
  static async revoke(refreshToken) {
    try {
      const query = `
        UPDATE sessions 
        SET revoked = true, revoked_at = NOW() 
        WHERE refresh_token = $1
        RETURNING id
      `;

      const result = await database.query(query, [refreshToken]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Revoke session error:', error);
      throw error;
    }
  }

  /**
   * Revoke a specific session by ID
   * @param {number} sessionId 
   * @param {string} type 
   * @param {number} entityId 
   */
  static async revokeById(sessionId, type, entityId) {
    try {
      const query = `
        UPDATE sessions 
        SET revoked = true, revoked_at = NOW() 
        WHERE id = $1 AND session_type = $2 AND entity_id = $3
        RETURNING id
      `;

      const result = await database.query(query, [sessionId, type, entityId]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Revoke session by ID error:', error);
      throw error;
    }
  }

  /**
   * Revoke all sessions for an entity
   * @param {string} type 
   * @param {number} entityId 
   */
  static async revokeAllForEntity(type, entityId) {
    try {
      const query = `
        UPDATE sessions 
        SET revoked = true, revoked_at = NOW() 
        WHERE session_type = $1 AND entity_id = $2 AND revoked = false
        RETURNING COUNT(*) as revoked_count
      `;

      const result = await database.query(query, [type, entityId]);
      return parseInt(result.rows[0].revoked_count) || 0;
    } catch (error) {
      logger.error('Revoke all sessions for entity error:', error);
      throw error;
    }
  }

  static async cleanupExpired() {
    try {
      const query = `
        DELETE FROM sessions 
        WHERE expires_at < NOW() OR revoked = true
        RETURNING COUNT(*) as deleted_count
      `;

      const result = await database.query(query);
      return parseInt(result.rows[0].deleted_count) || 0;
    } catch (error) {
      logger.error('Cleanup expired sessions error:', error);
      throw error;
    }
  }

  static async getActiveSessionsCount(type, entityId) {
    try {
      const query = `
        SELECT COUNT(*) as count
        FROM sessions 
        WHERE session_type = $1 AND entity_id = $2 AND revoked = false AND expires_at > NOW()
      `;

      const result = await database.query(query, [type, entityId]);
      return parseInt(result.rows[0].count) || 0;
    } catch (error) {
      logger.error('Get active sessions count error:', error);
      throw error;
    }
  }

  static async getSessionStats(type, entityId, period = '30d') {
    try {
      let interval;
      switch (period) {
        case '24h': interval = '1 day'; break;
        case '7d': interval = '7 days'; break;
        case '30d': interval = '30 days'; break;
        default: interval = '30 days';
      }

      const queries = {
        totalSessions: `
          SELECT COUNT(*) as count
          FROM sessions 
          WHERE session_type = $1 AND entity_id = $2 AND created_at > NOW() - INTERVAL '${interval}'
        `,
        activeSessions: `
          SELECT COUNT(*) as count
          FROM sessions 
          WHERE session_type = $1 AND entity_id = $2 AND revoked = false AND expires_at > NOW()
        `,
        revokedSessions: `
          SELECT COUNT(*) as count
          FROM sessions 
          WHERE session_type = $1 AND entity_id = $2 AND revoked = true AND created_at > NOW() - INTERVAL '${interval}'
        `
      };

      const stats = {};

      for (const [key, query] of Object.entries(queries)) {
        const result = await database.query(query, [type, entityId]);
        stats[key] = result.rows[0];
      }

      return {
        total_sessions: parseInt(stats.totalSessions.count) || 0,
        active_sessions: parseInt(stats.activeSessions.count) || 0,
        revoked_sessions: parseInt(stats.revokedSessions.count) || 0
      };
    } catch (error) {
      logger.error('Get session stats error:', error);
      throw error;
    }
  }
}

module.exports = Session;