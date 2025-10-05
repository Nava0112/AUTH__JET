const crypto = require('../utils/crypto');
const database = require('../utils/database');
const logger = require('../utils/logger');
const jwtService = require('../services/jwt.service');
const emailService = require('../services/email.service');

class UserAuthController {
  async register(req, res, next) {
    const { email, password, name, roles = ['user'], custom_data = {} } = req.body;
    
    try {
      // Application is already authenticated via middleware
      const application = req.application;

      // Check if user already exists in this application
      const existingQuery = `
        SELECT id FROM users 
        WHERE application_id = $1 AND email = $2
      `;
      const existing = await database.query(existingQuery, [application.id, email]);
      
      if (existing.rows.length > 0) {
        return res.status(409).json({
          error: 'User with this email already exists in this application',
          code: 'USER_EXISTS',
        });
      }

      // Validate roles against application's available roles
      const availableRoles = application.settings?.available_roles || ['user', 'admin'];
      const invalidRoles = roles.filter(role => !availableRoles.includes(role));
      
      if (invalidRoles.length > 0) {
        return res.status(400).json({
          error: `Invalid roles: ${invalidRoles.join(', ')}`,
          code: 'INVALID_ROLES',
        });
      }

      // Hash password
      const passwordHash = await crypto.hashPassword(password);

      // Create user
      const insertQuery = `
        INSERT INTO users (
          client_id, application_id, email, password_hash, name, 
          roles, custom_data, is_active, email_verified
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, email, name, roles, is_active, created_at
      `;
      
      const result = await database.query(insertQuery, [
        application.client_id,
        application.id,
        email,
        passwordHash,
        name,
        JSON.stringify(roles),
        JSON.stringify(custom_data),
        true,
        false
      ]);

      const user = result.rows[0];

      // Send verification email if configured
      try {
        await emailService.sendUserVerificationEmail(
          email, 
          name, 
          user.id, 
          application.name
        );
      } catch (emailError) {
        logger.error('Failed to send verification email:', emailError);
      }

      // Log the registration
      await database.query(`
        INSERT INTO audit_logs (user_id, client_id, application_id, action, ip_address, user_agent)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [user.id, application.client_id, application.id, 'user_registered', req.ip, req.get('User-Agent')]);

      logger.info('User registered successfully', { 
        userId: user.id, 
        email, 
        applicationId: application.id 
      });

      res.status(201).json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          roles: user.roles,
          is_active: user.is_active,
          created_at: user.created_at,
        },
        message: 'User registered successfully. Please verify your email.',
      });

    } catch (error) {
      logger.error('User registration error:', error);
      next(error);
    }
  }

  async login(req, res, next) {
    const { email, password } = req.body;
    
    try {
      const application = req.application;

      // Find user in this application
      const userQuery = `
        SELECT 
          u.id, u.email, u.password_hash, u.name, u.roles, u.custom_data,
          u.is_active, u.email_verified, u.last_login, u.login_count
        FROM users u
        WHERE u.application_id = $1 AND u.email = $2
      `;
      
      const result = await database.query(userQuery, [application.id, email]);

      if (result.rows.length === 0) {
        return res.status(401).json({
          error: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS',
        });
      }

      const user = result.rows[0];

      if (!user.is_active) {
        return res.status(401).json({
          error: 'Account is disabled. Contact support.',
          code: 'ACCOUNT_DISABLED',
        });
      }

      // Verify password
      const isValidPassword = await crypto.comparePassword(password, user.password_hash);
      
      if (!isValidPassword) {
        return res.status(401).json({
          error: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS',
        });
      }

      // Generate tokens
      const accessToken = await jwtService.generateToken(user.id, '1h');
      const refreshToken = await jwtService.generateToken(user.id, '7d');

      // Create session
      const sessionQuery = `
        INSERT INTO sessions (
          user_id, client_id, application_id, session_type, 
          token_hash, refresh_token_hash, expires_at, refresh_expires_at,
          ip_address, user_agent
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id
      `;

      const tokenHash = await crypto.hashPassword(accessToken);
      const refreshTokenHash = await crypto.hashPassword(refreshToken);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      await database.query(sessionQuery, [
        user.id,
        application.client_id,
        application.id,
        'user',
        tokenHash,
        refreshTokenHash,
        expiresAt,
        refreshExpiresAt,
        req.ip,
        req.get('User-Agent')
      ]);

      // Update login stats
      await database.query(`
        UPDATE users 
        SET last_login = NOW(), login_count = login_count + 1 
        WHERE id = $1
      `, [user.id]);

      // Log the login
      await database.query(`
        INSERT INTO audit_logs (user_id, client_id, application_id, action, ip_address, user_agent)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [user.id, application.client_id, application.id, 'user_login', req.ip, req.get('User-Agent')]);

      logger.info('User login successful', { 
        userId: user.id, 
        email, 
        applicationId: application.id 
      });

      res.json({
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'Bearer',
        expires_in: 3600,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          roles: user.roles,
          custom_data: user.custom_data,
          email_verified: user.email_verified,
        },
      });

    } catch (error) {
      logger.error('User login error:', error);
      next(error);
    }
  }

  async refreshToken(req, res, next) {
    const { refresh_token } = req.body;
    
    try {
      if (!refresh_token) {
        return res.status(400).json({
          error: 'Refresh token required',
          code: 'MISSING_REFRESH_TOKEN',
        });
      }

      // Verify refresh token
      const decoded = await jwtService.verifyToken(refresh_token);
      
      // Find valid session
      const sessionQuery = `
        SELECT s.*, u.email, u.name, u.roles, u.custom_data, u.is_active
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.user_id = $1 AND s.session_type = 'user' 
        AND s.refresh_expires_at > NOW() AND s.revoked = false
        AND s.application_id = $2
      `;
      
      const sessionResult = await database.query(sessionQuery, [decoded.sub, req.application.id]);
      
      if (sessionResult.rows.length === 0) {
        return res.status(401).json({
          error: 'Invalid or expired refresh token',
          code: 'INVALID_REFRESH_TOKEN',
        });
      }

      const session = sessionResult.rows[0];

      if (!session.is_active) {
        return res.status(401).json({
          error: 'User account is disabled',
          code: 'ACCOUNT_DISABLED',
        });
      }

      // Generate new tokens
      const newAccessToken = await jwtService.generateToken(session.user_id, '1h');
      const newRefreshToken = await jwtService.generateToken(session.user_id, '7d');

      // Update session with new tokens
      const newTokenHash = await crypto.hashPassword(newAccessToken);
      const newRefreshTokenHash = await crypto.hashPassword(newRefreshToken);
      const newExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      const newRefreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      await database.query(`
        UPDATE sessions 
        SET token_hash = $1, refresh_token_hash = $2, 
            expires_at = $3, refresh_expires_at = $4, updated_at = NOW()
        WHERE id = $5
      `, [newTokenHash, newRefreshTokenHash, newExpiresAt, newRefreshExpiresAt, session.id]);

      res.json({
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
        token_type: 'Bearer',
        expires_in: 3600,
        user: {
          id: session.user_id,
          email: session.email,
          name: session.name,
          roles: session.roles,
          custom_data: session.custom_data,
        },
      });

    } catch (error) {
      logger.error('Refresh token error:', error);
      next(error);
    }
  }

  async getProfile(req, res, next) {
    try {
      const userQuery = `
        SELECT 
          id, email, name, roles, custom_data, is_active, 
          email_verified, last_login, login_count, created_at, updated_at
        FROM users 
        WHERE id = $1
      `;
      
      const result = await database.query(userQuery, [req.user.id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'User not found',
          code: 'USER_NOT_FOUND',
        });
      }

      res.json({ user: result.rows[0] });

    } catch (error) {
      logger.error('Get user profile error:', error);
      next(error);
    }
  }

  async updateProfile(req, res, next) {
    try {
      const { name, custom_data } = req.body;
      const updates = {};
      const params = [];
      let paramCount = 0;

      if (name !== undefined) {
        paramCount++;
        updates[`name = $${paramCount}`] = true;
        params.push(name);
      }

      if (custom_data !== undefined) {
        paramCount++;
        updates[`custom_data = $${paramCount}`] = true;
        params.push(JSON.stringify(custom_data));
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({
          error: 'No valid fields to update',
          code: 'NO_VALID_FIELDS',
        });
      }

      paramCount++;
      params.push(req.user.id);

      const query = `
        UPDATE users 
        SET ${Object.keys(updates).join(', ')}, updated_at = NOW()
        WHERE id = $${paramCount}
        RETURNING id, email, name, roles, custom_data, updated_at
      `;

      const result = await database.query(query, params);

      logger.info('User profile updated', { userId: req.user.id });

      res.json({ user: result.rows[0] });

    } catch (error) {
      logger.error('Update user profile error:', error);
      next(error);
    }
  }

  async changePassword(req, res, next) {
    const { current_password, new_password } = req.body;
    
    try {
      // Get current password hash
      const userQuery = 'SELECT password_hash FROM users WHERE id = $1';
      const result = await database.query(userQuery, [req.user.id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'User not found',
          code: 'USER_NOT_FOUND',
        });
      }

      // Verify current password
      const isValidPassword = await crypto.comparePassword(current_password, result.rows[0].password_hash);
      
      if (!isValidPassword) {
        return res.status(400).json({
          error: 'Current password is incorrect',
          code: 'INVALID_CURRENT_PASSWORD',
        });
      }

      // Hash new password
      const newPasswordHash = await crypto.hashPassword(new_password);

      // Update password
      await database.query(
        'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
        [newPasswordHash, req.user.id]
      );

      // Revoke all other sessions for security
      await database.query(`
        UPDATE sessions 
        SET revoked = true, revoked_at = NOW() 
        WHERE user_id = $1 AND session_type = 'user'
      `, [req.user.id]);

      // Log the password change
      await database.query(`
        INSERT INTO audit_logs (user_id, client_id, application_id, action, ip_address, user_agent)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [req.user.id, req.user.client_id, req.user.application_id, 'password_changed', req.ip, req.get('User-Agent')]);

      logger.info('User password changed', { userId: req.user.id });

      res.json({ message: 'Password changed successfully. Please log in again.' });

    } catch (error) {
      logger.error('Change password error:', error);
      next(error);
    }
  }

  async getSessions(req, res, next) {
    try {
      const sessionsQuery = `
        SELECT 
          id, ip_address, user_agent, created_at, expires_at,
          CASE WHEN expires_at > NOW() AND revoked = false THEN true ELSE false END as is_active
        FROM sessions 
        WHERE user_id = $1 AND session_type = 'user'
        ORDER BY created_at DESC
        LIMIT 20
      `;
      
      const result = await database.query(sessionsQuery, [req.user.id]);

      res.json({ sessions: result.rows });

    } catch (error) {
      logger.error('Get user sessions error:', error);
      next(error);
    }
  }

  async revokeSession(req, res, next) {
    try {
      const { sessionId } = req.params;

      const query = `
        UPDATE sessions 
        SET revoked = true, revoked_at = NOW()
        WHERE id = $1 AND user_id = $2 AND session_type = 'user'
        RETURNING id
      `;

      const result = await database.query(query, [sessionId, req.user.id]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Session not found',
          code: 'SESSION_NOT_FOUND',
        });
      }

      res.json({ message: 'Session revoked successfully' });

    } catch (error) {
      logger.error('Revoke session error:', error);
      next(error);
    }
  }

  async revokeAllSessions(req, res, next) {
    try {
      await database.query(`
        UPDATE sessions 
        SET revoked = true, revoked_at = NOW()
        WHERE user_id = $1 AND session_type = 'user'
      `, [req.user.id]);

      res.json({ message: 'All sessions revoked successfully' });

    } catch (error) {
      logger.error('Revoke all sessions error:', error);
      next(error);
    }
  }

  async getActivity(req, res, next) {
    try {
      const { page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      const activityQuery = `
        SELECT action, ip_address, user_agent, metadata, created_at
        FROM audit_logs 
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `;

      const result = await database.query(activityQuery, [req.user.id, limit, offset]);

      res.json({ activity: result.rows });

    } catch (error) {
      logger.error('Get user activity error:', error);
      next(error);
    }
  }

  async getPermissions(req, res, next) {
    try {
      // For advanced auth applications, return detailed permissions
      // For basic auth, return simple role-based permissions
      
      const permissions = {
        roles: req.user.roles,
        auth_type: req.user.auth_type,
        permissions: []
      };

      if (req.user.auth_type === 'advanced') {
        // TODO: Implement advanced permission system
        permissions.permissions = ['read', 'write']; // Placeholder
      } else {
        // Basic permissions based on roles
        if (req.user.roles.includes('admin')) {
          permissions.permissions = ['read', 'write', 'delete', 'manage_users'];
        } else {
          permissions.permissions = ['read'];
        }
      }

      res.json({ permissions });

    } catch (error) {
      logger.error('Get user permissions error:', error);
      next(error);
    }
  }

  async getCustomData(req, res, next) {
    try {
      const userQuery = 'SELECT custom_data FROM users WHERE id = $1';
      const result = await database.query(userQuery, [req.user.id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'User not found',
          code: 'USER_NOT_FOUND',
        });
      }

      res.json({ custom_data: result.rows[0].custom_data });

    } catch (error) {
      logger.error('Get custom data error:', error);
      next(error);
    }
  }

  async updateCustomData(req, res, next) {
    try {
      const { custom_data } = req.body;

      const query = `
        UPDATE users 
        SET custom_data = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING custom_data
      `;

      const result = await database.query(query, [JSON.stringify(custom_data), req.user.id]);

      res.json({ custom_data: result.rows[0].custom_data });

    } catch (error) {
      logger.error('Update custom data error:', error);
      next(error);
    }
  }

  async logout(req, res, next) {
    try {
      // Revoke current session
      await database.query(`
        UPDATE sessions 
        SET revoked = true, revoked_at = NOW()
        WHERE user_id = $1 AND session_type = 'user' AND expires_at > NOW() AND revoked = false
      `, [req.user.id]);

      logger.info('User logout successful', { userId: req.user.id });

      res.json({ message: 'Logged out successfully' });

    } catch (error) {
      logger.error('User logout error:', error);
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

  // OAuth and other methods would be implemented here
  async oauthAuthorize(req, res, next) {
    try {
      res.json({ message: 'OAuth authorize endpoint - to be implemented' });
    } catch (error) {
      next(error);
    }
  }

  async oauthToken(req, res, next) {
    try {
      res.json({ message: 'OAuth token endpoint - to be implemented' });
    } catch (error) {
      next(error);
    }
  }

  async oauthRevoke(req, res, next) {
    try {
      res.json({ message: 'OAuth revoke endpoint - to be implemented' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new UserAuthController();
