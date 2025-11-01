const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const database = require('../utils/database');
const logger = require('../utils/logger');
const bcrypt = require('bcryptjs');
const ClientKeyService = require('./clientKey.service');

class OAuthService {
  constructor() {
    this.initializeStrategies();
  }
  initializeStrategies() {
    // Skip strategy initialization in test environment
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    // Google OAuth Strategy
    passport.use('google-client', new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${process.env.BACKEND_URL || 'http://localhost:8000'}/api/auth/google/callback`,
      scope: ['profile', 'email']
    }, async (accessToken, refreshToken, profile, done) => {
      try {
        const result = await this.handleGoogleAuth(profile, 'client');
        return done(null, result);
      } catch (error) {
        return done(error, null);
      }
    }));

    // Google OAuth Strategy for Admin
    passport.use('google-admin', new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${process.env.BACKEND_URL || 'http://localhost:8000'}/api/auth/google/admin/callback`,
      scope: ['profile', 'email']
    }, async (accessToken, refreshToken, profile, done) => {
      try {
        const result = await this.handleGoogleAuth(profile, 'admin');
        return done(null, result);
      } catch (error) {
        return done(error, null);
      }
    }));

    // GitHub OAuth Strategy
    passport.use('github-client', new GitHubStrategy({
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: `${process.env.BACKEND_URL || 'http://localhost:8000'}/api/auth/github/callback`,
      scope: ['user:email']
    }, async (accessToken, refreshToken, profile, done) => {
      try {
        const result = await this.handleGitHubAuth(profile, 'client');
        return done(null, result);
      } catch (error) {
        return done(error, null);
      }
    }));

    // GitHub OAuth Strategy for Admin
    passport.use('github-admin', new GitHubStrategy({
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: `${process.env.BACKEND_URL || 'http://localhost:8000'}/api/auth/github/admin/callback`,
      scope: ['user:email']
    }, async (accessToken, refreshToken, profile, done) => {
      try {
        const result = await this.handleGitHubAuth(profile, 'admin');
        return done(null, result);
      } catch (error) {
        return done(error, null);
      }
    }));

    // Passport serialization
    passport.serializeUser((user, done) => {
      done(null, user);
    });

    passport.deserializeUser((user, done) => {
      done(null, user);
    });
  }

  async handleGoogleAuth(profile, userType) {
    const email = profile.emails[0].value;
    const name = profile.displayName;
    const googleId = profile.id;

    if (userType === 'admin') {
      return await this.handleAdminOAuth(email, name, googleId, 'google');
    } else {
      return await this.handleClientOAuth(email, name, googleId, 'google');
    }
  }

  async handleGitHubAuth(profile, userType) {
    // Try multiple sources for email
    let email = null;
    
    // Check profile.emails array
    if (profile.emails && profile.emails.length > 0) {
      email = profile.emails[0].value;
    }
    
    // Check profile._json for email
    if (!email && profile._json && profile._json.email) {
      email = profile._json.email;
    }
    
    // Use username@users.noreply.github.com as fallback
    if (!email && profile.username) {
      email = `${profile.username}@users.noreply.github.com`;
      logger.warn('GitHub email not available, using fallback email', { username: profile.username, fallbackEmail: email });
    }
    
    if (!email) {
      throw new Error('Unable to obtain email from GitHub profile. Please ensure your GitHub email is public or contact support.');
    }
    
    const name = profile.displayName || profile.username;
    const githubId = profile.id;

    if (userType === 'admin') {
      return await this.handleAdminOAuth(email, name, githubId, 'github');
    } else {
      return await this.handleClientOAuth(email, name, githubId, 'github');
    }
  }

  // Advanced OAuth code exchange method (compatible with auth.service.js)
  async exchangeOAuthCode(code, provider, redirectUri, userType = 'client') {
    try {
      logger.info('Starting OAuth code exchange', { provider, redirectUri, userType });

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
        provider: provider,
        userType: userType
      });

      // Handle based on user type (admin vs client)
      if (userType === 'admin') {
        return await this.handleAdminOAuth(userProfile.email, userProfile.name, userProfile.id, provider);
      } else {
        return await this.handleClientOAuth(userProfile.email, userProfile.name, userProfile.id, provider);
      }
      
    } catch (error) {
      logger.error('OAuth code exchange failed', { error: error.message, provider, userType });
      throw new Error(`OAuth authentication failed: ${error.message}`);
    }
  }

  // Google OAuth exchange
  async exchangeGoogleCode(code, redirectUri) {
    try {
      // Use dynamic import to handle missing module gracefully
      let OAuth2Client;
      try {
        const googleAuth = require('google-auth-library');
        OAuth2Client = googleAuth.OAuth2Client;
      } catch (error) {
        logger.error('Google auth library not found. Please run: npm install google-auth-library');
        throw new Error('OAuth provider not configured properly');
      }
      
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
    } catch (error) {
      logger.error('Google OAuth exchange failed:', error);
      throw new Error(`Google OAuth failed: ${error.message}`);
    }
  }
  
  // GitHub OAuth exchange
  async exchangeGitHubCode(code, redirectUri) {
    const axios = require('axios');
    
    try {
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
    } catch (error) {
      logger.error('GitHub OAuth exchange failed:', error);
      throw new Error(`GitHub OAuth failed: ${error.message}`);
    }
  }

  async handleAdminOAuth(email, name, providerId, provider) {
    try {
      // Check if admin exists in admin table by email OR by provider ID
      let adminResult;
      
      if (provider === 'google') {
        adminResult = await database.query(
          'SELECT id, email, name, is_active, google_id FROM admins WHERE email = $1 OR google_id = $2',
          [email.toLowerCase(), providerId]
        );
      } else if (provider === 'github') {
        adminResult = await database.query(
          'SELECT id, email, name, is_active, github_id FROM admins WHERE email = $1 OR github_id = $2',
          [email.toLowerCase(), providerId]
        );
      }

      if (adminResult.rows.length === 0) {
        throw new Error('Admin not found. Only existing admins can login via OAuth.');
      }

      const admin = adminResult.rows[0];

      if (!admin.is_active) {
        throw new Error('Admin account is deactivated');
      }

      // Update admin with OAuth provider info and ensure email is synced
      if (provider === 'google') {
        await database.query(
          `UPDATE admins SET 
           google_id = $1,
           email = $2,
           name = COALESCE(NULLIF(name, ''), $3),
           last_login = NOW(),
           updated_at = NOW()
           WHERE id = $4`,
          [providerId, email.toLowerCase(), name, admin.id]
        );
      } else if (provider === 'github') {
        await database.query(
          `UPDATE admins SET 
           github_id = $1,
           email = $2,
           name = COALESCE(NULLIF(name, ''), $3),
           last_login = NOW(),
           updated_at = NOW()
           WHERE id = $4`,
          [providerId, email.toLowerCase(), name, admin.id]
        );
      }

      // Generate JWT token for admin using platform key
      const jwt = require('jsonwebtoken');
      const token = jwt.sign(
        {
          sub: admin.id,
          email: email.toLowerCase(),
          name: name || admin.name,
          type: 'admin',
          provider: provider,
          iat: Math.floor(Date.now() / 1000)
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      logger.info('Admin OAuth login successful', { 
        adminId: admin.id, 
        email: email.toLowerCase(), 
        provider: provider,
        providerId: providerId
      });

      return {
        success: true,
        userType: 'admin',
        admin: {
          id: admin.id,
          email: email.toLowerCase(),
          name: name || admin.name
        },
        token: token
      };

    } catch (error) {
      logger.error('Admin OAuth error:', error);
      throw error;
    }
  }

  async handleClientOAuth(email, name, providerId, provider) {
    try {
      // Check if client exists by email OR by provider ID
      let clientResult;
      
      if (provider === 'google') {
        clientResult = await database.query(
          'SELECT id, email, name, is_active, google_id FROM clients WHERE email = $1 OR google_id = $2',
          [email.toLowerCase(), providerId]
        );
      } else if (provider === 'github') {
        clientResult = await database.query(
          'SELECT id, email, name, is_active, github_id FROM clients WHERE email = $1 OR github_id = $2',
          [email.toLowerCase(), providerId]
        );
      }

      let client;

      if (clientResult.rows.length === 0) {
        // Create new client if doesn't exist
        const insertResult = await database.query(
          `INSERT INTO clients (email, name, ${provider}_id, is_active, created_at, updated_at) 
           VALUES ($1, $2, $3, true, NOW(), NOW()) 
           RETURNING id, email, name, is_active`,
          [email.toLowerCase(), name, providerId]
        );
        
        client = insertResult.rows[0];
        
        // Generate RSA key pair for new OAuth client
        try {
          const keyPair = await ClientKeyService.generateKeyPair(client.id);
          logger.info('OAuth client RSA key pair generated', { 
            clientId: client.id, 
            keyId: keyPair.keyId 
          });
        } catch (keyError) {
          logger.error('Failed to generate RSA key pair for OAuth client:', keyError);
        }
        
        logger.info('New client created via OAuth', { 
          clientId: client.id, 
          email: client.email, 
          provider: provider,
          providerId: providerId
        });
      } else {
        client = clientResult.rows[0];

        if (!client.is_active) {
          throw new Error('Client account is deactivated');
        }

        // Update client with OAuth provider info and sync email/name
        if (provider === 'google') {
          await database.query(
            `UPDATE clients SET 
             google_id = $1,
             email = $2,
             name = COALESCE(NULLIF(name, ''), $3),
             last_login = NOW(),
             updated_at = NOW()
             WHERE id = $4`,
            [providerId, email.toLowerCase(), name, client.id]
          );
        } else if (provider === 'github') {
          await database.query(
            `UPDATE clients SET 
             github_id = $1,
             email = $2,
             name = COALESCE(NULLIF(name, ''), $3),
             last_login = NOW(),
             updated_at = NOW()
             WHERE id = $4`,
            [providerId, email.toLowerCase(), name, client.id]
          );
        }

        logger.info('Existing client OAuth login', { 
          clientId: client.id, 
          email: email.toLowerCase(), 
          provider: provider,
          providerId: providerId
        });
      }

      // Generate JWT token for client using client's RSA key
      const token = await ClientKeyService.signJwt(client.id, {
        sub: client.id,
        email: email.toLowerCase(),
        name: name || client.name,
        type: 'client',
        provider: provider,
        iat: Math.floor(Date.now() / 1000)
      });

      return {
        success: true,
        userType: 'client',
        client: {
          id: client.id,
          email: email.toLowerCase(),
          name: name || client.name
        },
        token: token
      };

    } catch (error) {
      logger.error('Client OAuth error:', error);
      throw error;
    }
  }

  getPassportMiddleware() {
    return passport.initialize();
  }

  getPassportSession() {
    return passport.session();
  }
}

module.exports = new OAuthService();