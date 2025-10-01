const database = require('../utils/database');
const crypto = require('../utils/crypto');
const logger = require('../utils/logger');

class Client {
  static async create(clientData) {
    const { name, contact_email, website, business_type, allowed_domains = [], default_roles = ['user'] } = clientData;
    
    try {
      const apiKey = 'cli_' + crypto.randomString(16);
      const secretKey = crypto.randomString(32);
      const secretKeyHash = await crypto.hashPassword(secretKey);

      const query = `
        INSERT INTO clients (
          name, contact_email, website, business_type, 
          api_key, secret_key_hash, allowed_domains, default_roles
        ) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;
      
      const result = await database.query(query, [
        name,
        contact_email,
        website,
        business_type,
        apiKey,
        secretKeyHash,
        JSON.stringify(allowed_domains),
        JSON.stringify(default_roles),
      ]);

      const client = result.rows[0];
      
      // Return client with sensitive data (only once)
      return {
        ...client,
        secret_key: secretKey,
      };
    } catch (error) {
      logger.error('Client creation error:', error);
      throw error;
    }
  }

  static async findById(id) {
    try {
      const query = `
        SELECT 
          id, name, contact_email, website, business_type,
          api_key, allowed_domains, default_roles, plan_type,
          webhook_url, settings, created_at, updated_at
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

  static async findByApiKey(apiKey) {
    try {
      const query = 'SELECT * FROM clients WHERE api_key = $1';
      const result = await database.query(query, [apiKey]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Find client by API key error:', error);
      throw error;
    }
  }

  static async list(options = {}) {
    try {
      const { page = 1, limit = 10, search } = options;
      const offset = (page - 1) * limit;

      let query = `
        SELECT 
          id, name, contact_email, website, business_type,
          api_key, allowed_domains, default_roles, plan_type,
          created_at, updated_at
        FROM clients 
        WHERE 1=1
      `;
      
      let countQuery = 'SELECT COUNT(*) FROM clients WHERE 1=1';
      const params = [];
      let paramCount = 0;

      if (search) {
        paramCount++;
        query += ` AND (name ILIKE $${paramCount} OR contact_email ILIKE $${paramCount})`;
        countQuery += ` AND (name ILIKE $${paramCount} OR contact_email ILIKE $${paramCount})`;
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
        'name', 'website', 'business_type', 'allowed_domains', 
        'default_roles', 'webhook_url', 'settings', 'plan_type'
      ];
      
      const updateFields = [];
      const values = [];
      let paramCount = 0;

      allowedFields.forEach(field => {
        if (updates[field] !== undefined) {
          paramCount++;
          updateFields.push(`${field} = $${paramCount}`);
          
          if (field === 'allowed_domains' || field === 'default_roles' || field === 'settings') {
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

  static async regenerateApiKey(id) {
    try {
      const newApiKey = 'cli_' + crypto.randomString(16);
      const newSecretKey = crypto.randomString(32);
      const newSecretKeyHash = await crypto.hashPassword(newSecretKey);

      const query = `
        UPDATE clients 
        SET api_key = $1, secret_key_hash = $2, updated_at = NOW()
        WHERE id = $3
        RETURNING *
      `;

      const result = await database.query(query, [newApiKey, newSecretKeyHash, id]);
      
      if (!result.rows[0]) {
        return null;
      }

      return {
        ...result.rows[0],
        secret_key: newSecretKey,
      };
    } catch (error) {
      logger.error('Regenerate API key error:', error);
      throw error;
    }
  }

  static async delete(id) {
    try {
      const client = await database.getClient();
      
      try {
        await client.query('BEGIN');

        // Delete related records
        await client.query('DELETE FROM webhook_logs WHERE client_id = $1', [id]);
        await client.query('DELETE FROM audit_logs WHERE client_id = $1', [id]);
        await client.query('DELETE FROM failed_logins WHERE client_id = $1', [id]);
        await client.query('DELETE FROM sessions WHERE client_id = $1', [id]);
        await client.query('DELETE FROM client_users WHERE client_id = $1', [id]);
        
        // Delete client
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
        totalUsers: `
          SELECT COUNT(*) as count 
          FROM client_users 
          WHERE client_id = $1
        `,
        activeUsers: `
          SELECT COUNT(DISTINCT user_id) as count
          FROM sessions 
          WHERE client_id = $1 AND expires_at > NOW() AND revoked = false
        `,
        totalLogins: `
          SELECT COUNT(*) as count
          FROM audit_logs 
          WHERE client_id = $1 AND action = 'login'
        `,
        webhookCalls: `
          SELECT COUNT(*) as count
          FROM webhook_logs 
          WHERE client_id = $1
        `,
        successfulWebhooks: `
          SELECT COUNT(*) as count
          FROM webhook_logs 
          WHERE client_id = $1 AND success = true
        `,
      };

      const stats = {};
      
      for (const [key, query] of Object.entries(statsQueries)) {
        const result = await database.query(query, [id]);
        stats[key] = parseInt(result.rows[0].count) || 0;
      }

      // Calculate success rate
      stats.webhookSuccessRate = stats.webhookCalls > 0 ? 
        (stats.successfulWebhooks / stats.webhookCalls * 100).toFixed(2) : 100;

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