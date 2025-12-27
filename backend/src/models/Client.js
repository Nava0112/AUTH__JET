const database = require('../utils/database');
const crypto = require('../utils/crypto');
const logger = require('../utils/logger');

class Client {
  static async create(clientData) {
    const {
      name,
      email,
      password,
      organization_name,
      website,
      phone,
      plan_type = 'basic'
    } = clientData;

    try {
      const clientId = 'cli_' + crypto.randomString(16);
      const clientSecret = crypto.randomString(32);
      const passwordHash = await crypto.hashPassword(password);

      const query = `
        INSERT INTO clients (
          name, email, password_hash, organization_name, 
          website, phone, plan_type, client_id, client_secret
        ) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;

      const result = await database.query(query, [
        name,
        email,
        passwordHash,
        organization_name,
        website,
        phone,
        plan_type,
        clientId,
        clientSecret
      ]);

      return {
        ...result.rows[0],
        client_secret: clientSecret // Return raw secret once
      };
    } catch (error) {
      logger.error('Client creation error:', error);
      throw error;
    }
  }

  static async findById(id) {
    try {
      const query = `
        SELECT *
        FROM clients 
        WHERE id = $1
      `;

      const result = await database.query(query, [id]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Find client by ID error:', error);
      throw error;
    }
  }

  static async findByClientId(clientId) {
    try {
      const query = 'SELECT * FROM clients WHERE client_id = $1';
      const result = await database.query(query, [clientId]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Find client by client_id error:', error);
      throw error;
    }
  }

  static async findByEmail(email) {
    try {
      const query = 'SELECT * FROM clients WHERE email = $1';
      const result = await database.query(query, [email]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Find client by email error:', error);
      throw error;
    }
  }

  static async list(options = {}) {
    try {
      const { page = 1, limit = 10, search } = options;
      const offset = (page - 1) * limit;

      let query = `
        SELECT 
          id, name, email, organization_name, website,
          client_id, plan_type, is_active, created_at, updated_at
        FROM clients 
        WHERE 1=1
      `;

      let countQuery = 'SELECT COUNT(*) FROM clients WHERE 1=1';
      const params = [];
      let paramCount = 0;

      if (search) {
        paramCount++;
        query += ` AND (name ILIKE $${paramCount} OR email ILIKE $${paramCount} OR organization_name ILIKE $${paramCount})`;
        countQuery += ` AND (name ILIKE $${paramCount} OR email ILIKE $${paramCount} OR organization_name ILIKE $${paramCount})`;
        params.push(`%${search}%`);
      }

      query += ` ORDER BY created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
      params.push(limit, offset);

      const [clientsResult, countResult] = await Promise.all([
        database.query(query, params),
        database.query(countQuery, params.slice(0, -2)),
      ]);

      return {
        clients: clientsResult.rows,
        total: parseInt(countResult.rows[0].count),
        page,
        limit,
        pages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
      };
    } catch (error) {
      logger.error('List clients error:', error);
      throw error;
    }
  }

  static async update(id, updates) {
    try {
      const allowedFields = [
        'name', 'organization_name', 'website', 'phone',
        'plan_type', 'is_active', 'last_login'
      ];

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
        UPDATE clients 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `;

      const result = await database.query(query, values);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Client update error:', error);
      throw error;
    }
  }

  static async regenerateClientSecret(id) {
    try {
      const newSecret = crypto.randomString(32);

      const query = `
        UPDATE clients 
        SET client_secret = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `;

      const result = await database.query(query, [newSecret, id]);

      if (!result.rows[0]) {
        return null;
      }

      return {
        ...result.rows[0],
        client_secret: newSecret,
      };
    } catch (error) {
      logger.error('Regenerate client secret error:', error);
      throw error;
    }
  }

  static async delete(id) {
    try {
      const client = await database.getClient();

      try {
        await client.query('BEGIN');

        // Cascade delete handled by DB for client_applications, users, etc.
        // But some tables might not have FK with CASCADE
        await client.query('DELETE FROM audit_logs WHERE client_id = $1', [id]);

        // Delete sessions for all entities related to this client? 
        // This is complex for polymorphic sessions. 
        // For now, let's just delete the client and rely on FK constraints.
        const result = await client.query('DELETE FROM clients WHERE id = $1 RETURNING id', [id]);

        await client.query('COMMIT');
        client.release();

        return result.rows[0] || null;
      } catch (error) {
        await client.query('ROLLBACK');
        client.release();
        throw error;
      }
    } catch (error) {
      logger.error('Client deletion error:', error);
      throw error;
    }
  }

  static async getStats(id) {
    try {
      const statsQueries = {
        totalApplications: `
          SELECT COUNT(*) as count 
          FROM client_applications 
          WHERE client_id = $1
        `,
        totalUsers: `
          SELECT COUNT(*) as count
          FROM users 
          WHERE client_id = $1
        `,
        activeSessions: `
          SELECT COUNT(*) as count
          FROM sessions 
          WHERE entity_id = $1 AND session_type = 'client' AND revoked = false AND expires_at > NOW()
        `
      };

      const stats = {};

      for (const [key, query] of Object.entries(statsQueries)) {
        const result = await database.query(query, [id]);
        stats[key] = parseInt(result.rows[0].count) || 0;
      }

      return stats;
    } catch (error) {
      logger.error('Get client stats error:', error);
      throw error;
    }
  }

  static async validateDomain(clientId, domain) {
    try {
      const client = await this.findById(clientId);
      if (!client) return false;

      const allowedDomains = client.allowed_domains || [];

      // If no domains configured, allow all
      if (allowedDomains.length === 0) {
        return true;
      }

      return allowedDomains.some(allowedDomain => {
        if (allowedDomain.startsWith('*.')) {
          const baseDomain = allowedDomain.substring(2);
          return domain.endsWith('.' + baseDomain) || domain === baseDomain;
        }
        return domain === allowedDomain;
      });
    } catch (error) {
      logger.error('Domain validation error:', error);
      return false;
    }
  }
}

module.exports = Client;