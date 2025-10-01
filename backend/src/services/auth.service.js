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
      // Validate client - if it's the default client ID, ensure it exists
      let client = await Client.findById(client_id);
      if (!client && client_id === 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11') {
        // Auto-create default client if it doesn't exist
        client = await this.ensureDefaultClient();
      }
      
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
      // Validate client - if it's the default client ID, ensure it exists
      let client = await Client.findById(client_id);
      if (!client && client_id === 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11') {
        // Auto-create default client if it doesn't exist
        client = await this.ensureDefaultClient();
      }
      
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

  async exchangeOAuthCode(code, provider, redirectUri) {
    try {
      logger.info('Starting OAuth code exchange', { provider, redirectUri });
  
      // Validate provider
      if (!['google', 'github'].includes(provider)) {
        throw new Error(`Unsupported OAuth provider: ${provider}`);
      }
  
      // Validate configuration
      if (provider === 'google' && (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET)) {
        throw new Error('Google OAuth configuration is missing');
      }
  
      if (provider === 'github' && (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET)) {
        throw new Error('GitHub OAuth configuration is missing');
      }
  
      let userProfile;
  
      // Exchange code for tokens based on provider
      switch (provider) {
        case 'google':
          userProfile = await this.exchangeGoogleCode(code, redirectUri);
          break;
        case 'github':
          userProfile = await this.exchangeGitHubCode(code, redirectUri);
          break;
        default:
          throw new Error(`Unsupported OAuth provider: ${provider}`);
      }
  
      logger.info('OAuth user profile received', { 
        email: userProfile.email, 
        provider: provider 
      });
  
      // Find or create user in database
      let user = await User.findByEmail(userProfile.email);
  
      if (!user) {
        logger.info('Creating new user from OAuth', { email: userProfile.email });
        // Create new user
        user = await User.create({
          email: userProfile.email,
          name: userProfile.name,
          provider: provider,
          providerId: userProfile.id,
          emailVerified: userProfile.email_verified || true,
          avatar: userProfile.picture || userProfile.avatar_url
        });
      } else {
        logger.info('Existing user found for OAuth', { userId: user.id });
        // Update user with latest OAuth info
        user.provider = provider;
        user.providerId = userProfile.id;
        user.avatar = userProfile.picture || userProfile.avatar_url;
        await user.save();
      }
  
      // Generate JWT tokens
      const tokens = await this.generateTokens(user);
      
      logger.info('OAuth tokens generated successfully', { userId: user.id });
  
      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar
        },
        tokens: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken
        }
      };
      
    } catch (error) {
      logger.error('OAuth code exchange failed', { error: error.message, provider });
      throw new Error(`OAuth authentication failed: ${error.message}`);
    }
  }
  
  // Google OAuth exchange
  async exchangeGoogleCode(code, redirectUri) {
    const { OAuth2Client } = require('google-auth-library');
    
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      throw new Error('Google OAuth not configured');
    }
  
    const client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri
    );
  
    logger.info('Exchanging Google code for tokens');
    const { tokens } = await client.getToken(code);
    
    if (!tokens.id_token) {
      throw new Error('No ID token received from Google');
    }
  
    logger.info('Verifying Google ID token');
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID
    });
  
    const payload = ticket.getPayload();
    
    if (!payload.email) {
      throw new Error('No email in Google OAuth response');
    }
  
    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      email_verified: payload.email_verified
    };
  }
  
  // GitHub OAuth exchange
  async exchangeGitHubCode(code, redirectUri) {
    const axios = require('axios');
    
    if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
      throw new Error('GitHub OAuth not configured');
    }
  
    logger.info('Exchanging GitHub code for access token');
    // Exchange code for access token
    const tokenResponse = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code: code,
        redirect_uri: redirectUri
      },
      {
        headers: { Accept: 'application/json' },
        timeout: 10000
      }
    );
  
    if (tokenResponse.data.error) {
      throw new Error(`GitHub OAuth error: ${tokenResponse.data.error_description}`);
    }
  
    const accessToken = tokenResponse.data.access_token;
  
    if (!accessToken) {
      throw new Error('No access token received from GitHub');
    }
  
    logger.info('Fetching GitHub user profile');
    // Get user profile
    const userResponse = await axios.get('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json'
      },
      timeout: 10000
    });
  
    logger.info('Fetching GitHub user emails');
    // Get user emails
    const emailsResponse = await axios.get('https://api.github.com/user/emails', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json'
      },
      timeout: 10000
    });
  
    const primaryEmail = emailsResponse.data.find(email => email.primary && email.verified) || emailsResponse.data[0];
  
    if (!primaryEmail || !primaryEmail.email) {
      throw new Error('No verified email found for GitHub user');
    }
  
    return {
      id: userResponse.data.id,
      email: primaryEmail.email,
      name: userResponse.data.name || userResponse.data.login,
      avatar_url: userResponse.data.avatar_url,
      email_verified: primaryEmail.verified
    };
  }

  async ensureDefaultClient() {
    try {
      const DEFAULT_CLIENT_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
      
      // Check if default client exists
      let client = await Client.findById(DEFAULT_CLIENT_ID);
      
      if (!client) {
        logger.info('Default client not found, creating...');
        
        // Create default client
        const createQuery = `
          INSERT INTO clients (
            id, name, api_key, api_secret, allowed_origins, 
            allowed_redirect_uris, default_roles, plan_type, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
          RETURNING *
        `;
        
        const apiKey = 'cli_dev_' + crypto.randomString(24);
        const apiSecret = crypto.randomString(32);
        
        const result = await database.query(createQuery, [
          DEFAULT_CLIENT_ID,
          'AuthJet Development Client',
          apiKey,
          crypto.hashToken(apiSecret),
          JSON.stringify(['http://localhost:3000', 'http://127.0.0.1:3000']),
          JSON.stringify(['http://localhost:3000', 'http://localhost:3000/auth/callback']),
          JSON.stringify(['user']),
          'free'
        ]);
        
        client = result.rows[0];
        logger.info('Default client created successfully:', { clientId: DEFAULT_CLIENT_ID });
      }
      
      return client;
    } catch (error) {
      logger.error('Error ensuring default client:', error);
      throw new Error('Failed to initialize default client');
    }
  }

  async generateTokens(user) {
    try {
      // Ensure default client exists and get it
      const defaultClient = await this.ensureDefaultClient();
      const clientId = defaultClient.id;
      
      const accessToken = await jwtService.generateAccessToken({
        sub: user.id,
        email: user.email,
        client_id: clientId,
        email_verified: user.emailVerified || true,
        roles: ['user'], // Default role for OAuth users
      });

      const deviceInfo = {
        user_agent: 'oauth-login',
        ip_address: '127.0.0.1',
      };

      const refreshToken = await jwtService.generateRefreshToken(
        user.id,
        clientId,
        deviceInfo
      );

      return {
        accessToken,
        refreshToken
      };
    } catch (error) {
      logger.error('Token generation error:', error);
      throw new Error('Failed to generate tokens');
    }
  }
}

module.exports = new AuthService();