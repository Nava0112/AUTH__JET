const database = require('../utils/database');
const crypto = require('../utils/crypto');
const logger = require('../utils/logger');

class User {
  static async create(userData) {
    const { email, password, email_verified = false } = userData;
    
    try {
      const passwordHash = password ? await crypto.hashPassword(password) : null;
      
      const query = `
        INSERT INTO users (email, password_hash, email_verified)
        VALUES ($1, $2, $3)
        RETURNING *
      `;
      
      const result = await database.query(query, [
        email.toLowerCase(),
        passwordHash,
        email_verified
      ]);
      
      return result.rows[0];
    } catch (error) {
      logger.error('User creation error:', error);
      throw error;
    }
  }

  static async findByEmail(email) {
    try {
      const query = 'SELECT * FROM users WHERE email = $1';
      const result = await database.query(query, [email.toLowerCase()]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Find user by email error:', error);
      throw error;
    }
  }

  static async findById(id) {
    try {
      const query = 'SELECT * FROM users WHERE id = $1';
      const result = await database.query(query, [id]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Find user by ID error:', error);
      throw error;
    }
  }

  static async update(id, updates) {
    try {
      const allowedFields = ['email', 'email_verified', 'status', 'last_login'];
      const updateFields = [];
      const values = [];
      let paramCount = 0;

      allowedFields.forEach(field => {
        if (updates[field] !== undefined) {
          paramCount++;
          updateFields.push(`${field} = $${paramCount}`);
          values.push(updates[field]);
        }
      });

      if (updateFields.length === 0) {
        throw new Error('No valid fields to update');
      }

      paramCount++;
      updateFields.push('updated_at = NOW()');
      values.push(id);

      const query = `
        UPDATE users 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `;

      const result = await database.query(query, values);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('User update error:', error);
      throw error;
    }
  }

  static async incrementLoginCount(id) {
    try {
      const query = `
        UPDATE users 
        SET login_count = login_count + 1, last_login = NOW(), updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;
      
      const result = await database.query(query, [id]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Increment login count error:', error);
      throw error;
    }
  }

  static async findByClient(clientId, userId) {
    try {
      const query = `
        SELECT u.*, cu.roles, cu.custom_data
        FROM users u
        JOIN client_users cu ON u.id = cu.user_id
        WHERE u.id = $1 AND cu.client_id = $2
      `;
      
      const result = await database.query(query, [userId, clientId]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Find user by client error:', error);
      throw error;
    }
  }

  static async listByClient(clientId, options = {}) {
    try {
      const { page = 1, limit = 20, search } = options;
      const offset = (page - 1) * limit;

      let query = `
        SELECT u.*, cu.roles, cu.custom_data
        FROM users u
        JOIN client_users cu ON u.id = cu.user_id
        WHERE cu.client_id = $1
      `;
      
      let countQuery = `
        SELECT COUNT(*)
        FROM users u
        JOIN client_users cu ON u.id = cu.user_id
        WHERE cu.client_id = $1
      `;
      
      const params = [clientId];
      let paramCount = 1;

      if (search) {
        paramCount++;
        query += ` AND u.email ILIKE $${paramCount}`;
        countQuery += ` AND u.email ILIKE $${paramCount}`;
        params.push(`%${search}%`);
      }

      paramCount++;
      query += ` ORDER BY u.created_at DESC LIMIT $${paramCount}`;
      params.push(limit);

      paramCount++;
      query += ` OFFSET $${paramCount}`;
      params.push(offset);

      const [usersResult, countResult] = await Promise.all([
        database.query(query, params),
        database.query(countQuery, params.slice(0, -2)),
      ]);

      return {
        users: usersResult.rows,
        total: parseInt(countResult.rows[0].count),
        page,
        limit,
        pages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
      };
    } catch (error) {
      logger.error('List users by client error:', error);
      throw error;
    }
  }

  static async delete(id) {
    try {
      const client = await database.getClient();
      
      try {
        await client.query('BEGIN');

        // Delete related records first
        await client.query('DELETE FROM sessions WHERE user_id = $1', [id]);
        await client.query('DELETE FROM client_users WHERE user_id = $1', [id]);
        await client.query('DELETE FROM audit_logs WHERE user_id = $1', [id]);
        await client.query('DELETE FROM failed_logins WHERE email = (SELECT email FROM users WHERE id = $1)', [id]);
        
        // Delete user
        const result = await client.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
        
        await client.query('COMMIT');
        client.release();

        return result.rows[0] || null;
      } catch (error) {
        await client.query('ROLLBACK');
        client.release();
        throw error;
      }
    } catch (error) {
      logger.error('User deletion error:', error);
      throw error;
    }
  }

  static async getStats(clientId, period = '30d') {
    try {
      let interval;
      switch (period) {
        case '24h': interval = '1 day'; break;
        case '7d': interval = '7 days'; break;
        case '30d': interval = '30 days'; break;
        default: interval = '30 days';
      }

      const queries = {
        total: `
          SELECT COUNT(*) as count
          FROM client_users 
          WHERE client_id = $1 AND created_at > NOW() - INTERVAL '${interval}'
        `,
        active: `
          SELECT COUNT(DISTINCT user_id) as count
          FROM sessions 
          WHERE client_id = $1 AND created_at > NOW() - INTERVAL '${interval}'
        `,
        verified: `
          SELECT COUNT(*) as count
          FROM users u
          JOIN client_users cu ON u.id = cu.user_id
          WHERE cu.client_id = $1 AND u.email_verified = true
        `,
        newToday: `
          SELECT COUNT(*) as count
          FROM client_users 
          WHERE client_id = $1 AND DATE(created_at) = CURRENT_DATE
        `,
      };

      const stats = {};
      
      for (const [key, query] of Object.entries(queries)) {
        const result = await database.query(query, [clientId]);
        stats[key] = parseInt(result.rows[0].count) || 0;
      }

      return stats;
    } catch (error) {
      logger.error('Get user stats error:', error);
      throw error;
    }
  }
}

module.exports = User;