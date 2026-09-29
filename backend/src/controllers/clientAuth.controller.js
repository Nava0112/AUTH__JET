const crypto = require('../utils/crypto');
const database = require('../utils/database');
const logger = require('../utils/logger');
const jwtService = require('../services/jwt.service');
const emailService = require('../services/email.service');
const ClientKeyService = require('../services/clientKey.service');
const ApplicationKeyService = require('../services/applicationKey.service');
const Client = require('../models/Client');
const Session = require('../models/Session');
const User = require('../models/User');

class ClientAuthController {
  async register(req, res, next) {
    const {
      name, email, password, company_name, website, phone,
      plan_type = 'basic'
    } = req.body;

    try {
      const existing = await Client.findByEmail(email);

      if (existing) {
        return res.status(409).json({
          error: 'Client with this email already exists',
          code: 'CLIENT_EXISTS',
        });
      }

      const client = await Client.create({
        name,
        email,
        password,
        organization_name: company_name,
        website,
        phone,
        plan_type
      });

      // Send welcome email with verification
      try {
        await emailService.sendClientWelcomeEmail(email, name, client.id);
      } catch (emailError) {
        logger.error('Failed to send welcome email:', emailError);
      }

      // Auto-generate RSA key pair for this client
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
          organization_name: client.organization_name,
          plan_type: client.plan_type,
          created_at: client.created_at,
        },
        api_credentials: {
          client_id: client.client_id,
          client_secret: client.client_secret, // Only shown once
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
      const client = await Client.findByEmail(email);

      if (!client) {
        return res.status(401).json({
          error: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS',
        });
      }

      if (!client.is_active) {
        return res.status(401).json({
          error: 'Account is suspended. Contact support.',
          code: 'ACCOUNT_SUSPENDED',
        });
      }

      const isValidPassword = await crypto.comparePassword(password, client.password_hash);

      if (!isValidPassword) {
        return res.status(401).json({
          error: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS',
        });
      }

      const accessToken = await jwtService.generateAccessToken(
        client.id,
        'client',
        client.id // Pass the database ID as clientId
      );

      const refreshToken = crypto.randomString(64);

      await Session.create({
        session_type: 'client',
        entity_id: client.id,
        refresh_token: refreshToken,
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });

      await Client.update(client.id, { last_login: new Date() });

      logger.info('Client login successful', { clientId: client.id, email });

      res.cookie('refresh_token', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      res.json({
        access_token: accessToken,
        refresh_token: refreshToken, // Still returned for compatibility
        token_type: 'Bearer',
        expires_in: 7200,
        client: {
          id: client.id,
          email: client.email,
          name: client.name,
          organization_name: client.organization_name,
          plan_type: client.plan_type,
        },
      });

    } catch (error) {
      logger.error('Client login error:', error);
      next(error);
    }
  }

  async getProfile(req, res, next) {
    try {
      const client = await Client.findById(req.client.id);

      if (!client) {
        return res.status(404).json({
          error: 'Client not found',
          code: 'CLIENT_NOT_FOUND',
        });
      }

      const {
        client_secret,
        secret_key_hash,
        password_hash,
        ...safeClient
      } = client;

      res.json({ client: safeClient });

    } catch (error) {
      logger.error('Get client profile error:', error);
      next(error);
    }
  }

  async getDashboardStats(req, res, next) {
    try {
      const stats = await Client.getStats(req.client.id);
      res.json({ stats });
    } catch (error) {
      logger.error('Get dashboard stats error:', error);
      next(error);
    }
  }

  async getApplications(req, res, next) {
    try {
      const { page = 1, limit = 10 } = req.query;
      const offset = (page - 1) * limit;

      const query = `
        SELECT 
            ca.id AS app_id, ca.id, ca.client_id, ca.name, ca.description,
            ca.redirect_url, ca.is_active, ca.oauth_application_id,
            ca.oauth_allowed_scopes, ca.oauth_jwt_claims,
          COUNT(DISTINCT u.id) as user_count,
          COUNT(DISTINCT s.id) as active_session_count
        FROM client_applications ca
        LEFT JOIN users u ON ca.id = u.application_id AND u.is_active = true
        LEFT JOIN sessions s ON u.id = s.entity_id AND s.session_type = 'user' AND s.expires_at > NOW() AND s.revoked = false
        WHERE ca.client_id = $1
        GROUP BY ca.id
        ORDER BY ca.id DESC
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
      name, description, redirect_url, oauth_allowed_scopes,
      oauth_jwt_claims = []
    } = req.body;

    try {
      if (!name || !redirect_url) {
        return res.status(400).json({
          error: 'Application name and redirect_url are required',
          code: 'MISSING_APPLICATION_FIELDS'
        });
      }

      const oauth_application_secret = crypto.generateRandomToken(32);
      const oauth_application_id = `authjet_${crypto.generateRandomToken(16)}`;
      const reservedJwtClaims = new Set(['iss', 'sub', 'aud', 'exp', 'iat', 'nbf', 'jti', 'nonce', 'token_use']);
      const jwtClaims = (Array.isArray(oauth_jwt_claims) ? oauth_jwt_claims : [])
        .filter(claim => claim && typeof claim.key === 'string' && /^[A-Za-z][A-Za-z0-9_]*$/.test(claim.key.trim()))
        .filter(claim => !reservedJwtClaims.has(claim.key.trim()))
        .reduce((claims, claim) => {
          claims[claim.key.trim()] = typeof claim.value === 'string' ? claim.value : String(claim.value ?? '');
          return claims;
        }, {});

      const insertQuery = `
        INSERT INTO client_applications (
          client_id, name, description, redirect_url, is_active,
          oauth_application_id, oauth_application_secret,
          oauth_allowed_scopes, oauth_jwt_claims
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;

      const result = await database.query(insertQuery, [
        req.client.id, name, description, redirect_url, true,
        oauth_application_id, oauth_application_secret,
        JSON.stringify(Array.isArray(oauth_allowed_scopes) && oauth_allowed_scopes.length
          ? oauth_allowed_scopes
          : ['openid', 'profile', 'email']),
        JSON.stringify(jwtClaims)
      ]);

      const application = result.rows[0];

      // Auto-generate RSA key pair for the application
      try {
        await ApplicationKeyService.generateKeyPair(application.id);
        logger.info('RSA key pair generated for new application', { applicationId: application.id });
      } catch (keyError) {
        logger.error('Failed to generate RSA key pair for new application:', keyError);
      }

      logger.info('Application created', {
        applicationId: application.id,
        clientId: req.client.id,
        name
      });

      res.status(201).json({
        success: true,
        message: 'Application created successfully',
        application: {
          ...application,
          oauth_application_secret
        }
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
        SELECT ca.*
        FROM client_applications ca
        WHERE ca.id = $1 AND ca.client_id = $2
      `;

      const result = await database.query(query, [id, req.client.id]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Application not found',
          code: 'APPLICATION_NOT_FOUND',
        });
      }

      res.json({ success: true, application: result.rows[0] });

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
        'name', 'description', 'redirect_url', 'is_active',
        'oauth_allowed_scopes', 'oauth_jwt_claims'
      ];

      const updateFields = [];
      const updateValues = [];
      let paramCount = 0;

      allowedFields.forEach(field => {
        if (updates[field] !== undefined) {
          paramCount++;
          updateFields.push(`${field} = $${paramCount}`);

          if (field === 'oauth_allowed_scopes' || field === 'oauth_jwt_claims') {
            updateValues.push(typeof updates[field] === 'string' ? updates[field] : JSON.stringify(updates[field]));
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

      res.json({ success: true, application: result.rows[0] });

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

  async refreshToken(req, res, next) {
    const refreshToken = req.body.refresh_token || req.cookies?.refresh_token;

    try {
      if (!refreshToken) {
        return res.status(401).json({
          error: 'Refresh token is required',
          code: 'REFRESH_TOKEN_REQUIRED'
        });
      }

      const session = await Session.findByRefreshToken(refreshToken);

      if (!session || session.session_type !== 'client' || session.revoked) {
        return res.status(401).json({
          error: 'Invalid or expired refresh token',
          code: 'INVALID_REFRESH_TOKEN'
        });
      }

      if (new Date(session.expires_at) < new Date()) {
        return res.status(401).json({
          error: 'Refresh token has expired',
          code: 'REFRESH_TOKEN_EXPIRED'
        });
      }

      const client = await Client.findById(session.entity_id);
      if (!client || !client.is_active) {
        return res.status(401).json({
          error: 'Client account is inactive or not found',
          code: 'CLIENT_INACTIVE'
        });
      }

      const accessToken = await jwtService.generateAccessToken(
        client.id,
        'client',
        client.id
      );

      const newRefreshToken = crypto.randomString(64);

      // Rotate refresh token
      await Session.create({
        session_type: 'client',
        entity_id: client.id,
        refresh_token: newRefreshToken,
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      });

      await Session.revoke(refreshToken);

      res.cookie('refresh_token', newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      res.json({
        access_token: accessToken,
        refresh_token: newRefreshToken,
        token_type: 'Bearer',
        expires_in: 7200
      });

    } catch (error) {
      logger.error('Client token refresh error:', error);
      next(error);
    }
  }

  async logout(req, res, next) {
    try {
      const refreshToken = req.body.refresh_token || req.cookies?.refresh_token;

      if (refreshToken) {
        await Session.revoke(refreshToken);
      }

      res.clearCookie('refresh_token');
      logger.info('Client logout successful', { clientId: req.client?.id });
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

}

module.exports = new ClientAuthController();
