const crypto = require('../utils/crypto');
const database = require('../utils/database');
const logger = require('../utils/logger');
const jwtService = require('../services/jwt.service');
const emailService = require('../services/email.service');
const ClientKeyService = require('../services/clientKey.service');
const ApplicationKeyService = require('../services/applicationKey.service');

class ClientAuthController {
  async register(req, res, next) {
    const {
      name, email, password, company_name, website, phone,
      plan_type = 'free'
    } = req.body;

    try {
      // Check if client already exists
      const existingQuery = 'SELECT id FROM clients WHERE email = $1';
      const existing = await database.query(existingQuery, [email]);

      if (existing.rows.length > 0) {
        return res.status(409).json({
          error: 'Client with this email already exists',
          code: 'CLIENT_EXISTS',
        });
      }

      // Generate API credentials
      const apiKey = 'cli_' + crypto.randomString(16);
      const secretKey = crypto.randomString(32);
      const secretKeyHash = await crypto.hashPassword(secretKey);
      const passwordHash = await crypto.hashPassword(password);

      // Create client
      const insertQuery = `
        INSERT INTO clients (
          name, email, password_hash, company_name, website, phone,
          plan_type, api_key, secret_key_hash, is_active, email_verified
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id, name, email, company_name, plan_type, created_at
      `;

      const result = await database.query(insertQuery, [
        name, email, passwordHash, company_name, website, phone,
        plan_type, apiKey, secretKeyHash, true, false
      ]);

      const client = result.rows[0];

      // Send welcome email with verification
      try {
        await emailService.sendClientWelcomeEmail(email, name, client.id);
      } catch (emailError) {
        logger.error('Failed to send welcome email:', emailError);
      }

      // Auto-generate RSA key pair for this client (new requirement)
      let keyPair = null;
      try {
        keyPair = await ClientKeyService.generateKeyPair(client.id);
        logger.info('RSA key pair auto-generated for new client', {
          clientId: client.id,
          keyId: keyPair.keyId
        });
      } catch (keyError) {
        logger.error('Failed to auto-generate RSA keys for client:', keyError);
      }

      logger.info('Client registered successfully', { clientId: client.id, email });

      res.status(201).json({
        client: {
          id: client.id,
          name: client.name,
          email: client.email,
          company_name: client.company_name,
          plan_type: client.plan_type,
          created_at: client.created_at,
        },
        api_credentials: {
          api_key: apiKey,
          secret_key: secretKey, // Only shown once
        },
        keys: keyPair ? {
          keyId: keyPair.keyId,
          kid: keyPair.kid,
        } : null,
        message: 'Client registered successfully. Please verify your email and save your API credentials.',
      });

    } catch (error) {
      logger.error('Client registration error:', error);
      next(error);
    }
  }

  async login(req, res, next) {
    const { email, password } = req.body;

    try {
      // Find client
      const clientQuery = `
        SELECT id, email, password_hash, name, company_name, plan_type, 
               is_active, email_verified, last_login
        FROM clients 
        WHERE email = $1
      `;

      const result = await database.query(clientQuery, [email]);

      if (result.rows.length === 0) {
        return res.status(401).json({
          error: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS',
        });
      }

      const client = result.rows[0];

      if (!client.is_active) {
        return res.status(401).json({
          error: 'Account is suspended. Contact support.',
          code: 'ACCOUNT_SUSPENDED',
        });
      }

      // Verify password
      const isValidPassword = await crypto.comparePassword(password, client.password_hash);

      if (!isValidPassword) {
        return res.status(401).json({
          error: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS',
        });
      }

      // Generate tokens
      const accessToken = await jwtService.generateAccessToken({
        sub: client.id,
        email: client.email,
        type: 'client'
      });

      const refreshToken = crypto.randomString(64);

      // Create session with correct column names (polymorphic)
      const sessionQuery = `
        INSERT INTO sessions (
          session_type, entity_id, refresh_token,
          expires_at, ip_address
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `;

      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days for refresh token

      await database.query(sessionQuery, [
        'client',
        client.id,
        refreshToken,
        expiresAt,
        req.ip
      ]);

      // Update last login
      await database.query(
        'UPDATE clients SET last_login = NOW() WHERE id = $1',
        [client.id]
      );

      logger.info('Client login successful', { clientId: client.id, email });
      // Add debug logging
      console.log('=== BACKEND LOGIN DEBUG ===');
      console.log('Access token generated:', accessToken);
      console.log('Access token type:', typeof accessToken);
      console.log('Access token length:', accessToken?.length);
      console.log('Client ID:', client.id);

      res.json({
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'Bearer',
        expires_in: 7200,
        client: {
          id: client.id,
          email: client.email,
          name: client.name,
          company_name: client.company_name,
          plan_type: client.plan_type,
          email_verified: client.email_verified,
        },
      });


    } catch (error) {
      logger.error('Client login error:', error);
      next(error);
    }
  }

  async getProfile(req, res, next) {
    try {
      const clientQuery = `
        SELECT 
          id, name, email, company_name, website, phone, plan_type,
          subscription_status, billing_email, is_active, email_verified,
          last_login, created_at, updated_at
        FROM clients 
        WHERE id = $1
      `;

      const result = await database.query(clientQuery, [req.client.id]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Client not found',
          code: 'CLIENT_NOT_FOUND',
        });
      }

      res.json({ client: result.rows[0] });

    } catch (error) {
      logger.error('Get client profile error:', error);
      next(error);
    }
  }

  async getDashboardStats(req, res, next) {
    try {
      const clientId = req.client.id;

      const statsQueries = {
        totalApplications: `
          SELECT COUNT(*) as count 
          FROM client_applications 
          WHERE client_id = $1 AND is_active = true
        `,
        totalUsers: `
          SELECT COUNT(*) as count 
          FROM users 
          WHERE client_id = $1 AND is_active = true
        `,
        activeSessions: `
          SELECT COUNT(*) as count 
          FROM sessions 
          WHERE client_id = $1 AND expires_at > NOW() AND revoked = false
        `,
        recentLogins: `
          SELECT COUNT(*) as count 
          FROM users 
          WHERE client_id = $1 AND last_login > NOW() - INTERVAL '24 hours'
        `,
        monthlyActiveUsers: `
          SELECT COUNT(DISTINCT user_id) as count
          FROM sessions s
          JOIN users u ON s.user_id = u.id
          WHERE u.client_id = $1 AND s.created_at > NOW() - INTERVAL '30 days'
        `
      };

      const stats = {};

      for (const [key, query] of Object.entries(statsQueries)) {
        const result = await database.query(query, [clientId]);
        stats[key] = result.rows[0];
      }

      res.json({ stats });

    } catch (error) {
      logger.error('Get client dashboard stats error:', error);
      next(error);
    }
  }

  async getApplications(req, res, next) {
    try {
      const { page = 1, limit = 10 } = req.query;
      const offset = (page - 1) * limit;

      const query = `
        SELECT 
          ca.*,
          COUNT(u.id) as user_count,
          COUNT(s.id) as active_session_count
        FROM client_applications ca
        LEFT JOIN users u ON ca.id = u.application_id AND u.is_active = true
        LEFT JOIN sessions s ON ca.id = s.application_id AND s.expires_at > NOW() AND s.revoked = false
        WHERE ca.client_id = $1
        GROUP BY ca.id
        ORDER BY ca.created_at DESC
        LIMIT $2 OFFSET $3
      `;

      const countQuery = `
        SELECT COUNT(*) FROM client_applications WHERE client_id = $1
      `;

      const [appsResult, countResult] = await Promise.all([
        database.query(query, [req.client.id, limit, offset]),
        database.query(countQuery, [req.client.id])
      ]);

      const totalCount = parseInt(countResult.rows[0].count);

      res.json({
        applications: appsResult.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount,
          pages: Math.ceil(totalCount / limit),
        },
      });

    } catch (error) {
      logger.error('Get applications error:', error);
      next(error);
    }
  }

  async createApplication(req, res, next) {
    const {
      name, description, auth_mode = 'basic',
      allowed_domains = [], redirect_urls = [],
      webhook_url, role_request_webhook,
      roles, default_role_id
    } = req.body;

    try {
      // Generate application credentials
      const clientAuthKey = 'app_' + crypto.randomString(16);
      const clientSecret = crypto.randomString(32);
      const clientSecretHash = await crypto.hashPassword(clientSecret);

      // Process roles logic (from simple controller)
      let processedRoles = [];
      let defaultRole = 'user';

      if (auth_mode === 'advanced' && roles && Array.isArray(roles)) {
        processedRoles = roles.filter(role => role.name && role.displayName);

        // Find default role
        const defaultRoleObj = processedRoles.find(role => role.id === default_role_id);
        if (defaultRoleObj) {
          defaultRole = defaultRoleObj.name;
        }
      } else {
        // Basic auth mode - use simple roles
        processedRoles = [
          { name: 'user', displayName: 'User', hierarchy: 1 },
          { name: 'admin', displayName: 'Admin', hierarchy: 2 }
        ];
        defaultRole = 'user';
      }

      const insertQuery = `
        INSERT INTO client_applications (
          client_id, name, description, auth_mode, allowed_domains, 
          redirect_urls, client_id_key, client_secret_hash, 
          default_role, roles_config, webhook_url, role_request_webhook, is_active
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `;

      const result = await database.query(insertQuery, [
        req.client.id, name, description, auth_mode,
        JSON.stringify(allowed_domains), JSON.stringify(redirect_urls),
        clientAuthKey, clientSecretHash,
        defaultRole, JSON.stringify(processedRoles),
        webhook_url, role_request_webhook,
        true
      ]);

      const application = result.rows[0];

      logger.info('Application created', {
        applicationId: application.id,
        clientId: req.client.id,
        name
      });

      res.status(201).json({
        application: {
          ...application,
          client_secret: clientSecret, // Only shown once
        },
        message: 'Application created successfully. Please save the client secret.',
      });

    } catch (error) {
      logger.error('Create application error:', error);
      next(error);
    }
  }

  async getApplication(req, res, next) {
    try {
      const { id } = req.params;

      const query = `
        SELECT 
          ca.*,
          COUNT(u.id) as user_count,
          COUNT(s.id) as active_session_count
        FROM client_applications ca
        LEFT JOIN users u ON ca.id = u.application_id AND u.is_active = true
        LEFT JOIN sessions s ON ca.id = s.application_id AND s.expires_at > NOW() AND s.revoked = false
        WHERE ca.id = $1 AND ca.client_id = $2
        GROUP BY ca.id
      `;

      const result = await database.query(query, [id, req.client.id]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Application not found',
          code: 'APPLICATION_NOT_FOUND',
        });
      }

      res.json({ application: result.rows[0] });

    } catch (error) {
      logger.error('Get application error:', error);
      next(error);
    }
  }

  async updateApplication(req, res, next) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const allowedFields = [
        'name', 'description', 'allowed_domains', 'redirect_urls',
        'default_user_role', 'available_roles', 'custom_roles', 'settings'
      ];

      const updateFields = [];
      const updateValues = [];
      let paramCount = 0;

      allowedFields.forEach(field => {
        if (updates[field] !== undefined) {
          paramCount++;
          updateFields.push(`${field} = $${paramCount}`);

          if (['allowed_domains', 'redirect_urls', 'available_roles', 'custom_roles', 'settings'].includes(field)) {
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

      paramCount++;
      updateValues.push(req.client.id);

      const query = `
        UPDATE client_applications 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount - 1} AND client_id = $${paramCount}
        RETURNING *
      `;

      const result = await database.query(query, updateValues);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Application not found',
          code: 'APPLICATION_NOT_FOUND',
        });
      }

      logger.info('Application updated', {
        applicationId: id,
        clientId: req.client.id
      });

      res.json({ application: result.rows[0] });

    } catch (error) {
      logger.error('Update application error:', error);
      next(error);
    }
  }

  async deleteApplication(req, res, next) {
    try {
      const { id } = req.params;

      // Check if application has users
      const userCountQuery = `
        SELECT COUNT(*) as count FROM users WHERE application_id = $1
      `;
      const userCount = await database.query(userCountQuery, [id]);

      if (parseInt(userCount.rows[0].count) > 0) {
        return res.status(400).json({
          error: 'Cannot delete application with existing users',
          code: 'APPLICATION_HAS_USERS',
        });
      }

      const query = `
        DELETE FROM client_applications 
        WHERE id = $1 AND client_id = $2
        RETURNING id, name
      `;

      const result = await database.query(query, [id, req.client.id]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Application not found',
          code: 'APPLICATION_NOT_FOUND',
        });
      }

      logger.info('Application deleted', {
        applicationId: id,
        clientId: req.client.id,
        name: result.rows[0].name
      });

      res.json({ message: 'Application deleted successfully' });

    } catch (error) {
      logger.error('Delete application error:', error);
      next(error);
    }
  }

  async regenerateApplicationSecret(req, res, next) {
    try {
      const { id } = req.params;

      const newClientSecret = crypto.randomString(32);
      const newClientSecretHash = await crypto.hashPassword(newClientSecret);

      const query = `
        UPDATE client_applications 
        SET client_secret_hash = $1, updated_at = NOW()
        WHERE id = $2 AND client_id = $3
        RETURNING id, name, client_id_key
      `;

      const result = await database.query(query, [newClientSecretHash, id, req.client.id]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Application not found',
          code: 'APPLICATION_NOT_FOUND',
        });
      }

      logger.info('Application secret regenerated', {
        applicationId: id,
        clientId: req.client.id
      });

      res.json({
        application: {
          id: result.rows[0].id,
          name: result.rows[0].name,
          client_id_key: result.rows[0].client_id_key,
          client_secret: newClientSecret, // Only shown once
        },
        message: 'Application secret regenerated successfully. Please save the new secret.',
      });

    } catch (error) {
      logger.error('Regenerate application secret error:', error);
      next(error);
    }
  }

  async logout(req, res, next) {
    try {
      // Revoke current session
      await database.query(
        'UPDATE sessions SET revoked = true, revoked_at = NOW() WHERE entity_id = $1 AND session_type = $2',
        [req.client.id, 'client']
      );

      logger.info('Client logout successful', { clientId: req.client.id });

      res.json({ message: 'Logged out successfully' });

    } catch (error) {
      logger.error('Client logout error:', error);
      next(error);
    }
  }

  async getApplicationKeys(req, res, next) {
    try {
      const { id: application_id } = req.params;

      // Verify application belongs to client
      const appResult = await database.query(
        'SELECT id FROM client_applications WHERE id = $1 AND client_id = $2',
        [application_id, req.client.id]
      );

      if (appResult.rows.length === 0) {
        return res.status(404).json({ error: 'Application not found' });
      }

      const keys = await ApplicationKeyService.getApplicationKeys(application_id);
      res.json({ success: true, keys });
    } catch (error) {
      logger.error('Get application keys error:', error);
      next(error);
    }
  }

  async rotateApplicationKeys(req, res, next) {
    try {
      const { id: application_id } = req.params;

      // Verify application belongs to client
      const appResult = await database.query(
        'SELECT id FROM client_applications WHERE id = $1 AND client_id = $2',
        [application_id, req.client.id]
      );

      if (appResult.rows.length === 0) {
        return res.status(404).json({ error: 'Application not found' });
      }

      const newKey = await ApplicationKeyService.rotateKeys(application_id);
      res.json({
        success: true,
        message: 'Key pair rotated successfully',
        key: newKey
      });
    } catch (error) {
      logger.error('Rotate application keys error:', error);
      next(error);
    }
  }

  async getApplicationJwks(req, res, next) {
    try {
      const { id: application_id } = req.params;

      // Verify application belongs to client
      const appResult = await database.query(
        'SELECT id FROM client_applications WHERE id = $1 AND client_id = $2',
        [application_id, req.client.id]
      );

      if (appResult.rows.length === 0) {
        return res.status(404).json({ error: 'Application not found' });
      }

      const keys = await ApplicationKeyService.getPublicJwk(application_id);
      res.json({ keys });
    } catch (error) {
      logger.error('Get application JWKS error:', error);
      next(error);
    }
  }

  async forgotPassword(req, res, next) {
    try {
      res.json({ message: 'Forgot password endpoint - to be implemented' });
    } catch (error) {
      next(error);
    }
  }

  async resetPassword(req, res, next) {
    try {
      res.json({ message: 'Reset password endpoint - to be implemented' });
    } catch (error) {
      next(error);
    }
  }

  async verifyEmail(req, res, next) {
    try {
      res.json({ message: 'Verify email endpoint - to be implemented' });
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req, res, next) {
    try {
      res.json({ message: 'Update profile endpoint - to be implemented' });
    } catch (error) {
      next(error);
    }
  }

  async changePassword(req, res, next) {
    try {
      res.json({ message: 'Change password endpoint - to be implemented' });
    } catch (error) {
      next(error);
    }
  }

  // Additional methods for user management, analytics, etc. would go here
  async getApplicationUsers(req, res, next) {
    try {
      res.json({ message: 'Get application users endpoint - to be implemented' });
    } catch (error) {
      next(error);
    }
  }

  async getApplicationUser(req, res, next) {
    try {
      res.json({ message: 'Get application user endpoint - to be implemented' });
    } catch (error) {
      next(error);
    }
  }

  async updateApplicationUser(req, res, next) {
    try {
      res.json({ message: 'Update application user endpoint - to be implemented' });
    } catch (error) {
      next(error);
    }
  }

  async deleteApplicationUser(req, res, next) {
    try {
      res.json({ message: 'Delete application user endpoint - to be implemented' });
    } catch (error) {
      next(error);
    }
  }

  async getApplicationRoles(req, res, next) {
    try {
      res.json({ message: 'Get application roles endpoint - to be implemented' });
    } catch (error) {
      next(error);
    }
  }

  async createApplicationRole(req, res, next) {
    try {
      res.json({ message: 'Create application role endpoint - to be implemented' });
    } catch (error) {
      next(error);
    }
  }

  async updateApplicationRole(req, res, next) {
    try {
      res.json({ message: 'Update application role endpoint - to be implemented' });
    } catch (error) {
      next(error);
    }
  }

  async deleteApplicationRole(req, res, next) {
    try {
      res.json({ message: 'Delete application role endpoint - to be implemented' });
    } catch (error) {
      next(error);
    }
  }

  async getApplicationSessions(req, res, next) {
    try {
      res.json({ message: 'Get application sessions endpoint - to be implemented' });
    } catch (error) {
      next(error);
    }
  }

  async revokeApplicationSession(req, res, next) {
    try {
      res.json({ message: 'Revoke application session endpoint - to be implemented' });
    } catch (error) {
      next(error);
    }
  }

  async getApplicationAnalytics(req, res, next) {
    try {
      res.json({ message: 'Application analytics endpoint - to be implemented' });
    } catch (error) {
      next(error);
    }
  }

  async getLoginAnalytics(req, res, next) {
    try {
      res.json({ message: 'Login analytics endpoint - to be implemented' });
    } catch (error) {
      next(error);
    }
  }

  async getUserAnalytics(req, res, next) {
    try {
      res.json({ message: 'User analytics endpoint - to be implemented' });
    } catch (error) {
      next(error);
    }
  }

  async getWebhookLogs(req, res, next) {
    try {
      res.json({ message: 'Webhook logs endpoint - to be implemented' });
    } catch (error) {
      next(error);
    }
  }

  async testWebhook(req, res, next) {
    try {
      res.json({ message: 'Test webhook endpoint - to be implemented' });
    } catch (error) {
      next(error);
    }
  }

  async getCurrentBilling(req, res, next) {
    try {
      res.json({ message: 'Current billing endpoint - to be implemented' });
    } catch (error) {
      next(error);
    }
  }

  async getBillingHistory(req, res, next) {
    try {
      res.json({ message: 'Billing history endpoint - to be implemented' });
    } catch (error) {
      next(error);
    }
  }

  async upgradePlan(req, res, next) {
    try {
      res.json({ message: 'Upgrade plan endpoint - to be implemented' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ClientAuthController();
