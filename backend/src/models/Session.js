const database = require('../utils/database');
const crypto = require('../utils/crypto');
const logger = require('../utils/logger');

class Session {
  static async create(sessionData) {
    const { user_id, client_id, refresh_token, device_info = {}, ip_address } = sessionData;
    
    try {
      const refreshTokenHash = crypto.hashToken(refresh_token);
      const expiresAt = new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)); // 7 days

      const query = `
        INSERT INTO sessions (
          user_id, client_id, refresh_token_hash, device_info, ip_address, expires_at
        ) 
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;
      
      const result = await database.query(query, [
        user_id,
        client_id,
        refreshTokenHash,
        JSON.stringify(device_info),
        ip_address,
        expiresAt,
      ]);

      return result.rows[0];
    } catch (error) {
      logger.error('Session creation error:', error);
      throw error;
    }
  }

  static async findByRefreshToken(refreshToken) {
    try {
      const refreshTokenHash = crypto.hashToken(refreshToken);
      
      const query = `
        SELECT s.*, u.email, u.email_verified, c.id as client_id
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        JOIN clients c ON s.client_id = c.id
        WHERE s.refresh_token_hash = $1 AND s.expires_at > NOW() AND s.revoked = false
      `;
      
      const result = await database.query(query, [refreshTokenHash]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Find session by refresh token error:', error);
      throw error;
    }
  }

  static async findByUserId(userId, clientId) {
    try {
      const query = `
        SELECT id, device_info, ip_address, created_at, last_used_at, expires_at
        FROM sessions 
        WHERE user_id = $1 AND client_id = $2 AND revoked = false AND expires_at > NOW()
        ORDER BY last_used_at DESC
      `;
      
      const result = await database.query(query, [userId, clientId]);
      return result.rows;
    } catch (error) {
      logger.error('Find sessions by user ID error:', error);
      throw error;
    }
  }

  static async revoke(refreshTokenHash) {
    try {
      const query = `
        UPDATE sessions 
        SET revoked = true, revoked_at = NOW() 
        WHERE refresh_token_hash = $1
        RETURNING id
      `;
      
      const result = await database.query(query, [refreshTokenHash]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Revoke session error:', error);
      throw error;
    }
  }

  static async revokeById(sessionId, userId, clientId) {
    try {
      const query = `
        UPDATE sessions 
        SET revoked = true, revoked_at = NOW() 
        WHERE id = $1 AND user_id = $2 AND client_id = $3
        RETURNING id
      `;
      
      const result = await database.query(query, [sessionId, userId, clientId]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Revoke session by ID error:', error);
      throw error;
    }
  }

  static async revokeAllUserSessions(userId, clientId) {
    try {
      const query = `
        UPDATE sessions 
        SET revoked = true, revoked_at = NOW() 
        WHERE user_id = $1 AND client_id = $2 AND revoked = false
        RETURNING COUNT(*) as revoked_count
      `;
      
      const result = await database.query(query, [userId, clientId]);
      return parseInt(result.rows[0].revoked_count) || 0;
    } catch (error) {
      logger.error('Revoke all user sessions error:', error);
      throw error;
    }
  }

  static async updateLastUsed(sessionId) {
    try {
      const query = `
        UPDATE sessions 
        SET last_used_at = NOW() 
        WHERE id = $1
        RETURNING id
      `;
      
      const result = await database.query(query, [sessionId]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Update session last used error:', error);
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

  static async getActiveSessionsCount(clientId) {
    try {
      const query = `
        SELECT COUNT(*) as count
        FROM sessions 
        WHERE client_id = $1 AND revoked = false AND expires_at > NOW()
      `;
      
      const result = await database.query(query, [clientId]);
      return parseInt(result.rows[0].count) || 0;
    } catch (error) {
      logger.error('Get active sessions count error:', error);
      throw error;
    }
  }

  static async getSessionStats(clientId, period = '30d') {
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
          WHERE client_id = $1 AND created_at > NOW() - INTERVAL '${interval}'
        `,
        activeSessions: `
          SELECT COUNT(*) as count
          FROM sessions 
          WHERE client_id = $1 AND revoked = false AND expires_at > NOW()
        `,
        revokedSessions: `
          SELECT COUNT(*) as count
          FROM sessions 
          WHERE client_id = $1 AND revoked = true AND created_at > NOW() - INTERVAL '${interval}'
        `,
        avgSessionDuration: `
          SELECT AVG(EXTRACT(EPOCH FROM (last_used_at - created_at))) as avg_duration
          FROM sessions 
          WHERE client_id = $1 AND last_used_at IS NOT NULL AND created_at > NOW() - INTERVAL '${interval}'
        `,
      };

      const stats = {};
      
      for (const [key, query] of Object.entries(queries)) {
        const result = await database.query(query, [clientId]);
        stats[key] = result.rows[0];
      }

      return {
        total_sessions: parseInt(stats.totalSessions.count) || 0,
        active_sessions: parseInt(stats.activeSessions.count) || 0,
        revoked_sessions: parseInt(stats.revokedSessions.count) || 0,
        avg_session_duration: parseFloat(stats.avgSessionDuration.avg_duration) || 0,
      };
    } catch (error) {
      logger.error('Get session stats error:', error);
      throw error;
    }
  }
}

module.exports = Session;