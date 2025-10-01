const crypto = require('../utils/crypto');
const emailService = require('../services/email.service');
const jwtService = require('../services/jwt.service');
const webhookService = require('../services/webhook.service');
const database = require('../utils/database');
const logger = require('../utils/logger');
const { validateEmail, validatePassword } = require('../utils/validators');

class AuthController {
  async register(req, res, next) {
    const { email, password, client_id, redirect_uri } = req.body;
    
    try {
      // Input validation
      if (!validateEmail(email)) {
        return res.status(400).json({
          error: 'Invalid email format',
          code: 'INVALID_EMAIL',
        });
      }

      if (!validatePassword(password)) {
        return res.status(400).json({
          error: 'Password must be at least 8 characters long and contain uppercase, lowercase, number, and special character',
          code: 'WEAK_PASSWORD',
        });
      }

      // Validate client
      const clientQuery = 'SELECT * FROM clients WHERE id = $1';
      const clientResult = await database.query(clientQuery, [client_id]);
      
      if (clientResult.rows.length === 0) {
        return res.status(400).json({
          error: 'Invalid client ID',
          code: 'INVALID_CLIENT',
        });
      }

      const client = clientResult.rows[0];

      // Check if user already exists for this client
      const userCheckQuery = `
        SELECT id FROM users 
        WHERE email = $1 
        LIMIT 1
      `;
      const userCheckResult = await database.query(userCheckQuery, [email.toLowerCase()]);
      
      let userId;
      let isNewUser = false;

      if (userCheckResult.rows.length > 0) {
        // User exists, check if already linked to this client
        userId = userCheckResult.rows[0].id;
        const clientUserQuery = `
          SELECT 1 FROM client_users 
          WHERE user_id = $1 AND client_id = $2 
          LIMIT 1
        `;
        const clientUserResult = await database.query(clientUserQuery, [userId, client_id]);
        
        if (clientUserResult.rows.length > 0) {
          return res.status(409).json({
            error: 'User already exists for this client',
            code: 'USER_EXISTS',
          });
        }
      } else {
        // Create new user
        isNewUser = true;
        const passwordHash = await crypto.hashPassword(password);
        
        const createUserQuery = `
          INSERT INTO users (email, password_hash, email_verified)
          VALUES ($1, $2, $3)
          RETURNING id
        `;
        
        const userResult = await database.query(createUserQuery, [
          email.toLowerCase(),
          passwordHash,
          false, // Email not verified yet
        ]);
        
        userId = userResult.rows[0].id;
      }

      // Link user to client
      const linkUserQuery = `
        INSERT INTO client_users (user_id, client_id, roles, created_at)
        VALUES ($1, $2, $3, NOW())
      `;
      
      await database.query(linkUserQuery, [
        userId,
        client_id,
        JSON.stringify(client.default_roles || ['user']),
      ]);

      // Call webhook for role/permission data
      let userRoles = client.default_roles || ['user'];
      let customClaims = {};
      
      try {
        const webhookResponse = await webhookService.callUserWebhook(
          client,
          {
            user_id: userId,
            email: email.toLowerCase(),
            action: 'register',
          }
        );
        
        if (webhookResponse.roles) {
          userRoles = webhookResponse.roles;
        }
        if (webhookResponse.custom_claims) {
          customClaims = webhookResponse.custom_claims;
        }

        // Update user roles from webhook response
        await database.query(
          'UPDATE client_users SET roles = $1 WHERE user_id = $2 AND client_id = $3',
          [JSON.stringify(userRoles), userId, client_id]
        );
      } catch (webhookError) {
        logger.warn('Webhook call failed during registration:', webhookError);
        // Continue with default roles
      }

      // Generate tokens
      const accessToken = await jwtService.generateAccessToken({
        sub: userId,
        email: email.toLowerCase(),
        client_id: client_id,
        email_verified: false,
        roles: userRoles,
        ...customClaims,
      });

      const deviceInfo = {
        user_agent: req.get('User-Agent'),
        ip_address: req.ip,
      };

      const refreshToken = await jwtService.generateRefreshToken(
        userId,
        client_id,
        deviceInfo
      );

      // Send welcome email for new users
      if (isNewUser) {
        try {
          await emailService.sendWelcomeEmail(email.toLowerCase(), client.name);
        } catch (emailError) {
          logger.error('Failed to send welcome email:', emailError);
          // Don't fail registration if email fails
        }
      }

      // Audit log
      await database.query(
        'INSERT INTO audit_logs (user_id, client_id, action, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5)',
        [userId, client_id, 'register', req.ip, req.get('User-Agent')]
      );

      logger.info('User registered successfully', { userId, clientId: client_id, email });

      res.status(201).json({
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'Bearer',
        expires_in: 15 * 60,
        user: {
          id: userId,
          email: email.toLowerCase(),
          email_verified: false,
          roles: userRoles,
        },
      });

    } catch (error) {
      logger.error('Registration error:', error);
      next(error);
    }
  }

  async login(req, res, next) {
    const { email, password, client_id } = req.body;
    
    try {
      // Input validation
      if (!email || !password || !client_id) {
        return res.status(400).json({
          error: 'Email, password, and client_id are required',
          code: 'MISSING_FIELDS',
        });
      }

      // Validate client
      const clientQuery = 'SELECT * FROM clients WHERE id = $1';
      const clientResult = await database.query(clientQuery, [client_id]);
      
      if (clientResult.rows.length === 0) {
        return res.status(400).json({
          error: 'Invalid client ID',
          code: 'INVALID_CLIENT',
        });
      }

      const client = clientResult.rows[0];

      // Check failed attempts
      const failedAttemptsQuery = `
        SELECT COUNT(*) as attempts 
        FROM failed_logins 
        WHERE email = $1 AND client_id = $2 AND created_at > NOW() - INTERVAL '1 hour'
      `;
      
      const failedResult = await database.query(failedAttemptsQuery, [email.toLowerCase(), client_id]);
      const failedAttempts = parseInt(failedResult.rows[0].attempts);

      if (failedAttempts >= 5) {
        return res.status(429).json({
          error: 'Too many failed login attempts. Please try again later.',
          code: 'ACCOUNT_LOCKED',
        });
      }

      // Find user
      const userQuery = `
        SELECT u.*, cu.roles
        FROM users u
        JOIN client_users cu ON u.id = cu.user_id
        WHERE u.email = $1 AND cu.client_id = $2
      `;
      
      const userResult = await database.query(userQuery, [email.toLowerCase(), client_id]);
      
      if (userResult.rows.length === 0) {
        await this.recordFailedLogin(email.toLowerCase(), client_id, req.ip);
        return res.status(401).json({
          error: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS',
        });
      }

      const user = userResult.rows[0];

      // Verify password
      const isPasswordValid = await crypto.verifyPassword(password, user.password_hash);
      
      if (!isPasswordValid) {
        await this.recordFailedLogin(email.toLowerCase(), client_id, req.ip);
        return res.status(401).json({
          error: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS',
        });
      }

      // Clear failed attempts on successful login
      await database.query(
        'DELETE FROM failed_logins WHERE email = $1 AND client_id = $2',
        [email.toLowerCase(), client_id]
      );

      // Update user login stats
      await database.query(
        'UPDATE users SET last_login = NOW(), login_count = login_count + 1 WHERE id = $1',
        [user.id]
      );

      // Generate tokens
      const accessToken = await jwtService.generateAccessToken({
        sub: user.id,
        email: user.email,
        client_id: client_id,
        email_verified: user.email_verified,
        roles: user.roles,
      });

      const deviceInfo = {
        user_agent: req.get('User-Agent'),
        ip_address: req.ip,
        device_fingerprint: this.generateDeviceFingerprint(req),
      };

      const refreshToken = await jwtService.generateRefreshToken(
        user.id,
        client_id,
        deviceInfo
      );

      // Audit log
      await database.query(
        'INSERT INTO audit_logs (user_id, client_id, action, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5)',
        [user.id, client_id, 'login', req.ip, req.get('User-Agent')]
      );

      logger.info('User logged in successfully', { userId: user.id, clientId: client_id });

      res.json({
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'Bearer',
        expires_in: 15 * 60,
        user: {
          id: user.id,
          email: user.email,
          email_verified: user.email_verified,
          roles: user.roles,
          last_login: user.last_login,
        },
      });

    } catch (error) {
      logger.error('Login error:', error);
      next(error);
    }
  }

  async recordFailedLogin(email, clientId, ipAddress) {
    try {
      await database.query(
        'INSERT INTO failed_logins (email, client_id, ip_address) VALUES ($1, $2, $3)',
        [email, clientId, ipAddress]
      );
    } catch (error) {
      logger.error('Failed to record failed login:', error);
    }
  }

  generateDeviceFingerprint(req) {
    const components = [
      req.get('User-Agent'),
      req.get('Accept-Language'),
      req.get('Accept-Encoding'),
    ].filter(Boolean).join('|');
    
    return crypto.createHash('sha256').update(components).digest('hex');
  }

  async refreshToken(req, res, next) {
    const { refresh_token } = req.body;
    
    try {
      if (!refresh_token) {
        return res.status(400).json({
          error: 'Refresh token is required',
          code: 'MISSING_REFRESH_TOKEN',
        });
      }

      const tokens = await jwtService.refreshTokens(refresh_token);
      res.json(tokens);

    } catch (error) {
      logger.error('Token refresh error:', error);
      res.status(401).json({
        error: 'Invalid or expired refresh token',
        code: 'INVALID_REFRESH_TOKEN',
      });
    }
  }

  async logout(req, res, next) {
    const { refresh_token } = req.body;
    
    try {
      if (refresh_token) {
        const hashedToken = crypto.createHash('sha256').update(refresh_token).digest('hex');
        await jwtService.revokeRefreshToken(hashedToken);
      }

      res.json({ message: 'Logged out successfully' });

    } catch (error) {
      logger.error('Logout error:', error);
      next(error);
    }
  }

  async verifyToken(req, res, next) {
    const { token } = req.body;
    
    try {
      if (!token) {
        return res.status(400).json({
          error: 'Token is required',
          code: 'MISSING_TOKEN',
        });
      }

      const decoded = await jwtService.verifyToken(token);
      res.json({ valid: true, payload: decoded });

    } catch (error) {
      res.json({ valid: false, error: error.message });
    }
  }
}

module.exports = new AuthController();