const crypto = require('../utils/crypto');
const database = require('../utils/database');
const logger = require('../utils/logger');
// IMPORTANT: Use client-specific JWT service for multi-tenant architecture
const userJwtService = require('../services/userJwt.service');
const emailService = require('../services/email.service');

class UserAuthController {

  // Helper method to extract roles from roles_config JSONB
  extractRolesFromConfig(rolesConfig) {
    let available_roles = ['user'];
    let default_user_role = 'user';

    if (rolesConfig) {
      try {
        const roles = typeof rolesConfig === 'string'
          ? JSON.parse(rolesConfig)
          : rolesConfig;

        if (Array.isArray(roles) && roles.length > 0) {
          // Extract available role names
          available_roles = roles.map(role => role.name).filter(Boolean);

          // Find default role: first by isDefault flag, then by lowest hierarchy
          const defaultRoleByFlag = roles.find(role => role.isDefault === true);

          if (defaultRoleByFlag) {
            default_user_role = defaultRoleByFlag.name;
          } else {
            // Use the role with lowest hierarchy as fallback
            const sortedByHierarchy = [...roles].sort((a, b) => (a.hierarchy || 0) - (b.hierarchy || 0));
            default_user_role = sortedByHierarchy[0].name;
          }
        }
      } catch (error) {
        console.warn('Failed to parse roles_config:', error);
      }
    }

    return { available_roles, default_user_role };
  }

  async register(req, res, next) {
    const { email, password, name, client_id, application_id } = req.body;

    try {
      // Validate required fields
      if (!email || !password || !client_id || !application_id) {
        return res.status(400).json({
          error: 'Email, password, client_id, and application_id are required',
          code: 'MISSING_REQUIRED_FIELDS',
        });
      }

      console.log('Register attempt:', { email, client_id, application_id, name });

      // Verify client and application exist and are active
      const appQuery = `
      SELECT 
        ca.*, 
        c.id as client_db_id,
        c.name as client_name, 
        c.plan_type, 
        ca.roles_config,
        ca.auth_mode,
        ca.default_role
      FROM client_applications ca
      JOIN clients c ON ca.client_id = c.id
      WHERE ca.id = $1 AND c.client_id = $2 AND ca.is_active = true AND c.is_active = true
    `;

      console.log('Checking application with:', [application_id, client_id]);
      const appResult = await database.query(appQuery, [application_id, client_id]);
      console.log('Application check result:', appResult.rows.length ? 'Found' : 'Not found');

      if (appResult.rows.length === 0) {
        // Debug why application not found
        const clientCheck = await database.query(
          'SELECT id, client_id, name, is_active FROM clients WHERE client_id = $1',
          [client_id]
        );
        console.log('Client check:', clientCheck.rows);

        const appOnlyCheck = await database.query(
          'SELECT id, client_id, name, is_active FROM client_applications WHERE id = $1',
          [application_id]
        );
        console.log('Application only check:', appOnlyCheck.rows);

        return res.status(400).json({
          error: 'Invalid client application or application not active',
          code: 'INVALID_APPLICATION',
          debug: {
            client_exists: clientCheck.rows.length > 0,
            application_exists: appOnlyCheck.rows.length > 0
          }
        });
      }

      const application = appResult.rows[0];
      const clientDbId = application.client_db_id;

      console.log('Found application:', {
        appName: application.name,
        clientDbId: clientDbId,
        clientName: application.client_name
      });

      // Extract roles from roles_config
      const { available_roles, default_user_role } = this.extractRolesFromConfig(application.roles_config);
      console.log('Roles config:', { available_roles, default_user_role });

      // Check if user already exists for this application
      const existingQuery = `
      SELECT id FROM users 
      WHERE email = $1 AND client_id = $2 AND application_id = $3
    `;

      const existing = await database.query(existingQuery, [email, clientDbId, application_id]);
      console.log('Existing user check:', existing.rows.length ? 'Exists' : 'New user');

      if (existing.rows.length > 0) {
        return res.status(409).json({
          error: 'User already exists for this application',
          code: 'USER_EXISTS',
        });
      }

      // Hash password
      const passwordHash = await crypto.hashPassword(password);
      console.log('Password hashed successfully');

      // Ensure default role is in available roles
      const finalRole = available_roles.includes(default_user_role) ? default_user_role : 'user';
      console.log('Final user role:', finalRole);

      // Create user
      const insertQuery = `
      INSERT INTO users (
        client_id, application_id, email, password_hash, name, role,
        is_active, email_verified, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      RETURNING id, email, name, role, created_at, email_verified
    `;

      const result = await database.query(insertQuery, [
        clientDbId,
        application_id,
        email,
        passwordHash,
        name,
        finalRole,
        true,
        false
      ]);

      const user = result.rows[0];
      console.log('User created successfully:', { userId: user.id, email: user.email });

      // Send email verification
      try {
        await emailService.sendUserVerificationEmail(email, name, user.id, application_id);
        console.log('Verification email sent');
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
        logger.error('Failed to send verification email:', emailError);
      }

      // Generate tokens
      const accessToken = await userJwtService.generateAccessTokenWithFallback(user, client_id, application_id);
      const refreshToken = await userJwtService.generateRefreshToken(user.id, application_id, req.ip);
      console.log('Tokens generated successfully');

      logger.info('User registered successfully', {
        userId: user.id,
        clientId: client_id,
        applicationId: application_id
      });

      res.status(201).json({
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'Bearer',
        expires_in: process.env.NODE_ENV === 'production' ? 3600 : 900,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          email_verified: user.email_verified
        },
        application: {
          id: application_id,
          name: application.name,
          auth_mode: application.auth_mode,
          available_roles: available_roles,
          default_user_role: default_user_role
        }
      });

    } catch (error) {
      console.error('User registration error:', error);
      logger.error('User registration error:', error);
      next(error);
    }
  }

  async login(req, res, next) {
    const { email, password, client_id, application_id } = req.body;

    try {
      // Validate required fields
      if (!email || !password || !client_id || !application_id) {
        return res.status(400).json({
          error: 'Email, password, client_id, and application_id are required',
          code: 'MISSING_REQUIRED_FIELDS',
        });
      }

      console.log('Login attempt:', { email, client_id, application_id });

      // Find user for this specific application - FIXED QUERY
      const userQuery = `
      SELECT 
        u.*, 
        ca.name as application_name, 
        c.name as client_name,
        ca.auth_mode,
        ca.roles_config,
        ca.default_role
      FROM users u
      JOIN clients c ON u.client_id = c.id
      JOIN client_applications ca ON u.application_id = ca.id
      WHERE u.email = $1 
        AND c.client_id = $2 
        AND u.application_id = $3
        AND u.is_active = true 
        AND ca.is_active = true 
        AND c.is_active = true
    `;

      console.log('Executing user query with:', [email, client_id, application_id]);
      const result = await database.query(userQuery, [email, client_id, application_id]);
      console.log('User query result count:', result.rows.length);

      if (result.rows.length === 0) {
        // Detailed debugging for why no user found
        console.log('No user found. Running diagnostic checks...');

        // Check client by string client_id
        const clientCheck = await database.query(
          'SELECT id, client_id, name, is_active FROM clients WHERE client_id = $1',
          [client_id]
        );
        console.log('Client check:', clientCheck.rows[0] || 'Not found');

        // Check application by numeric ID
        const appCheck = await database.query(
          'SELECT id, name, client_id, is_active FROM client_applications WHERE id = $1',
          [application_id]
        );
        console.log('Application check:', appCheck.rows[0] || 'Not found');

        // Check if application belongs to client (using numeric client ID from clients table)
        if (appCheck.rows.length > 0 && clientCheck.rows.length > 0) {
          const appClientMatch = await database.query(
            'SELECT ca.id FROM client_applications ca WHERE ca.id = $1 AND ca.client_id = $2',
            [application_id, clientCheck.rows[0].id]
          );
          console.log('Application-client match:', appClientMatch.rows.length ? 'Matches' : 'No match');
        }

        // Check user with just email to see if they exist in other clients/applications
        const userEmailCheck = await database.query(
          `SELECT u.id, u.email, u.client_id, u.application_id, u.is_active, 
                c.client_id as client_string_id, ca.name as app_name
         FROM users u
         JOIN clients c ON u.client_id = c.id
         JOIN client_applications ca ON u.application_id = ca.id
         WHERE u.email = $1`,
          [email]
        );
        console.log('User by email only (with client/app info):', userEmailCheck.rows);

        return res.status(401).json({
          error: 'Invalid credentials or application',
          code: 'INVALID_CREDENTIALS',
          debug: {
            client_exists: clientCheck.rows.length > 0,
            application_exists: appCheck.rows.length > 0,
            user_by_email_exists: userEmailCheck.rows.length > 0,
            user_matches_client_app: userEmailCheck.rows.some(user =>
              user.client_string_id === client_id && user.application_id == application_id
            )
          }
        });
      }

      const user = result.rows[0];
      console.log('User found:', {
        userId: user.id,
        email: user.email,
        role: user.role,
        isActive: user.is_active,
        clientId: user.client_id, // numeric
        applicationId: user.application_id // numeric
      });

      // Extract roles for the response
      const { available_roles, default_user_role } = this.extractRolesFromConfig(user.roles_config);

      // Password verification
      console.log('Verifying password...');
      let isValidPassword = false;
      try {
        if (typeof crypto.comparePassword === 'function') {
          isValidPassword = await crypto.comparePassword(password, user.password_hash);
        } else if (typeof crypto.verifyPassword === 'function') {
          isValidPassword = await crypto.verifyPassword(password, user.password_hash);
        } else {
          const bcrypt = require('bcrypt');
          isValidPassword = await bcrypt.compare(password, user.password_hash);
        }
        console.log('Password valid:', isValidPassword);
      } catch (passwordError) {
        console.error('Password verification error:', passwordError);
        logger.error('Password verification error:', passwordError);
        isValidPassword = false;
      }

      if (!isValidPassword) {
        console.log('Invalid password for user:', user.email);
        return res.status(401).json({
          error: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS',
        });
      }

      // Update last login
      await database.query(
        'UPDATE users SET last_login = NOW(), updated_at = NOW() WHERE id = $1',
        [user.id]
      );
      console.log('Last login updated');

      // Generate tokens
      const accessToken = await userJwtService.generateAccessTokenWithFallback(user, client_id, application_id);
      const refreshToken = await userJwtService.generateRefreshToken(user.id, application_id, req.ip);
      console.log('Tokens generated');

      logger.info('User login successful', {
        userId: user.id,
        clientId: client_id,
        applicationId: application_id
      });

      // Set HTTP-only cookies for security
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
      };

      res.cookie('access_token', accessToken, {
        ...cookieOptions,
        maxAge: 15 * 60 * 1000, // 15 minutes
      });

      res.cookie('refresh_token', refreshToken, {
        ...cookieOptions,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      console.log('Login successful, sending response');
      res.json({
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'Bearer',
        expires_in: process.env.NODE_ENV === 'production' ? 3600 : 900,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          email_verified: user.email_verified
        },
        application: {
          id: application_id,
          name: user.application_name,
          auth_mode: user.auth_mode,
          available_roles: available_roles,
          default_user_role: default_user_role
        }
      });

    } catch (error) {
      console.error('User login error:', error);
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

      const tokens = await userJwtService.refreshTokens(refresh_token);

      res.json(tokens);

    } catch (error) {
      logger.error('Token refresh error:', error);

      if (error.message.includes('Invalid or expired') || error.message.includes('exceeded maximum uses')) {
        return res.status(401).json({
          error: error.message,
          code: 'INVALID_REFRESH_TOKEN',
        });
      }

      next(error);
    }
  }

  async requestRoleUpgrade(req, res, next) {
    const { user_id } = req.params;
    const { requested_role } = req.body;

    try {
      // Verify user exists and belongs to this application - FIXED QUERY
      const userQuery = `
        SELECT 
          u.*, 
          ca.auth_mode, 
          ca.roles_config,
          ca.default_role,
          c.email as client_email, 
          c.name as client_name
        FROM users u
        JOIN client_applications ca ON u.application_id = ca.id
        JOIN clients c ON u.client_id = c.id
        WHERE u.id = $1 AND u.client_id = $2 AND u.application_id = $3
      `;

      const userResult = await database.query(userQuery, [
        user_id,
        req.user.client_id,
        req.user.application_id
      ]);

      if (userResult.rows.length === 0) {
        return res.status(404).json({
          error: 'User not found',
          code: 'USER_NOT_FOUND',
        });
      }

      const user = userResult.rows[0];

      // Extract available roles from roles_config
      const { available_roles } = this.extractRolesFromConfig(user.roles_config);

      // Check if application supports role management
      if (user.auth_mode !== 'advanced') {
        return res.status(400).json({
          error: 'Role management not supported for this application',
          code: 'ROLES_NOT_SUPPORTED',
        });
      }

      // Check if requested role is valid
      if (!available_roles.includes(requested_role)) {
        return res.status(400).json({
          error: 'Invalid role requested',
          code: 'INVALID_ROLE',
        });
      }

      // Check if user already has this role or higher
      if (user.role === requested_role) {
        return res.status(400).json({
          error: 'User already has this role',
          code: 'ALREADY_HAS_ROLE',
        });
      }

      // Create role request - FIXED column name to match schema
      const requestQuery = `
        INSERT INTO user_role_requests (
          user_id, client_id, application_id, current_user_role, requested_role,
          status, expires_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `;

      const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days

      await database.query(requestQuery, [
        user_id,
        req.user.client_id,
        req.user.application_id,
        user.role, // current_user_role
        requested_role,
        'pending',
        expiresAt
      ]);

      // Send email to client admin
      try {
        await emailService.sendRoleRequestEmail(
          user.client_email,
          user.client_name,
          user.email,
          user.name,
          user.role,
          requested_role,
          expiresAt
        );
      } catch (emailError) {
        logger.error('Failed to send role request email:', emailError);
      }

      logger.info('Role upgrade requested', {
        userId: user_id,
        clientId: req.user.client_id,
        applicationId: req.user.application_id,
        requestedRole: requested_role
      });

      res.json({
        message: 'Role upgrade request submitted. Client admin will review within 3 days.',
        expires_at: expiresAt
      });

    } catch (error) {
      logger.error('Role request error:', error);
      next(error);
    }
  }

  async verifyEmail(req, res, next) {
    const { token } = req.body;

    try {
      if (!token) {
        return res.status(400).json({
          error: 'Verification token required',
          code: 'MISSING_VERIFICATION_TOKEN',
        });
      }

      // In a real implementation, you'd verify the JWT token and extract user ID
      // For now, let's assume token contains user ID (you'd use JWT in production)
      const userId = parseInt(token); // This is simplified - use JWT in production

      const query = `
        UPDATE users 
        SET email_verified = true, updated_at = NOW()
        WHERE id = $1
        RETURNING id, email, email_verified
      `;

      const result = await database.query(query, [userId]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'User not found',
          code: 'USER_NOT_FOUND',
        });
      }

      logger.info('Email verified successfully', { userId });

      res.json({
        message: 'Email verified successfully',
        user: result.rows[0]
      });

    } catch (error) {
      logger.error('Email verification error:', error);
      next(error);
    }
  }

  async getProfile(req, res, next) {
    try {
      const user_id = req.user?.id;

      if (!user_id) {
        return res.status(401).json({
          error: 'User authentication required',
          code: 'USER_AUTH_REQUIRED',
        });
      }

      // FIXED QUERY - removed ca.available_roles
      const query = `
        SELECT 
          u.id, u.email, u.name, u.role, u.email_verified, u.last_login,
          u.created_at, u.updated_at,
          ca.name as application_name, c.name as client_name,
          ca.auth_mode,
          ca.roles_config
        FROM users u
        JOIN client_applications ca ON u.application_id = ca.id
        JOIN clients c ON u.client_id = c.id
        WHERE u.id = $1 AND u.client_id = $2 AND u.application_id = $3
      `;

      const result = await database.query(query, [
        user_id,
        req.user.client_id,
        req.user.application_id
      ]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'User profile not found',
          code: 'PROFILE_NOT_FOUND',
        });
      }

      const user = result.rows[0];

      // Extract roles for the response
      const { available_roles } = this.extractRolesFromConfig(user.roles_config);

      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          email_verified: user.email_verified,
          last_login: user.last_login,
          created_at: user.created_at,
          application: {
            name: user.application_name,
            auth_mode: user.auth_mode,
            available_roles: available_roles
          },
          client: {
            name: user.client_name
          }
        }
      });

    } catch (error) {
      logger.error('Get user profile error:', error);
      next(error);
    }
  }

  async logout(req, res, next) {
    try {
      const { refresh_token } = req.body;
      const user_id = req.user?.id;

      if (refresh_token) {
        await userJwtService.revokeRefreshToken(refresh_token);
      }

      if (user_id) {
        // Revoke all sessions for this user in this application
        await userJwtService.revokeAllUserSessions(
          user_id,
          req.user.client_id,
          req.user.application_id
        );
      }

      logger.info('User logout successful', {
        userId: user_id,
        clientId: req.user?.client_id,
        applicationId: req.user?.application_id
      });

      res.json({ message: 'Logged out successfully' });

    } catch (error) {
      logger.error('User logout error:', error);
      next(error);
    }
  }

  async resendVerificationEmail(req, res, next) {
    const { user_id, email } = req.body;

    try {
      if (!user_id && !email) {
        return res.status(400).json({
          error: 'User ID or email required',
          code: 'MISSING_IDENTIFIER',
        });
      }

      let query = 'SELECT id, email, name, email_verified FROM users WHERE ';
      let params = [];

      if (user_id) {
        query += 'id = $1';
        params.push(user_id);
      } else {
        query += 'email = $1';
        params.push(email);
      }

      const result = await database.query(query, params);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'User not found',
          code: 'USER_NOT_FOUND',
        });
      }

      const user = result.rows[0];

      if (user.email_verified) {
        return res.status(400).json({
          error: 'Email already verified',
          code: 'EMAIL_ALREADY_VERIFIED',
        });
      }

      // Send verification email
      await emailService.sendUserVerificationEmail(
        user.email,
        user.name,
        user.id,
        req.query.application_id
      );

      logger.info('Verification email resent', { userId: user.id });

      res.json({
        message: 'Verification email sent successfully',
        email: user.email
      });

    } catch (error) {
      logger.error('Resend verification error:', error);
      next(error);
    }
  }

  async getRoleRequests(req, res, next) {
    const { user_id } = req.params;

    try {
      const query = `
        SELECT 
          id, current_user_role, requested_role, status, admin_notes,
          created_at, reviewed_at, expires_at
        FROM user_role_requests 
        WHERE user_id = $1 AND client_id = $2 AND application_id = $3
        ORDER BY created_at DESC
      `;

      const result = await database.query(query, [
        user_id,
        req.user.client_id,
        req.user.application_id
      ]);

      res.json({ requests: result.rows });

    } catch (error) {
      logger.error('Get role requests error:', error);
      next(error);
    }
  }

  async updateProfile(req, res, next) {
    const { name } = req.body;
    const user_id = req.user.id;

    try {
      if (!name) {
        return res.status(400).json({
          error: 'Name is required',
          code: 'MISSING_NAME',
        });
      }

      const query = `
        UPDATE users 
        Set name = $1, updated_at = NOW()
        WHERE id = $2 AND client_id = $3 AND application_id = $4
        RETURNING id, email, name, role, email_verified
      `;

      const result = await database.query(query, [
        name,
        user_id,
        req.user.client_id,
        req.user.application_id
      ]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'User not found',
          code: 'USER_NOT_FOUND',
        });
      }

      logger.info('User profile updated', { userId: user_id });

      res.json({
        message: 'Profile updated successfully',
        user: result.rows[0]
      });

    } catch (error) {
      logger.error('Update profile error:', error);
      next(error);
    }
  }
}

// Create instance and export
const userAuthController = new UserAuthController();
module.exports = userAuthController;