const crypto = require('../utils/crypto');
const database = require('../utils/database');
const logger = require('../utils/logger');
const emailService = require('../services/email.service');

class ClientController {
  async createClient(req, res, next) {
    const { name, contact_email, website, business_type, allowed_domains, default_roles } = req.body;
    
    try {
      // Generate API credentials
      const apiKey = 'cli_' + crypto.randomString(16);
      const secretKey = crypto.randomString(32);
      const secretKeyHash = await crypto.hashPassword(secretKey);

      // Create client
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
        JSON.stringify(allowed_domains || []),
        JSON.stringify(default_roles || ['user']),
      ]);

      const client = result.rows[0];

      // Send welcome email with credentials
      try {
        await emailService.sendClientWelcomeEmail(contact_email, name, apiKey, secretKey);
      } catch (emailError) {
        logger.error('Failed to send client welcome email:', emailError);
        // Don't fail the request if email fails
      }

      logger.info('Client created successfully', { clientId: client.id, name });

      res.status(201).json({
        client: {
          id: client.id,
          name: client.name,
          contact_email: client.contact_email,
          website: client.website,
          api_key: apiKey,
          secret_key: secretKey, // Only returned once
          allowed_domains: client.allowed_domains,
          default_roles: client.default_roles,
          plan_type: client.plan_type,
          created_at: client.created_at,
        },
        message: 'Client created successfully. Please save the secret key as it will not be shown again.',
      });

    } catch (error) {
      logger.error('Client creation error:', error);
      next(error);
    }
  }

  async getClients(req, res, next) {
    try {
      const { page = 1, limit = 10, search } = req.query;
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
        database.query(countQuery, params.slice(0, -2)), // Remove limit/offset for count
      ]);

      const totalCount = parseInt(countResult.rows[0].count);

      res.json({
        clients: clientsResult.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount,
          pages: Math.ceil(totalCount / limit),
        },
      });

    } catch (error) {
      logger.error('Get clients error:', error);
      next(error);
    }
  }

  async getClient(req, res, next) {
    try {
      const { id } = req.params;

      const query = `
        SELECT 
          id, name, contact_email, website, business_type,
          api_key, allowed_domains, default_roles, plan_type,
          webhook_url, settings, created_at, updated_at
        FROM clients 
        WHERE id = $1
      `;
      
      const result = await database.query(query, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Client not found',
          code: 'CLIENT_NOT_FOUND',
        });
      }

      res.json({ client: result.rows[0] });

    } catch (error) {
      logger.error('Get client error:', error);
      next(error);
    }
  }

  async updateClient(req, res, next) {
    try {
      const { id } = req.params;
      const updates = req.body;

      // Build dynamic update query
      const allowedFields = ['name', 'website', 'business_type', 'allowed_domains', 'default_roles', 'webhook_url', 'settings'];
      const updateFields = [];
      const updateValues = [];
      let paramCount = 0;

      allowedFields.forEach(field => {
        if (updates[field] !== undefined) {
          paramCount++;
          updateFields.push(`${field} = $${paramCount}`);
          
          if (field === 'allowed_domains' || field === 'default_roles' || field === 'settings') {
            updateValues.push(JSON.stringify(updates[field]));
          } else {
            updateValues.push(updates[field]);
          }
        }
      });

      if (updateFields.length === 0) {
        return res.status(400).json({
          error: 'No valid fields to update',
          code: 'NO_VALID_FIELDS',
        });
      }

      paramCount++;
      updateFields.push('updated_at = NOW()');
      updateValues.push(id);

      const query = `
        UPDATE clients 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `;

      const result = await database.query(query, updateValues);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Client not found',
          code: 'CLIENT_NOT_FOUND',
        });
      }

      logger.info('Client updated successfully', { clientId: id });

      res.json({ client: result.rows[0] });

    } catch (error) {
      logger.error('Update client error:', error);
      next(error);
    }
  }

  async regenerateApiKey(req, res, next) {
    try {
      const { id } = req.params;

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

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Client not found',
          code: 'CLIENT_NOT_FOUND',
        });
      }

      const client = result.rows[0];

      // Send email with new credentials
      try {
        await emailService.sendApiKeyResetEmail(client.contact_email, client.name, newApiKey, newSecretKey);
      } catch (emailError) {
        logger.error('Failed to send API key reset email:', emailError);
      }

      logger.info('API key regenerated', { clientId: id });

      res.json({
        client: {
          id: client.id,
          name: client.name,
          api_key: newApiKey,
          secret_key: newSecretKey, // Only returned once
        },
        message: 'API credentials regenerated successfully. Please save the new secret key.',
      });

    } catch (error) {
      logger.error('Regenerate API key error:', error);
      next(error);
    }
  }

  async getClientStats(req, res, next) {
    try {
      const { id } = req.params;

      // Verify client exists
      const clientCheck = await database.query('SELECT id FROM clients WHERE id = $1', [id]);
      if (clientCheck.rows.length === 0) {
        return res.status(404).json({
          error: 'Client not found',
          code: 'CLIENT_NOT_FOUND',
        });
      }

      // Get various statistics
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
        failedLogins: `
          SELECT COUNT(*) as count
          FROM failed_logins 
          WHERE client_id = $1 AND created_at > NOW() - INTERVAL '24 hours'
        `,
        webhookSuccessRate: `
          SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN success = true THEN 1 END) as successful
          FROM webhook_logs 
          WHERE client_id = $1 AND created_at > NOW() - INTERVAL '24 hours'
        `,
      };

      const stats = {};
      
      for (const [key, query] of Object.entries(statsQueries)) {
        const result = await database.query(query, [id]);
        stats[key] = result.rows[0];
      }

      res.json({ stats });

    } catch (error) {
      logger.error('Get client stats error:', error);
      next(error);
    }
  }

  async deleteClient(req, res, next) {
    try {
      const { id } = req.params;

      // Use transaction to ensure all related data is deleted
      const client = await database.getClient();
      
      try {
        await client.query('BEGIN');

        // Delete related data first
        await client.query('DELETE FROM webhook_logs WHERE client_id = $1', [id]);
        await client.query('DELETE FROM audit_logs WHERE client_id = $1', [id]);
        await client.query('DELETE FROM failed_logins WHERE client_id = $1', [id]);
        await client.query('DELETE FROM sessions WHERE client_id = $1', [id]);
        await client.query('DELETE FROM client_users WHERE client_id = $1', [id]);
        
        // Delete client
        const result = await client.query('DELETE FROM clients WHERE id = $1 RETURNING id', [id]);
        
        await client.query('COMMIT');
        client.release();

        if (result.rows.length === 0) {
          return res.status(404).json({
            error: 'Client not found',
            code: 'CLIENT_NOT_FOUND',
          });
        }

        logger.info('Client deleted successfully', { clientId: id });

        res.json({ message: 'Client deleted successfully' });

      } catch (error) {
        await client.query('ROLLBACK');
        client.release();
        throw error;
      }

    } catch (error) {
      logger.error('Delete client error:', error);
      next(error);
    }
  }
}

module.exports = new ClientController();