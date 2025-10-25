const express = require('express');
const authController = require('../controllers/auth.controller');
const authService = require('../services/auth.service');
const { authenticateJWT } = require('../middleware/auth');
const { validateRegistration, validateLogin } = require('../middleware/validation');
const { authRateLimit, strictAuthLimiter } = require('../middleware/rateLimit');
const logger = require('../utils/logger');

const router = express.Router();

// Public routes
router.post('/register', authRateLimit, validateRegistration, (req, res, next) => {
  authController.register(req, res, next);
});

router.post('/login', authRateLimit, validateLogin, (req, res, next) => {
  authController.login(req, res, next);
});

router.post('/refresh', authRateLimit, (req, res, next) => {
  authController.refreshToken(req, res, next);
});

router.post('/verify', authRateLimit, (req, res, next) => {
  authController.verifyToken(req, res, next);
});

router.post('/logout', authRateLimit, (req, res, next) => {
  authController.logout(req, res, next);
});

// OAuth routes
router.get('/oauth/google', (req, res) => {
  try {
    // Initiate Google OAuth flow
    const state = Math.random().toString(36).substring(2);
    const nonce = Math.random().toString(36).substring(2);
    
    // Store state and nonce in session or database
    req.session.oauthState = state;
    req.session.oauthNonce = nonce;

    const redirectUri = `${process.env.API_URL}/api/auth/oauth/google/callback`;
    
    logger.info('Initiating Google OAuth', { state, nonce, redirectUri });

    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state: state,
      nonce: nonce,
      access_type: 'offline',
      prompt: 'consent',
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    logger.info('Redirecting to Google OAuth', { authUrl: authUrl.substring(0, 100) + '...' });
    
    res.redirect(authUrl);
  } catch (error) {
    logger.error('Google OAuth initiation error:', error);
    res.status(500).json({
      error: 'OAuth initiation failed',
      code: 'OAUTH_INIT_ERROR'
    });
  }
});

router.get('/oauth/google/callback', async (req, res) => {
  try {
    const { code, state, error, error_description } = req.query;
    
    logger.info('Google OAuth callback received', { 
      hasCode: !!code, 
      hasState: !!state, 
      hasError: !!error,
      sessionState: req.session?.oauthState,
      receivedState: state
    });

    // Handle OAuth errors from provider
    if (error) {
      logger.warn('OAuth error from Google:', { error, error_description, state });
      return res.redirect(`${process.env.CLIENT_URL}/login?error=oauth_denied&message=${error_description || error}`);
    }

    // Validate state to prevent CSRF
    if (!state || state !== req.session?.oauthState) {
      logger.warn('OAuth state mismatch:', { 
        received: state, 
        expected: req.session?.oauthState,
        hasSession: !!req.session
      });
      return res.redirect(`${process.env.CLIENT_URL}/login?error=invalid_state`);
    }

    // Validate code exists
    if (!code) {
      logger.warn('OAuth callback missing authorization code');
      return res.redirect(`${process.env.CLIENT_URL}/login?error=missing_code`);
    }

    // Exchange code for tokens
    logger.info('Exchanging OAuth code for tokens...');
    const redirectUri = `${process.env.API_URL}/api/auth/oauth/google/callback`;
    const oauthResult = await authService.exchangeOAuthCode(code, 'google', redirectUri);

    logger.info('OAuth exchange successful', { 
      userId: oauthResult.user?.id,
      userEmail: oauthResult.user?.email
    });

    // Clear session state to prevent reuse
    if (req.session) {
      req.session.oauthState = null;
      req.session.oauthNonce = null;
    }

    // Generate JWT tokens
    const tokens = oauthResult.tokens;
    if (!tokens || !tokens.accessToken) {
      throw new Error('No tokens generated from OAuth exchange');
    }

    // Redirect to frontend with tokens
    const frontendUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    const redirectUrl = new URL(`${frontendUrl}/oauth/callback`);
    
    redirectUrl.searchParams.set('access_token', tokens.accessToken);
    if (tokens.refreshToken) {
      redirectUrl.searchParams.set('refresh_token', tokens.refreshToken);
    }
    redirectUrl.searchParams.set('user', JSON.stringify(oauthResult.user));
    redirectUrl.searchParams.set('success', 'true');
    redirectUrl.searchParams.set('provider', 'google');

    logger.info('Redirecting to frontend with tokens', { 
      redirectUrl: redirectUrl.toString().substring(0, 100) + '...' 
    });

    res.redirect(redirectUrl.toString());
    
  } catch (error) {
    logger.error('OAuth callback error:', error);
    const frontendUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/login?error=oauth_failed&message=${error.message}`);
  }
});

router.get('/oauth/github', (req, res) => {
  try {
    const state = Math.random().toString(36).substring(2);
    
    if (req.session) {
      req.session.oauthState = state;
    }

    const redirectUri = `${process.env.API_URL}/api/auth/oauth/github/callback`;
    
    logger.info('Initiating GitHub OAuth', { state, redirectUri });

    const params = new URLSearchParams({
      client_id: process.env.GITHUB_CLIENT_ID,
      redirect_uri: redirectUri,
      scope: 'user:email',
      state: state,
    });

    const authUrl = `https://github.com/login/oauth/authorize?${params}`;
    logger.info('Redirecting to GitHub OAuth', { authUrl: authUrl.substring(0, 100) + '...' });
    
    res.redirect(authUrl);
  } catch (error) {
    logger.error('GitHub OAuth initiation error:', error);
    res.status(500).json({
      error: 'OAuth initiation failed',
      code: 'OAUTH_INIT_ERROR'
    });
  }
});

router.get('/oauth/github/callback', async (req, res) => {
  try {
    const { code, state, error, error_description } = req.query;

    logger.info('GitHub OAuth callback received', { 
      hasCode: !!code, 
      hasState: !!state, 
      hasError: !!error
    });

    // Handle OAuth errors from provider
    if (error) {
      logger.warn('OAuth error from GitHub:', { error, error_description, state });
      return res.redirect(`${process.env.CLIENT_URL}/login?error=oauth_denied&message=${error_description || error}`);
    }

    // Validate state to prevent CSRF
    if (!state || state !== req.session?.oauthState) {
      logger.warn('OAuth state mismatch:', { 
        received: state, 
        expected: req.session?.oauthState
      });
      return res.redirect(`${process.env.CLIENT_URL}/login?error=invalid_state`);
    }

    // Validate code exists
    if (!code) {
      logger.warn('OAuth callback missing authorization code');
      return res.redirect(`${process.env.CLIENT_URL}/login?error=missing_code`);
    }

    // Exchange code for tokens
    logger.info('Exchanging GitHub OAuth code for tokens...');
    const redirectUri = `${process.env.API_URL}/api/auth/oauth/github/callback`;
    const oauthResult = await authService.exchangeOAuthCode(code, 'github', redirectUri);

    logger.info('GitHub OAuth exchange successful', { 
      userId: oauthResult.user?.id,
      userEmail: oauthResult.user?.email
    });

    // Clear session state to prevent reuse
    if (req.session) {
      req.session.oauthState = null;
    }

    // Generate JWT tokens
    const tokens = oauthResult.tokens;
    if (!tokens || !tokens.accessToken) {
      throw new Error('No tokens generated from OAuth exchange');
    }

    // Redirect to frontend with tokens
    const frontendUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    const redirectUrl = new URL(`${frontendUrl}/oauth/callback`);
    
    redirectUrl.searchParams.set('access_token', tokens.accessToken);
    if (tokens.refreshToken) {
      redirectUrl.searchParams.set('refresh_token', tokens.refreshToken);
    }
    redirectUrl.searchParams.set('user', JSON.stringify(oauthResult.user));
    redirectUrl.searchParams.set('success', 'true');
    redirectUrl.searchParams.set('provider', 'github');

    logger.info('Redirecting to frontend with tokens', { 
      redirectUrl: redirectUrl.toString().substring(0, 100) + '...' 
    });

    res.redirect(redirectUrl.toString());
    
  } catch (error) {
    logger.error('GitHub OAuth callback error:', error);
    const frontendUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/login?error=oauth_failed&message=${error.message}`);
  }
});

// Protected routes
router.get('/me', strictAuthLimiter, authenticateJWT, async (req, res, next) => {
  try {
    // Prevent caching of auth state
    res.set('Cache-Control', 'no-store');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    res.json({
      user: req.user,
      client: {
        id: req.client.id,
        name: req.client.name,
        plan_type: req.client.plan_type,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/sessions', authenticateJWT, async (req, res, next) => {
  try {
    const sessions = await authService.getUserSessions(req.user.id, req.user.client_id);
    res.json({ sessions });
  } catch (error) {
    next(error);
  }
});

router.delete('/sessions/:sessionId', authenticateJWT, async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    await authService.revokeUserSession(sessionId, req.user.id, req.user.client_id);
    res.json({ message: 'Session revoked successfully' });
  } catch (error) {
    next(error);
  }
});

router.delete('/sessions', authenticateJWT, async (req, res, next) => {
  try {
    const result = await authService.revokeAllUserSessions(req.user.id, req.user.client_id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Password reset routes
router.post('/forgot-password', authRateLimit, async (req, res, next) => {
  try {
    const { email, client_id } = req.body;

    // Generate reset token
    const resetToken = require('../utils/crypto').randomString(32);
    const resetTokenHash = require('../utils/crypto').hashToken(resetToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store reset token in database
    await require('../utils/database').query(
      'INSERT INTO password_resets (email, client_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)',
      [email, client_id, resetTokenHash, expiresAt]
    );

    // Get client info
    const client = await require('../models/Client').findById(client_id);
    
    // Send reset email
    await require('../services/email.service').sendPasswordResetEmail(email, resetToken, client.name);

    res.json({ message: 'Password reset email sent' });
  } catch (error) {
    next(error);
  }
});

router.post('/reset-password', authRateLimit, async (req, res, next) => {
  try {
    const { token, password, client_id } = req.body;

    const { hashToken } = require('../utils/token.utils');

    // Verify reset token
    const resetQuery = `
      SELECT * FROM password_resets 
      WHERE token_hash = $1 AND client_id = $2 AND expires_at > NOW() AND used = false
    `;
    
    const resetResult = await require('../utils/database').query(resetQuery, [tokenHash, client_id]);
    
    if (resetResult.rows.length === 0) {
      return res.status(400).json({
        error: 'Invalid or expired reset token',
        code: 'INVALID_RESET_TOKEN',
      });
    }

    const resetRecord = resetResult.rows[0];

    // Update password
    const passwordHash = await require('../utils/crypto').hashPassword(password);
    
    await require('../utils/database').query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE email = $2',
      [passwordHash, resetRecord.email]
    );

    // Mark reset token as used
    await require('../utils/database').query(
      'UPDATE password_resets SET used = true, used_at = NOW() WHERE id = $1',
      [resetRecord.id]
    );

    // Revoke all existing sessions for security
    const user = await require('../models/User').findByEmail(resetRecord.email);
    if (user) {
      await require('../models/Session').revokeAllUserSessions(user.id, client_id);
    }

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;