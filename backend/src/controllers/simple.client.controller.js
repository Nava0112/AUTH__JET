const bcrypt = require('bcryptjs');
const database = require('../utils/database');
const logger = require('../utils/logger');

class SimpleClientController {
  async register(req, res, next) {
    try {
      const { name, email, password, organizationName } = req.body;
      
      // Basic validation
      if (!name || !email || !password || !organizationName) {
        return res.status(400).json({
          error: 'Name, email, password, and organization name are required'
        });
      }

      // Create clients table if it doesn't exist
      await database.query(`
        CREATE TABLE IF NOT EXISTS clients (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          organization_name VARCHAR(255) NOT NULL,
          client_id VARCHAR(255) UNIQUE NOT NULL,
          client_secret VARCHAR(255) NOT NULL,
          plan_type VARCHAR(50) DEFAULT 'basic',
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `);

      // Check if client exists
      const existing = await database.query(
        'SELECT id FROM clients WHERE email = $1',
        [email]
      );

      if (existing.rows.length > 0) {
        return res.status(409).json({
          error: 'Client organization already exists with this email'
        });
      }

      // Generate unique client credentials
      const crypto = require('crypto');
      const clientId = `cli_${crypto.randomBytes(16).toString('hex')}`;
      const clientSecret = `secret_${crypto.randomBytes(32).toString('hex')}`;
      
      // Hash password and create client
      const passwordHash = await bcrypt.hash(password, 10);
      
      const result = await database.query(
        'INSERT INTO clients (name, email, password_hash, organization_name, client_id, client_secret, plan_type) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, name, email, organization_name, client_id, client_secret, plan_type',
        [name, email, passwordHash, organizationName, clientId, clientSecret, 'basic']
      );

      const client = result.rows[0];

      logger.info('Client organization created successfully', { clientId: client.id });

      res.status(201).json({
        success: true,
        message: 'Client organization created successfully',
        client: {
          id: client.id,
          name: client.name,
          email: client.email,
          organizationName: client.organization_name,
          clientId: client.client_id,
          clientSecret: client.client_secret,
          planType: client.plan_type
        }
      });

    } catch (error) {
      logger.error('Client registration error:', error);
      res.status(500).json({
        error: 'Registration failed',
        details: error.message
      });
    }
  }

  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({
          error: 'Email and password are required'
        });
      }

      // Find client
      const result = await database.query(
        'SELECT id, name, email, password_hash, organization_name, plan_type, is_active FROM clients WHERE email = $1',
        [email]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({
          error: 'Invalid credentials'
        });
      }

      const client = result.rows[0];

      if (!client.is_active) {
        return res.status(401).json({
          error: 'Account is suspended. Please contact support.'
        });
      }

      // Check password
      const validPassword = await bcrypt.compare(password, client.password_hash);
      
      if (!validPassword) {
        return res.status(401).json({
          error: 'Invalid credentials'
        });
      }

      // Update last login
      await database.query(
        'UPDATE clients SET last_login = NOW() WHERE id = $1',
        [client.id]
      );

      logger.info('Client login successful', { clientId: client.id });

      res.json({
        success: true,
        message: 'Login successful',
        client: {
          id: client.id,
          name: client.name,
          email: client.email,
          organizationName: client.organization_name,
          planType: client.plan_type
        }
      });

    } catch (error) {
      logger.error('Client login error:', error);
      res.status(500).json({
        error: 'Login failed',
        details: error.message
      });
    }
  }

  async getDashboard(req, res, next) {
    try {
      // Create applications table if needed
      await database.query(`
        CREATE TABLE IF NOT EXISTS client_applications (
          id SERIAL PRIMARY KEY,
          client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          client_secret VARCHAR(255) NOT NULL,
          auth_mode VARCHAR(50) DEFAULT 'basic',
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `);

      // Create users table if needed
      await database.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
          application_id INTEGER REFERENCES client_applications(id) ON DELETE CASCADE,
          email VARCHAR(255) NOT NULL,
          name VARCHAR(255),
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `);

      const stats = {
        totalApplications: 0,
        totalUsers: 0,
        recentActivity: []
      };

      // Get application count for this client (placeholder for now)
      stats.totalApplications = 0;
      stats.totalUsers = 0;

      res.json({
        success: true,
        stats
      });

    } catch (error) {
      logger.error('Client dashboard error:', error);
      res.status(500).json({
        error: 'Failed to fetch dashboard data',
        details: error.message
      });
    }
  }

  // Get client profile with credentials
  async getProfile(req, res) {
    try {
      // For /api/client/profile route (no ID in URL), we'll use a default client ID
      // or get it from session/auth. For now, let's use ID 1 as default
      const id = req.params.id || req.query.id || '1';

      logger.info('Getting client profile for ID:', id);
      
      // First, let's see what clients exist
      const allClients = await database.query('SELECT id, name, email FROM clients LIMIT 10');
      logger.info('Available clients in database:', allClients.rows);
      
      // If no clients exist and ID is 1, create a test client
      if (allClients.rows.length === 0 && id === '1') {
        logger.info('No clients found, creating test client...');
        
        const crypto = require('crypto');
        const testClientId = `cli_${crypto.randomBytes(16).toString('hex')}`;
        const testClientSecret = `secret_${crypto.randomBytes(32).toString('hex')}`;
        
        await database.query(`
          INSERT INTO clients (id, name, email, password_hash, organization_name, client_id, client_secret, plan_type)
          VALUES (1, 'Test Client', 'test@example.com', 'dummy_hash', 'Test Organization', $1, $2, 'basic')
        `, [testClientId, testClientSecret]);
        
        // Try the query again
        const retryResult = await database.query(
          `SELECT id, name, email, organization_name, plan_type, 
                  client_id, client_secret, created_at, updated_at, last_login
           FROM clients 
           WHERE id = $1`,
          [id]
        );
        
        if (retryResult.rows.length > 0) {
          const client = retryResult.rows[0];
          
          logger.info('Auto-created client credentials:', {
            clientId: client.client_id,
            hasSecret: !!client.client_secret
          });

          return res.json({
            client: {
              id: client.id,
              name: client.name,
              contact_email: client.email,
              organization_name: client.organization_name,
              description: client.organization_name,
              website: client.organization_name,
              plan_type: client.plan_type || 'basic',
              status: 'active',
              api_key: client.client_id,
              client_id: client.client_id,
              client_secret: client.client_secret,
              secret_key: client.client_secret,
              created_at: client.created_at,
              updated_at: client.updated_at,
              last_login: client.last_login,
              redirect_urls: ['https://localhost:3000/auth/callback'],
              allowed_origins: ['https://localhost:3000'],
              webhook_url: null
            }
          });
        }
      }

      // Query the client data including credentials
      const result = await database.query(
        `SELECT id, name, email, organization_name, plan_type, 
                client_id, client_secret, created_at, updated_at, last_login
         FROM clients 
         WHERE id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Client not found',
          code: 'CLIENT_NOT_FOUND'
        });
      }

      const client = result.rows[0];

      // Check if client has credentials, generate if missing
      let clientId = client.client_id;
      let clientSecret = client.client_secret;
      
      if (!clientId || !clientSecret) {
        logger.info('Client missing credentials, generating new ones...');
        
        const crypto = require('crypto');
        clientId = clientId || `cli_${crypto.randomBytes(16).toString('hex')}`;
        clientSecret = clientSecret || `secret_${crypto.randomBytes(32).toString('hex')}`;
        
        // Update database with new credentials
        await database.query(`
          UPDATE clients 
          SET client_id = $1, client_secret = $2, updated_at = NOW()
          WHERE id = $3
        `, [clientId, clientSecret, client.id]);
        
        logger.info('Generated and saved new credentials for client:', {
          clientId,
          clientName: client.name
        });
      }

      // Use actual stored credentials from database
      logger.info('Retrieved stored credentials for client:', {
        clientId: clientId,
        hasSecret: !!clientSecret,
        secretLength: clientSecret?.length
      });

      const responseData = {
        client: {
          id: client.id,
          name: client.name,
          contact_email: client.email,
          organization_name: client.organization_name,
          description: client.organization_name,
          website: client.organization_name,
          plan_type: client.plan_type || 'basic',
          status: 'active',
          api_key: clientId,
          client_id: clientId,
          client_secret: clientSecret,
          secret_key: clientSecret,
          created_at: client.created_at,
          updated_at: client.updated_at,
          last_login: client.last_login,
          redirect_urls: ['https://localhost:3000/auth/callback'],
          allowed_origins: ['https://localhost:3000'],
          webhook_url: null
        }
      };

      logger.info('Sending client profile response:', {
        hasClientSecret: !!responseData.client.client_secret,
        clientSecretLength: responseData.client.client_secret?.length
      });

      // Return client profile with credentials
      res.json(responseData);

    } catch (error) {
      logger.error('Get client profile error:', error);
      res.status(500).json({
        error: 'Failed to fetch client profile',
        details: error.message
      });
    }
  }

  async forgotPassword(req, res) {
    res.json({ message: 'Forgot password endpoint - to be implemented' });
  }

  async resetPassword(req, res) {
    res.json({ message: 'Reset password endpoint - to be implemented' });
  }

  async verifyEmail(req, res) {
    res.json({ message: 'Verify email endpoint - to be implemented' });
  }

  async updateProfile(req, res) {
    res.json({ message: 'Update profile endpoint - to be implemented' });
  }

  async changePassword(req, res) {
    res.json({ message: 'Change password endpoint - to be implemented' });
  }

  async logout(req, res) {
    res.json({ message: 'Logout successful' });
  }

  // Application management placeholders
  async getApplications(req, res) {
    try {
      // For now, return clients instead of applications to match the UI
      const result = await database.query(`
        SELECT id, name, email as contact_email, organization_name as website,
               client_id, plan_type, created_at, updated_at
        FROM clients 
        ORDER BY created_at DESC
      `);

      // If no clients exist, create a sample one
      if (result.rows.length === 0) {
        logger.info('No clients found, creating sample client...');
        
        const crypto = require('crypto');
        const sampleClientId = `cli_${crypto.randomBytes(16).toString('hex')}`;
        const sampleClientSecret = `secret_${crypto.randomBytes(32).toString('hex')}`;
        
        await database.query(`
          INSERT INTO clients (name, email, password_hash, organization_name, client_id, client_secret, plan_type)
          VALUES ('Sample Client', 'sample@example.com', 'dummy_hash', 'Sample Organization', $1, $2, 'basic')
        `, [sampleClientId, sampleClientSecret]);
        
        // Query again
        const retryResult = await database.query(`
          SELECT id, name, email as contact_email, organization_name as website,
                 client_id, plan_type, created_at, updated_at
          FROM clients 
          ORDER BY created_at DESC
        `);
        
        const clients = retryResult.rows;
        return res.json({
          clients: clients,
          pagination: {
            page: 1,
            limit: 10,
            total: clients.length,
            pages: 1
          }
        });
      }

      const clients = result.rows;
      
      res.json({
        clients: clients,
        pagination: {
          page: 1,
          limit: 10,
          total: clients.length,
          pages: Math.ceil(clients.length / 10)
        }
      });
    } catch (error) {
      logger.error('Get clients error:', error);
      res.status(500).json({ 
        error: 'Failed to fetch clients',
        details: error.message 
      });
    }
  }

  async createApplication(req, res) {
    try {
      const { 
        name, 
        description, 
        authMode, 
        allowedOrigins, 
        mainPageUrl,
        webhookUrl,
        roleRequestWebhook,
        roles,
        defaultRoleId 
      } = req.body;
      
      // Basic validation
      if (!name || !name.trim()) {
        return res.status(400).json({
          error: 'Application name is required'
        });
      }

      if (!mainPageUrl) {
        return res.status(400).json({
          error: 'Application URL is required'
        });
      }

      // Process roles for advanced auth mode
      let processedRoles = [];
      let defaultRole = 'user';
      
      if (authMode === 'advanced' && roles && Array.isArray(roles)) {
        processedRoles = roles.filter(role => role.name && role.displayName);
        
        // Find default role
        const defaultRoleObj = processedRoles.find(role => role.id === defaultRoleId);
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

      // For now, we'll use a simple client ID from localStorage or session
      // In a real implementation, this would come from authenticated session
      const clientId = 1; // Placeholder - should come from auth middleware
      
      // Generate client secret
      const crypto = require('crypto');
      const clientSecret = crypto.randomBytes(32).toString('hex');
      
      // Create application
      const result = await database.query(`
        INSERT INTO client_applications (
          client_id, name, description, client_secret, auth_mode, 
          main_page_url, redirect_url, allowed_origins, webhook_url, 
          role_request_webhook, default_role, roles_config, is_active
        ) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) 
        RETURNING id, name, description, client_secret, auth_mode, 
                  main_page_url, redirect_url, allowed_origins, webhook_url, 
                  role_request_webhook, default_role, roles_config, is_active, created_at
      `, [
        clientId,
        name.trim(),
        description?.trim() || null,
        clientSecret,
        authMode || 'basic',
        mainPageUrl.trim(),
        mainPageUrl.trim(), // Use main page URL as redirect URL
        allowedOrigins && allowedOrigins.length > 0 ? allowedOrigins : null,
        webhookUrl?.trim() || null,
        roleRequestWebhook?.trim() || null,
        defaultRole,
        JSON.stringify(processedRoles),
        true
      ]);

      const application = result.rows[0];

      logger.info('Application created successfully', { 
        applicationId: application.id, 
        clientId: clientId,
        name: application.name 
      });

      res.status(201).json({
        success: true,
        message: 'Application created successfully',
        application: {
          id: application.id,
          name: application.name,
          description: application.description,
          clientId: application.id, // This will be used for API calls
          clientSecret: application.client_secret,
          authMode: application.auth_mode,
          mainPageUrl: application.main_page_url,
          redirectUrl: application.redirect_url,
          allowedOrigins: application.allowed_origins,
          webhookUrl: application.webhook_url,
          roleRequestWebhook: application.role_request_webhook,
          defaultRole: application.default_role,
          rolesConfig: application.roles_config,
          isActive: application.is_active,
          createdAt: application.created_at
        }
      });

    } catch (error) {
      logger.error('Create application error:', error);
      res.status(500).json({
        error: 'Failed to create application',
        details: error.message
      });
    }
  }

  async getApplication(req, res) {
    res.json({ message: 'Get application endpoint - to be implemented' });
  }

  async updateApplication(req, res) {
    res.json({ message: 'Update application endpoint - to be implemented' });
  }

  async deleteApplication(req, res) {
    res.json({ message: 'Delete application endpoint - to be implemented' });
  }

  async regenerateApplicationSecret(req, res) {
    res.json({ message: 'Regenerate application secret - to be implemented' });
  }

  // User management placeholders
  async getApplicationUsers(req, res) {
    res.json({ message: 'Get application users - to be implemented' });
  }

  async getApplicationUser(req, res) {
    res.json({ message: 'Get application user - to be implemented' });
  }

  async updateApplicationUser(req, res) {
    res.json({ message: 'Update application user - to be implemented' });
  }

  async deleteApplicationUser(req, res) {
    res.json({ message: 'Delete application user - to be implemented' });
  }

  // Role management placeholders
  async getApplicationRoles(req, res) {
    res.json({ message: 'Get application roles - to be implemented' });
  }

  async createApplicationRole(req, res) {
    res.json({ message: 'Create application role - to be implemented' });
  }

  async updateApplicationRole(req, res) {
    res.json({ message: 'Update application role - to be implemented' });
  }

  async deleteApplicationRole(req, res) {
    res.json({ message: 'Delete application role - to be implemented' });
  }

  // Session management placeholders
  async getApplicationSessions(req, res) {
    res.json({ message: 'Get application sessions - to be implemented' });
  }

  async revokeApplicationSession(req, res) {
    res.json({ message: 'Revoke application session - to be implemented' });
  }

  // Analytics placeholders
  async getApplicationAnalytics(req, res) {
    res.json({ message: 'Get application analytics - to be implemented' });
  }

  async getLoginAnalytics(req, res) {
    res.json({ message: 'Get login analytics - to be implemented' });
  }

  async getUserAnalytics(req, res) {
    res.json({ message: 'Get user analytics - to be implemented' });
  }

  // Webhook placeholders
  async getWebhookLogs(req, res) {
    res.json({ message: 'Get webhook logs - to be implemented' });
  }

  async testWebhook(req, res) {
    res.json({ message: 'Test webhook - to be implemented' });
  }

  // Billing placeholders
  async getCurrentBilling(req, res) {
    res.json({ message: 'Get current billing - to be implemented' });
  }

  async getBillingHistory(req, res) {
    res.json({ message: 'Get billing history - to be implemented' });
  }

  async upgradePlan(req, res) {
    res.json({ message: 'Upgrade plan - to be implemented' });
  }
}

module.exports = new SimpleClientController();
