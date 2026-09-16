const crypto = require('../utils/crypto');
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
      const validPassword = await crypto.comparePassword(password, user.password_hash);

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

}

module.exports = new OAuthController();
