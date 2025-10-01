const express = require('express');
const authController = require('../controllers/auth.controller');
const authService = require('../services/auth.service');
const { authenticateJWT } = require('../middleware/auth');
const { validateRegistration, validateLogin } = require('../middleware/validation');
const { authRateLimit } = require('../middleware/rateLimit');

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
  // Initiate Google OAuth flow
  const state = Math.random().toString(36).substring(2);
  const nonce = Math.random().toString(36).substring(2);
  
  // Store state and nonce in session or database
  req.session.oauthState = state;
  req.session.oauthNonce = nonce;

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: `${process.env.API_URL}/api/auth/oauth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    nonce,
    access_type: 'offline',
    prompt: 'consent',
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

router.get('/oauth/google/callback', async (req, res, next) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      return res.redirect(`${process.env.CLIENT_URL}/login?error=oauth_failed`);
    }

    if (state !== req.session.oauthState) {
      return res.redirect(`${process.env.CLIENT_URL}/login?error=invalid_state`);
    }

    // Exchange code for tokens
    // This would be implemented with your OAuth service
    const oauthResult = await authService.exchangeOAuthCode('google', code);

    // Clear session
    req.session.oauthState = null;
    req.session.oauthNonce = null;

    // Redirect to client with tokens
    const redirectUrl = new URL(`${process.env.CLIENT_URL}/oauth/callback`);
    redirectUrl.searchParams.set('access_token', oauthResult.access_token);
    redirectUrl.searchParams.set('refresh_token', oauthResult.refresh_token);
    redirectUrl.searchParams.set('user', JSON.stringify(oauthResult.user));

    res.redirect(redirectUrl.toString());
  } catch (error) {
    next(error);
  }
});

router.get('/oauth/github', (req, res) => {
  const state = Math.random().toString(36).substring(2);
  
  req.session.oauthState = state;

  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID,
    redirect_uri: `${process.env.API_URL}/api/auth/oauth/github/callback`,
    scope: 'user:email',
    state,
  });

  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

router.get('/oauth/github/callback', async (req, res, next) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      return res.redirect(`${process.env.CLIENT_URL}/login?error=oauth_failed`);
    }

    if (state !== req.session.oauthState) {
      return res.redirect(`${process.env.CLIENT_URL}/login?error=invalid_state`);
    }

    // Exchange code for tokens
    const oauthResult = await authService.exchangeOAuthCode('github', code);

    // Clear session
    req.session.oauthState = null;

    // Redirect to client with tokens
    const redirectUrl = new URL(`${process.env.CLIENT_URL}/oauth/callback`);
    redirectUrl.searchParams.set('access_token', oauthResult.access_token);
    redirectUrl.searchParams.set('refresh_token', oauthResult.refresh_token);
    redirectUrl.searchParams.set('user', JSON.stringify(oauthResult.user));

    res.redirect(redirectUrl.toString());
  } catch (error) {
    next(error);
  }
});

// Protected routes
router.get('/me', authenticateJWT, async (req, res, next) => {
  try {
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

    const tokenHash = require('../utils/crypto').hashToken(token);

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