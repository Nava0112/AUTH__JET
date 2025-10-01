const User = require('../models/User');
const Client = require('../models/Client');
const Session = require('../models/Session');
const crypto = require('../utils/crypto');
const jwtService = require('./jwt.service');
const emailService = require('./email.service');
const webhookService = require('./webhook.service');
const database = require('../utils/database');
const logger = require('../utils/logger');

class AuthService {
  async registerUser(userData) {
    const { email, password, client_id, redirect_uri } = userData;
    
    try {
      // Validate client
      const client = await Client.findById(client_id);
      if (!client) {
        throw new Error('Invalid client ID');
      }

      // Check if user already exists globally
      const existingUser = await User.findByEmail(email);
      let user;
      let isNewUser = false;

      if (existingUser) {
        // User exists, check if already linked to this client
        const clientUserQuery = `
          SELECT 1 FROM client_users 
          WHERE user_id = $1 AND client_id = $2 
          LIMIT 1
        `;
        const clientUserResult = await database.query(clientUserQuery, [existingUser.id, client_id]);
        
        if (clientUserResult.rows.length > 0) {
          throw new Error('User already exists for this client');
        }
        user = existingUser;
      } else {
        // Create new user
        isNewUser = true;
        user = await User.create({ email, password, email_verified: false });
      }

      // Link user to client with default roles
      const linkUserQuery = `
        INSERT INTO client_users (user_id, client_id, roles, created_at)
        VALUES ($1, $2, $3, NOW())
      `;
      
      await database.query(linkUserQuery, [
        user.id,
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
            user_id: user.id,
            email: user.email,
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
          [JSON.stringify(userRoles), user.id, client_id]
        );
      } catch (webhookError) {
        logger.warn('Webhook call failed during registration:', webhookError);
        // Continue with default roles
      }

      // Generate tokens
      const accessToken = await jwtService.generateAccessToken({
        sub: user.id,
        email: user.email,
        client_id: client_id,
        email_verified: false,
        roles: userRoles,
        ...customClaims,
      });

      const deviceInfo = {
        user_agent: userData.user_agent,
        ip_address: userData.ip_address,
      };

      const refreshToken = await jwtService.generateRefreshToken(
        user.id,
        client_id,
        deviceInfo
      );

      // Send welcome email for new users
      if (isNewUser) {
        try {
          await emailService.sendWelcomeEmail(user.email, client.name);
        } catch (emailError) {
          logger.error('Failed to send welcome email:', emailError);
          // Don't fail registration if email fails
        }
      }

      // Audit log
      await database.query(
        'INSERT INTO audit_logs (user_id, client_id, action, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5)',
        [user.id, client_id, 'register', userData.ip_address, userData.user_agent]
      );

      logger.auth('User registered successfully', { userId: user.id, clientId: client_id, email: user.email });

      return {
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'Bearer',
        expires_in: 15 * 60,
        user: {
          id: user.id,
          email: user.email,
          email_verified: false,
          roles: userRoles,
        },
      };

    } catch (error) {
      logger.error('User registration service error:', error);
      throw error;
    }
  }

  async loginUser(loginData) {
    const { email, password, client_id, user_agent, ip_address } = loginData;
    
    try {
      // Validate client
      const client = await Client.findById(client_id);
      if (!client) {
        throw new Error('Invalid client ID');
      }

      // Check failed attempts
      const failedAttempts = await this.getFailedAttempts(email, client_id);
      if (failedAttempts >= 5) {
        throw new Error('Too many failed login attempts');
      }

      // Find user for this client
      const userQuery = `
        SELECT u.*, cu.roles
        FROM users u
        JOIN client_users cu ON u.id = cu.user_id
        WHERE u.email = $1 AND cu.client_id = $2
      `;
      
      const userResult = await database.query(userQuery, [email.toLowerCase(), client_id]);
      
      if (userResult.rows.length === 0) {
        await this.recordFailedLogin(email, client_id, ip_address);
        throw new Error('Invalid credentials');
      }

      const user = userResult.rows[0];

      // Verify password
      const isPasswordValid = await crypto.verifyPassword(password, user.password_hash);
      
      if (!isPasswordValid) {
        await this.recordFailedLogin(email, client_id, ip_address);
        throw new Error('Invalid credentials');
      }

      // Clear failed attempts
      await this.clearFailedAttempts(email, client_id);

      // Update user login stats
      await User.incrementLoginCount(user.id);

      // Generate tokens
      const accessToken = await jwtService.generateAccessToken({
        sub: user.id,
        email: user.email,
        client_id: client_id,
        email_verified: user.email_verified,
        roles: user.roles,
      });

      const deviceInfo = {
        user_agent: user_agent,
        ip_address: ip_address,
        device_fingerprint: this.generateDeviceFingerprint({ user_agent }),
      };

      const refreshToken = await jwtService.generateRefreshToken(
        user.id,
        client_id,
        deviceInfo
      );

      // Audit log
      await database.query(
        'INSERT INTO audit_logs (user_id, client_id, action, ip_address, user_agent, metadata) VALUES ($1, $2, $3, $4, $5, $6)',
        [user.id, client_id, 'login', ip_address, user_agent, JSON.stringify({ device_info: deviceInfo })]
      );

      logger.auth('User logged in successfully', { userId: user.id, clientId: client_id, email: user.email });

      return {
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
      };

    } catch (error) {
      logger.error('User login service error:', error);
      throw error;
    }
  }

  async refreshTokens(refreshToken) {
    try {
      return await jwtService.refreshTokens(refreshToken);
    } catch (error) {
      logger.error('Token refresh service error:', error);
      throw error;
    }
  }

  async logoutUser(refreshToken) {
    try {
      if (refreshToken) {
        const hashedToken = crypto.hashToken(refreshToken);
        await Session.revoke(hashedToken);
      }
      
      return { message: 'Logged out successfully' };
    } catch (error) {
      logger.error('User logout service error:', error);
      throw error;
    }
  }

  async verifyToken(token) {
    try {
      const decoded = await jwtService.verifyToken(token);
      return { valid: true, payload: decoded };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  async getFailedAttempts(email, clientId) {
    try {
      const query = `
        SELECT COUNT(*) as attempts 
        FROM failed_logins 
        WHERE email = $1 AND client_id = $2 AND created_at > NOW() - INTERVAL '1 hour'
      `;
      
      const result = await database.query(query, [email.toLowerCase(), clientId]);
      return parseInt(result.rows[0].attempts) || 0;
    } catch (error) {
      logger.error('Get failed attempts error:', error);
      return 0;
    }
  }

  async recordFailedLogin(email, clientId, ipAddress) {
    try {
      await database.query(
        'INSERT INTO failed_logins (email, client_id, ip_address) VALUES ($1, $2, $3)',
        [email.toLowerCase(), clientId, ipAddress]
      );
    } catch (error) {
      logger.error('Record failed login error:', error);
    }
  }

  async clearFailedAttempts(email, clientId) {
    try {
      await database.query(
        'DELETE FROM failed_logins WHERE email = $1 AND client_id = $2',
        [email.toLowerCase(), clientId]
      );
    } catch (error) {
      logger.error('Clear failed attempts error:', error);
    }
  }

  generateDeviceFingerprint(req) {
    const components = [
      req.user_agent,
      req.accept_language,
      req.accept_encoding,
    ].filter(Boolean).join('|');
    
    return crypto.hashToken(components);
  }

  async validateClientAccess(clientId, domain) {
    return await Client.validateDomain(clientId, domain);
  }

  async getUserSessions(userId, clientId) {
    try {
      return await Session.findByUserId(userId, clientId);
    } catch (error) {
      logger.error('Get user sessions service error:', error);
      throw error;
    }
  }

  async revokeUserSession(sessionId, userId, clientId) {
    try {
      const session = await Session.revokeById(sessionId, userId, clientId);
      if (!session) {
        throw new Error('Session not found');
      }
      return { message: 'Session revoked successfully' };
    } catch (error) {
      logger.error('Revoke user session service error:', error);
      throw error;
    }
  }

  async revokeAllUserSessions(userId, clientId) {
    try {
      const revokedCount = await Session.revokeAllUserSessions(userId, clientId);
      return { 
        message: `Revoked ${revokedCount} sessions successfully`,
        revoked_count: revokedCount,
      };
    } catch (error) {
      logger.error('Revoke all user sessions service error:', error);
      throw error;
    }
  }

  async exchangeOAuthCode(provider, code) {
    try {
      let userInfo;
      
      if (provider === 'google') {
        userInfo = await this.exchangeGoogleCode(code);
      } else if (provider === 'github') {
        userInfo = await this.exchangeGithubCode(code);
      } else {
        throw new Error(`Unsupported OAuth provider: ${provider}`);
      }

      // Find or create user
      let user = await User.findByEmail(userInfo.email);
      
      if (!user) {
        // Create new user with OAuth - generate random password for OAuth users
        user = await User.create({
          email: userInfo.email,
          password: crypto.randomString(32),
          email_verified: userInfo.email_verified || false,
        });
      }

      // For now, using a default client_id - in production, this should be passed from the OAuth state
      const client_id = process.env.DEFAULT_CLIENT_ID;
      const client = await Client.findById(client_id);
      
      if (!client) {
        throw new Error('Invalid client configuration');
      }

      // Link user to client if not already linked
      const clientUserQuery = `
        SELECT 1 FROM client_users 
        WHERE user_id = $1 AND client_id = $2 
        LIMIT 1
      `;
      const clientUserResult = await database.query(clientUserQuery, [user.id, client_id]);
      
      if (clientUserResult.rows.length === 0) {
        await database.query(
          'INSERT INTO client_users (user_id, client_id, roles, created_at) VALUES ($1, $2, $3, NOW())',
          [user.id, client_id, JSON.stringify(client.default_roles || ['user'])]
        );
      }

      // Get user roles
      const rolesQuery = await database.query(
        'SELECT roles FROM client_users WHERE user_id = $1 AND client_id = $2',
        [user.id, client_id]
      );
      const userRoles = rolesQuery.rows[0]?.roles || ['user'];

      // Generate tokens
      const accessToken = await jwtService.generateAccessToken({
        sub: user.id,
        email: user.email,
        client_id: client_id,
        email_verified: user.email_verified,
        roles: userRoles,
      });

      const refreshToken = await jwtService.generateRefreshToken(
        user.id,
        client_id,
        { oauth_provider: provider }
      );

      // Audit log
      await database.query(
        'INSERT INTO audit_logs (user_id, client_id, action, metadata) VALUES ($1, $2, $3, $4)',
        [user.id, client_id, 'oauth_login', JSON.stringify({ provider })]
      );

      logger.auth('User logged in via OAuth', { userId: user.id, clientId: client_id, provider });

      return {
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'Bearer',
        expires_in: 15 * 60,
        user: {
          id: user.id,
          email: user.email,
          email_verified: user.email_verified,
          roles: userRoles,
        },
      };
    } catch (error) {
      logger.error('OAuth code exchange error:', error);
      throw error;
    }
  }

  async exchangeGoogleCode(code) {
    try {
      const axios = require('axios');
      
      // Exchange code for tokens
      const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${process.env.API_URL}/api/auth/oauth/google/callback`,
        grant_type: 'authorization_code',
      });

      const { access_token, id_token } = tokenResponse.data;

      // Get user info
      const userInfoResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${access_token}` },
      });

      const userInfo = userInfoResponse.data;

      return {
        email: userInfo.email,
        email_verified: userInfo.verified_email,
        oauth_id: userInfo.id,
        name: userInfo.name,
        picture: userInfo.picture,
      };
    } catch (error) {
      logger.error('Google OAuth exchange error:', error);
      throw new Error('Failed to exchange Google OAuth code');
    }
  }

  async exchangeGithubCode(code) {
    try {
      const axios = require('axios');
      
      // Exchange code for access token
      const tokenResponse = await axios.post(
        'https://github.com/login/oauth/access_token',
        {
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: `${process.env.API_URL}/api/auth/oauth/github/callback`,
        },
        {
          headers: { Accept: 'application/json' },
        }
      );

      const { access_token } = tokenResponse.data;

      // Get user info
      const userInfoResponse = await axios.get('https://api.github.com/user', {
        headers: { Authorization: `bearer ${access_token}` },
      });

      const userInfo = userInfoResponse.data;

      // Get user email (GitHub requires separate endpoint)
      const emailResponse = await axios.get('https://api.github.com/user/emails', {
        headers: { Authorization: `bearer ${access_token}` },
      });

      const primaryEmail = emailResponse.data.find(email => email.primary);

      return {
        email: primaryEmail.email,
        email_verified: primaryEmail.verified,
        oauth_id: userInfo.id.toString(),
        name: userInfo.name || userInfo.login,
        picture: userInfo.avatar_url,
      };
    } catch (error) {
      logger.error('GitHub OAuth exchange error:', error);
      throw new Error('Failed to exchange GitHub OAuth code');
    }
  }
}

module.exports = new AuthService();