const crypto = require('../utils/crypto');
const database = require('../utils/database');
const logger = require('../utils/logger');
const User = require('../models/User');
const Session = require('../models/Session');
const userJwtService = require('../services/userJwt.service');
const emailService = require('../services/email.service');

class UserAuthController {

  /**
   * User Registration
   */
  async register(req, res, next) {
    const { email, password, name, client_id, application_id } = req.body;

    try {
      if (!email || !password || !client_id || !application_id) {
        return res.status(400).json({
          error: 'Email, password, client_id, and application_id are required',
          code: 'MISSING_REQUIRED_FIELDS',
        });
      }

      // Verify client-application relationship and status
      const appQuery = `
        SELECT ca.*, c.id as client_db_id
        FROM client_applications ca
        JOIN clients c ON ca.client_id = c.id
        WHERE ca.oauth_application_id = $1 AND c.client_id = $2
          AND ca.is_active = true AND c.is_active = true
      `;
      const appResult = await database.query(appQuery, [application_id, client_id]);

      if (appResult.rows.length === 0) {
        return res.status(400).json({
          error: 'Invalid client application or application not active',
          code: 'INVALID_APPLICATION',
        });
      }

      const application = appResult.rows[0];
      const clientDbId = application.client_db_id;
      const applicationDbId = application.id;

      // Check for existing user
      const existingUser = await User.findByEmail(email, applicationDbId);
      if (existingUser) {
        return res.status(409).json({
          error: 'User already exists for this application',
          code: 'USER_EXISTS',
        });
      }

      // Create user
      const user = await User.create({
        email,
        password,
        name: name || email.split('@')[0],
        client_id: clientDbId,
        application_id: applicationDbId,
        email_verified: false
      });

      // Verification email
      try {
        await emailService.sendUserVerificationEmail(email, user.name, user.id, applicationDbId);
      } catch (emailError) {
        logger.error('Failed to send verification email:', emailError);
      }

      // Generate tokens
      const accessToken = await userJwtService.generateAccessTokenWithFallback(user, client_id, applicationDbId);
      const refreshToken = await userJwtService.generateRefreshToken(user.id, applicationDbId, req.ip);

      logger.info('User registered successfully', { userId: user.id });

      // Set cookie
      res.cookie('refresh_token', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      res.status(201).json({
        success: true,
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'Bearer',
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        },
        application: {
          id: application.oauth_application_id,
          name: application.name
        }
      });

    } catch (error) {
      logger.error('User registration error:', error);
      next(error);
    }
  }

  /**
   * User Login
   */
  async login(req, res, next) {
    const { email, password, client_id, application_id } = req.body;

    try {
      if (!email || !password || !client_id || !application_id) {
        return res.status(400).json({
          error: 'Email, password, client_id, and application_id are required',
          code: 'MISSING_REQUIRED_FIELDS',
        });
      }

      const applicationResult = await database.query(`
        SELECT ca.id, ca.oauth_application_id
        FROM client_applications ca
        JOIN clients c ON ca.client_id = c.id
        WHERE ca.oauth_application_id = $1 AND c.client_id = $2
          AND ca.is_active = true AND c.is_active = true
      `, [application_id, client_id]);
      const application = applicationResult.rows[0];

      if (!application) {
        return res.status(401).json({
          error: 'Invalid credentials or application',
          code: 'INVALID_CREDENTIALS',
        });
      }

      const user = await User.findByEmail(email, application.id);

      if (!user) {
        return res.status(401).json({
          error: 'Invalid credentials or application',
          code: 'INVALID_CREDENTIALS',
        });
      }

      const isValidPassword = await crypto.verifyPassword(password, user.password_hash);
      if (!isValidPassword) {
        return res.status(401).json({
          error: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS',
        });
      }

      await User.update(user.id, { last_login: new Date() });

      const accessToken = await userJwtService.generateAccessTokenWithFallback(user, client_id, application.id);
      const refreshToken = await userJwtService.generateRefreshToken(user.id, application.id, req.ip);

      logger.info('User login successful', { userId: user.id });

      res.cookie('refresh_token', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      res.json({
        success: true,
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'Bearer',
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        }
      });

    } catch (error) {
      logger.error('User login error:', error);
      next(error);
    }
  }

  /**
   * Token Refresh
   */
  async refreshToken(req, res, next) {
    const refresh_token = req.body.refresh_token || req.cookies?.refresh_token;

    try {
      if (!refresh_token) {
        return res.status(400).json({
          error: 'Refresh token required',
          code: 'MISSING_REFRESH_TOKEN',
        });
      }

      const tokens = await userJwtService.refreshTokens(refresh_token);

      res.cookie('refresh_token', tokens.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      res.json({ success: true, ...tokens });

    } catch (error) {
      logger.error('Token refresh error:', error);
      if (error.message.includes('Invalid or expired')) {
        return res.status(401).json({
          error: error.message,
          code: 'INVALID_REFRESH_TOKEN',
        });
      }
      next(error);
    }
  }

  /**
   * Email Verification
   */
  async verifyEmail(req, res, next) {
    const { token } = req.body;

    try {
      if (!token) {
        return res.status(400).json({ error: 'Verification token required' });
      }

      // In production, verify the encrypted token. Using ID for now as requested.
      const userId = parseInt(token);
      const user = await User.update(userId, { email_verified: true });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      logger.info('Email verified successfully', { userId });
      res.json({ success: true, message: 'Email verified successfully' });

    } catch (error) {
      logger.error('Email verification error:', error);
      next(error);
    }
  }

  /**
   * Get User Profile
   */
  async getProfile(req, res, next) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'User profile not found' });
      }

      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          email_verified: user.email_verified,
          last_login: user.last_login,
          created_at: user.created_at,
          metadata: user.metadata
        }
      });
    } catch (error) {
      logger.error('Get profile error:', error);
      next(error);
    }
  }

  /**
   * Update User Profile
   */
  async updateProfile(req, res, next) {
    const { name, metadata } = req.body;
    const userId = req.user?.id;

    try {
      const user = await User.update(userId, { name, metadata });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          metadata: user.metadata
        }
      });
    } catch (error) {
      logger.error('Update profile error:', error);
      next(error);
    }
  }

  /**
   * Resend Verification Email
   */
  async resendVerificationEmail(req, res, next) {
    const { user_id } = req.body;

    try {
      const user = await User.findById(user_id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (user.email_verified) {
        return res.status(400).json({ error: 'Email already verified' });
      }

      await emailService.sendUserVerificationEmail(user.email, user.name, user.id, user.application_id);
      res.json({ success: true, message: 'Verification email sent' });

    } catch (error) {
      logger.error('Resend verification error:', error);
      next(error);
    }
  }

  /**
   * User Logout
   */
  async logout(req, res, next) {
    try {
      const refreshToken = req.body.refresh_token || req.cookies?.refresh_token;
      if (refreshToken) {
        await Session.revoke(refreshToken);
      }
      res.clearCookie('refresh_token');
      res.json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
      logger.error('Logout error:', error);
      next(error);
    }
  }
}

const userAuthController = new UserAuthController();
module.exports = userAuthController;