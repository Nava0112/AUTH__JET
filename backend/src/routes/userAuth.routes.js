const express = require('express');
const { authenticateUser, authenticateApplication, requireRole } = require('../middleware/multiTenantAuth');
const { createUserRateLimit } = require('../middleware/rateLimit');
const userAuthController = require('../controllers/userAuth.controller');

const router = express.Router();

// Apply rate limiting to all user auth routes
router.use(createUserRateLimit(200, 15)); // 200 requests per 15 minutes

// Application-based authentication (requires application credentials)
router.use('/app', authenticateApplication);

// User authentication routes for client applications
router.post('/app/register', userAuthController.register);
router.post('/app/login', userAuthController.login);
router.post('/app/forgot-password', userAuthController.forgotPassword);
router.post('/app/reset-password', userAuthController.resetPassword);
router.post('/app/verify-email', userAuthController.verifyEmail);
router.post('/app/refresh-token', userAuthController.refreshToken);

// Protected user routes (requires user token)
router.use('/user', authenticateUser);

// User profile management
router.get('/user/profile', userAuthController.getProfile);
router.put('/user/profile', userAuthController.updateProfile);
router.post('/user/change-password', userAuthController.changePassword);
router.post('/user/logout', userAuthController.logout);

// User session management
router.get('/user/sessions', userAuthController.getSessions);
router.delete('/user/sessions/:sessionId', userAuthController.revokeSession);
router.delete('/user/sessions', userAuthController.revokeAllSessions);

// User activity and audit logs
router.get('/user/activity', userAuthController.getActivity);

// Role-based routes (for advanced auth applications)
router.get('/user/permissions', userAuthController.getPermissions);

// Application-specific user data
router.get('/user/custom-data', userAuthController.getCustomData);
router.put('/user/custom-data', userAuthController.updateCustomData);

// OAuth routes (if client application supports OAuth)
router.get('/oauth/authorize', userAuthController.oauthAuthorize);
router.post('/oauth/token', userAuthController.oauthToken);
router.post('/oauth/revoke', userAuthController.oauthRevoke);

module.exports = router;
