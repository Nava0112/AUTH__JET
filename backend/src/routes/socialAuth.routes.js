const express = require('express');
const passport = require('passport');
const logger = require('../utils/logger');
const oauthService = require('../services/oauth.service');
const router = express.Router();

// Google OAuth Routes for Client
router.get('/google', passport.authenticate('google-client', {
  scope: ['profile', 'email']
}));

// GitHub OAuth Routes for Client
router.get('/github', passport.authenticate('github-client', {
  scope: ['user:email']
}));

// Google OAuth Routes for Admin
router.get('/google/admin', passport.authenticate('google-admin', {
  scope: ['profile', 'email']
}));

// GitHub OAuth Routes for Admin
router.get('/github/admin', passport.authenticate('github-admin', {
  scope: ['user:email']
}));

router.get('/google/callback', passport.authenticate('google-client', { session: false }), async (req, res) => {
  try {
    const result = req.user;
    
    if (result.success) {
      // Redirect to frontend with token
      const redirectUrl = `${process.env.FRONTEND_URL}/client/dashboard?token=${result.token}&name=${encodeURIComponent(result.client.name)}`;
      res.redirect(redirectUrl);
    } else {
      res.redirect(`${process.env.FRONTEND_URL}/client/login?error=oauth_failed`);
    }
  } catch (error) {
    logger.error('Google OAuth callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/client/login?error=oauth_error`);
  }
});

router.get('/github/callback', passport.authenticate('github-client', { session: false }), async (req, res) => {
  try {
    const result = req.user;
    
    if (result.success) {
      // Redirect to frontend with token
      const redirectUrl = `${process.env.FRONTEND_URL}/client/dashboard?token=${result.token}&name=${encodeURIComponent(result.client.name)}`;
      res.redirect(redirectUrl);
    } else {
      res.redirect(`${process.env.FRONTEND_URL}/client/login?error=oauth_failed`);
    }
  } catch (error) {
    logger.error('GitHub OAuth callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/client/login?error=oauth_error`);
  }
});

// Admin OAuth callback routes
router.get('/google/admin/callback', passport.authenticate('google-admin', { session: false }), async (req, res) => {
  try {
    const result = req.user;
    
    if (result.success) {
      // Redirect to frontend with token
      const redirectUrl = `${process.env.FRONTEND_URL}/admin/dashboard?token=${result.token}&name=${encodeURIComponent(result.admin.name)}`;
      res.redirect(redirectUrl);
    } else {
      res.redirect(`${process.env.FRONTEND_URL}/admin/login?error=oauth_failed`);
    }
  } catch (error) {
    logger.error('Google Admin OAuth callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/admin/login?error=oauth_error`);
  }
});

router.get('/github/admin/callback', passport.authenticate('github-admin', { session: false }), async (req, res) => {
  try {
    const result = req.user;
    
    if (result.success) {
      // Redirect to frontend with token
      const redirectUrl = `${process.env.FRONTEND_URL}/admin/dashboard?token=${result.token}&name=${encodeURIComponent(result.admin.name)}`;
      res.redirect(redirectUrl);
    } else {
      res.redirect(`${process.env.FRONTEND_URL}/admin/login?error=oauth_failed`);
    }
  } catch (error) {
    logger.error('GitHub Admin OAuth callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/admin/login?error=oauth_error`);
  }
});

// Alternative OAuth code exchange endpoint (for advanced flows)
router.post('/oauth/exchange', async (req, res) => {
  try {
    const { code, provider, userType = 'client' } = req.body;
    
    if (!code || !provider) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: code and provider'
      });
    }
    
    // Determine redirect URI based on userType and provider
    const baseUrl = process.env.BACKEND_URL || 'http://localhost:8000';
    const redirectUri = userType === 'admin' 
      ? `${baseUrl}/api/auth/${provider}/admin/callback`
      : `${baseUrl}/api/auth/${provider}/callback`;
    
    const result = await oauthService.exchangeOAuthCode(code, provider, redirectUri, userType);
    
    res.json({
      success: true,
      userType: result.userType,
      token: result.token,
      user: userType === 'admin' ? result.admin : result.client
    });
    
  } catch (error) {
    logger.error('OAuth code exchange error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
