const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const database = require('../utils/database');
const logger = require('../utils/logger');

class OAuthController {
  // OAuth-style login initiation - GET /oauth/authorize
  async authorize(req, res, next) {
    try {
      const { client_id, redirect_uri, state, response_type = 'code' } = req.query;
      
      if (!client_id || !redirect_uri) {
        return res.status(400).json({
          error: 'invalid_request',
          error_description: 'client_id and redirect_uri are required'
        });
      }

      // Verify application exists and get details
      const app = await database.query(
        'SELECT id, name, redirect_url, main_page_url, client_id FROM client_applications WHERE id = $1 AND is_active = true',
        [client_id]
      );

      if (app.rows.length === 0) {
        return res.status(400).json({
          error: 'invalid_client',
          error_description: 'Application not found'
        });
      }

      const application = app.rows[0];

      // Verify redirect URI matches
      if (redirect_uri !== application.redirect_url) {
        return res.status(400).json({
          error: 'invalid_request',
          error_description: 'Invalid redirect URI'
        });
      }

      // Return login/register URLs for the frontend to redirect to
      res.json({
        success: true,
        application: {
          id: application.id,
          name: application.name,
          redirectUrl: application.redirect_url
        },
        authUrls: {
          login: `/auth/login?client_id=${client_id}&redirect_uri=${encodeURIComponent(redirect_uri)}&state=${state || ''}`,
          register: `/auth/register?client_id=${client_id}&redirect_uri=${encodeURIComponent(redirect_uri)}&state=${state || ''}`
        }
      });

    } catch (error) {
      logger.error('OAuth authorize error:', error);
      res.status(500).json({ 
        error: 'server_error',
        error_description: 'Internal server error' 
      });
    }
  }

  // User registration for OAuth flow - POST /auth/register
  async register(req, res, next) {
    try {
      const { email, password, name, client_id, redirect_uri, state } = req.body;
      
      // Validation
      if (!email || !password || !name || !client_id) {
        return res.status(400).json({
          error: 'invalid_request',
          error_description: 'Email, password, name, and client_id are required'
        });
      }

      if (password.length < 8) {
        return res.status(400).json({
          error: 'invalid_request',
          error_description: 'Password must be at least 8 characters long'
        });
      }

      // Get application details
      const app = await database.query(
        'SELECT id, client_id, name, redirect_url, default_role, webhook_url FROM client_applications WHERE id = $1 AND is_active = true',
        [client_id]
      );

      if (app.rows.length === 0) {
        return res.status(400).json({
          error: 'invalid_client',
          error_description: 'Application not found'
        });
      }

      const application = app.rows[0];
      
      // Debug logging
      console.log('Application found:', application);

      // Check if user already exists for this application
      const existingUser = await database.query(
        'SELECT id FROM users WHERE application_id = $1 AND email = $2',
        [client_id, email.toLowerCase()]
      );

      if (existingUser.rows.length > 0) {
        return res.status(400).json({
          error: 'invalid_request',
          error_description: 'User already exists for this application'
        });
      }

      // Hash password and create user
      const passwordHash = await bcrypt.hash(password, 12);
      
      const result = await database.query(`
        INSERT INTO users (
          client_id, application_id, email, password_hash, name, role, is_active
        ) 
        VALUES ($1, $2, $3, $4, $5, $6, $7) 
        RETURNING id, email, name, role, is_active, created_at
      `, [
        application.client_id,
        client_id,
        email.toLowerCase(),
        passwordHash,
        name,
        application.default_role,
        true
      ]);

      const user = result.rows[0];

      // Generate JWT tokens
      const accessToken = jwt.sign(
        {
          sub: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          app_id: client_id,
          type: 'access'
        },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const refreshToken = jwt.sign(
        {
          sub: user.id,
          app_id: client_id,
          type: 'refresh'
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      // Store refresh token
      await database.query(
        'UPDATE users SET jwt_refresh_token = $1 WHERE id = $2',
        [refreshToken, user.id]
      );

      logger.info('OAuth user registration successful', { 
        userId: user.id, 
        email: user.email, 
        applicationId: client_id 
      });

      // Send webhook notification if configured
      if (application.webhook_url) {
        try {
          const fetch = require('node-fetch');
          
          await fetch(application.webhook_url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'AuthJet-Webhook/1.0'
            },
            body: JSON.stringify({
              event: 'user.registered',
              data: {
                user: {
                  id: user.id,
                  email: user.email,
                  name: user.name,
                  role: user.role
                },
                application_id: client_id,
                timestamp: new Date().toISOString()
              }
            })
          });

          logger.info('Webhook notification sent', { 
            event: 'user.registered', 
            url: application.webhook_url 
          });
        } catch (webhookError) {
          logger.error('Webhook notification failed', { 
            event: 'user.registered', 
            url: application.webhook_url, 
            error: webhookError.message 
          });
        }
      }

      // Build redirect URL with tokens
      const redirectUrl = `${redirect_uri || application.redirect_url}?access_token=${accessToken}&refresh_token=${refreshToken}&token_type=Bearer&expires_in=3600&state=${state || ''}`;
      
      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        redirect_url: redirectUrl,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        },
        tokens: {
          access_token: accessToken,
          refresh_token: refreshToken,
          token_type: 'Bearer',
          expires_in: 3600
        }
      });

    } catch (error) {
      logger.error('OAuth registration error:', error);
      console.error('OAuth registration error details:', error);
      res.status(500).json({
        error: 'server_error',
        error_description: 'Registration failed: ' + error.message
      });
    }
  }

  // User login for OAuth flow - POST /auth/login
  async login(req, res, next) {
    try {
      const { email, password, client_id, redirect_uri, state } = req.body;
      
      if (!email || !password || !client_id) {
        return res.status(400).json({
          error: 'invalid_request',
          error_description: 'Email, password, and client_id are required'
        });
      }

      // Get application details
      const app = await database.query(
        'SELECT id, client_id, name, redirect_url, webhook_url FROM client_applications WHERE id = $1 AND is_active = true',
        [client_id]
      );

      if (app.rows.length === 0) {
        return res.status(400).json({
          error: 'invalid_client',
          error_description: 'Application not found'
        });
      }

      const application = app.rows[0];

      // Find user
      const result = await database.query(
        'SELECT id, email, password_hash, name, role, is_active FROM users WHERE application_id = $1 AND email = $2',
        [client_id, email.toLowerCase()]
      );

      if (result.rows.length === 0) {
        return res.status(400).json({
          error: 'invalid_grant',
          error_description: 'Invalid credentials'
        });
      }

      const user = result.rows[0];

      if (!user.is_active) {
        return res.status(400).json({
          error: 'invalid_grant',
          error_description: 'Account is deactivated'
        });
      }

      // Check password
      const validPassword = await bcrypt.compare(password, user.password_hash);
      
      if (!validPassword) {
        return res.status(400).json({
          error: 'invalid_grant',
          error_description: 'Invalid credentials'
        });
      }

      // Generate JWT tokens
      const accessToken = jwt.sign(
        {
          sub: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          app_id: client_id,
          type: 'access'
        },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const refreshToken = jwt.sign(
        {
          sub: user.id,
          app_id: client_id,
          type: 'refresh'
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      // Update last login and refresh token
      await database.query(
        'UPDATE users SET last_login = NOW(), jwt_refresh_token = $1 WHERE id = $2',
        [refreshToken, user.id]
      );

      logger.info('OAuth user login successful', { 
        userId: user.id, 
        email: user.email, 
        applicationId: client_id 
      });

      // Send webhook notification
      if (application.webhook_url) {
        try {
          const fetch = require('node-fetch');
          
          await fetch(application.webhook_url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'AuthJet-Webhook/1.0'
            },
            body: JSON.stringify({
              event: 'user.login',
              data: {
                user: {
                  id: user.id,
                  email: user.email,
                  name: user.name,
                  role: user.role
                },
                application_id: client_id,
                timestamp: new Date().toISOString()
              }
            })
          });

          logger.info('Webhook notification sent', { 
            event: 'user.login', 
            url: application.webhook_url 
          });
        } catch (webhookError) {
          logger.error('Webhook notification failed', { 
            event: 'user.login', 
            url: application.webhook_url, 
            error: webhookError.message 
          });
        }
      }

      // Build redirect URL with tokens
      const redirectUrl = `${redirect_uri || application.redirect_url}?access_token=${accessToken}&refresh_token=${refreshToken}&token_type=Bearer&expires_in=3600&state=${state || ''}`;
      
      res.json({
        success: true,
        message: 'Login successful',
        redirect_url: redirectUrl,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        },
        tokens: {
          access_token: accessToken,
          refresh_token: refreshToken,
          token_type: 'Bearer',
          expires_in: 3600
        }
      });

    } catch (error) {
      logger.error('OAuth login error:', error);
      res.status(500).json({
        error: 'server_error',
        error_description: 'Login failed'
      });
    }
  }

  // Role request endpoint - POST /auth/request-role
  async requestRole(req, res, next) {
    try {
      const { requested_role, reason } = req.body;
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          error: 'invalid_token',
          error_description: 'Access token required'
        });
      }

      const token = authHeader.substring(7);
      
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        if (decoded.type !== 'access') {
          throw new Error('Invalid token type');
        }

        const userId = decoded.sub;
        const applicationId = decoded.app_id;

        if (!requested_role) {
          return res.status(400).json({
            error: 'invalid_request',
            error_description: 'Requested role is required'
          });
        }

        // Get user and application details
        const userResult = await database.query(
          'SELECT id, email, name, role FROM users WHERE id = $1 AND application_id = $2',
          [userId, applicationId]
        );

        if (userResult.rows.length === 0) {
          return res.status(404).json({
            error: 'invalid_request',
            error_description: 'User not found'
          });
        }

        const user = userResult.rows[0];

        // Get application webhook
        const appResult = await database.query(
          'SELECT role_request_webhook, name FROM client_applications WHERE id = $1',
          [applicationId]
        );

        if (appResult.rows.length === 0) {
          return res.status(404).json({
            error: 'invalid_client',
            error_description: 'Application not found'
          });
        }

        const application = appResult.rows[0];

        // Update user's role request
        await database.query(
          'UPDATE users SET requested_role = $1, role_request_status = $2 WHERE id = $3',
          [requested_role, 'pending', userId]
        );

        // Send webhook notification for role request
        if (application.role_request_webhook) {
          this.sendRoleRequestWebhook(application.role_request_webhook, {
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
              current_role: user.role,
              requested_role: requested_role
            },
            reason: reason || '',
            timestamp: new Date().toISOString(),
            application_id: applicationId,
            application_name: application.name
          });
        }

        logger.info('Role request submitted', { 
          userId: user.id, 
          currentRole: user.role,
          requestedRole: requested_role,
          applicationId: applicationId 
        });

        res.json({
          success: true,
          message: 'Role request submitted successfully',
          status: 'pending'
        });

      } catch (jwtError) {
        return res.status(401).json({
          error: 'invalid_token',
          error_description: 'Invalid or expired token'
        });
      }

    } catch (error) {
      logger.error('Role request error:', error);
      res.status(500).json({
        error: 'server_error',
        error_description: 'Role request failed'
      });
    }
  }

  // Get user profile with JWT - GET /auth/profile
  async getProfile(req, res, next) {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          error: 'invalid_token',
          error_description: 'Access token required'
        });
      }

      const token = authHeader.substring(7);
      
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        if (decoded.type !== 'access') {
          throw new Error('Invalid token type');
        }

        const userId = decoded.sub;
        const applicationId = decoded.app_id;

        const result = await database.query(
          'SELECT id, email, name, role, requested_role, role_request_status, is_active, email_verified, last_login, created_at FROM users WHERE id = $1 AND application_id = $2',
          [userId, applicationId]
        );

        if (result.rows.length === 0) {
          return res.status(404).json({
            error: 'invalid_request',
            error_description: 'User not found'
          });
        }

        const user = result.rows[0];

        res.json({
          success: true,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            requested_role: user.requested_role,
            role_request_status: user.role_request_status,
            is_active: user.is_active,
            email_verified: user.email_verified,
            last_login: user.last_login,
            created_at: user.created_at
          }
        });

      } catch (jwtError) {
        return res.status(401).json({
          error: 'invalid_token',
          error_description: 'Invalid or expired token'
        });
      }

    } catch (error) {
      logger.error('Get profile error:', error);
      res.status(500).json({
        error: 'server_error',
        error_description: 'Failed to get profile'
      });
    }
  }

  // Helper method to send webhook notifications
  async sendWebhookNotification(webhookUrl, event, data) {
    try {
      const fetch = require('node-fetch');
      
      await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'AuthJet-Webhook/1.0'
        },
        body: JSON.stringify({
          event: event,
          data: data
        })
      });

      logger.info('Webhook notification sent', { 
        event: event, 
        url: webhookUrl 
      });

    } catch (error) {
      logger.error('Webhook notification failed', { 
        event: event, 
        url: webhookUrl, 
        error: error.message 
      });
    }
  }

  // Helper method to send role request webhooks
  async sendRoleRequestWebhook(webhookUrl, data) {
    try {
      const fetch = require('node-fetch');
      
      await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'AuthJet-RoleRequest/1.0'
        },
        body: JSON.stringify(data)
      });

      logger.info('Role request webhook sent', { url: webhookUrl });

    } catch (error) {
      logger.error('Role request webhook failed', { 
        url: webhookUrl, 
        error: error.message 
      });
    }
  }
}

module.exports = new OAuthController();
