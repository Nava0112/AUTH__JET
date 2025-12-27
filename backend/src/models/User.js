const database = require('../utils/database');
const crypto = require('../utils/crypto');
const logger = require('../utils/logger');

class User {
  /**
   * Create a new user
   * @param {Object} userData - { email, password, name, client_id, application_id, role, metadata }
   */
  static async create(userData) {
    const {
      email,
      password,
      name,
      client_id,
      application_id,
      role = 'user',
      metadata = {},
      email_verified = false
    } = userData;

    try {
      const passwordHash = password ? await crypto.hashPassword(password) : null;

      const query = `
        INSERT INTO users (
          email, password_hash, name, client_id, application_id, 
          role, metadata, email_verified
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;

      const result = await database.query(query, [
        email.toLowerCase(),
        passwordHash,
        name,
        client_id,
        application_id,
        role,
        JSON.stringify(metadata),
        email_verified
      ]);

      return result.rows[0];
    } catch (error) {
      logger.error('User creation error:', error);
      throw error;
    }
  }

  static async findByEmail(email, applicationId) {
    try {
      const query = 'SELECT * FROM users WHERE email = $1 AND application_id = $2';
      const result = await database.query(query, [email.toLowerCase(), applicationId]);
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
      const allowedFields = [
        'email', 'name', 'role', 'requested_role',
        'role_request_status', 'metadata', 'is_active',
        'email_verified', 'last_login', 'jwt_refresh_token'
      ];

      const updateFields = [];
      const values = [];
      let paramCount = 0;

      allowedFields.forEach(field => {
        if (updates[field] !== undefined) {
          paramCount++;
          updateFields.push(`${field} = $${paramCount}`);

          if (field === 'metadata') {
            values.push(JSON.stringify(updates[field]));
          } else {
            values.push(updates[field]);
          }
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

  static async listByApplication(applicationId, options = {}) {
    try {
      const { page = 1, limit = 20, search } = options;
      const offset = (page - 1) * limit;

      let query = `
        SELECT *
        FROM users 
        WHERE application_id = $1
      `;

      let countQuery = `
        SELECT COUNT(*)
        FROM users
        WHERE application_id = $1
      `;

      const params = [applicationId];
      let paramCount = 1;

      if (search) {
        paramCount++;
        query += ` AND (email ILIKE $${paramCount} OR name ILIKE $${paramCount})`;
        countQuery += ` AND (email ILIKE $${paramCount} OR name ILIKE $${paramCount})`;
        params.push(`%${search}%`);
      }

      paramCount++;
      query += ` ORDER BY created_at DESC LIMIT $${paramCount}`;
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
      logger.error('List users by application error:', error);
      throw error;
    }
  }

  static async delete(id) {
    try {
      // Direct delete since FKs should have ON DELETE CASCADE
      const query = 'DELETE FROM users WHERE id = $1 RETURNING id';
      const result = await database.query(query, [id]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('User deletion error:', error);
      throw error;
    }
  }

  static async getStats(applicationId) {
    try {
      const queries = {
        total: `
          SELECT COUNT(*) as count
          FROM users 
          WHERE application_id = $1
        `,
        active: `
          SELECT COUNT(*) as count
          FROM users 
          WHERE application_id = $1 AND is_active = true
        `,
        verified: `
          SELECT COUNT(*) as count
          FROM users 
          WHERE application_id = $1 AND email_verified = true
        `,
        pendingRequests: `
          SELECT COUNT(*) as count
          FROM users 
          WHERE application_id = $1 AND role_request_status = 'pending'
        `
      };

      const stats = {};

      for (const [key, query] of Object.entries(queries)) {
        const result = await database.query(query, [applicationId]);
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