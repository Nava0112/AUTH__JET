const express = require('express');
const { authenticateClient, requireRole } = require('../middleware/multiTenantAuth');
const { createUserRateLimit } = require('../middleware/rateLimit');
const clientAuthController = require('../controllers/simple.client.controller');

const router = express.Router();

// Apply rate limiting to all client routes (temporarily disabled)
// router.use(createUserRateLimit(100, 15)); // 100 requests per 15 minutes

// Client authentication routes (no auth required)
router.post('/register', clientAuthController.register);
router.post('/login', clientAuthController.login);
router.post('/forgot-password', clientAuthController.forgotPassword);
router.post('/reset-password', clientAuthController.resetPassword);
router.post('/verify-email', clientAuthController.verifyEmail);

// Protected client routes (temporarily disabled)
// router.use(authenticateClient);

// Client profile management
router.get('/profile', clientAuthController.getProfile);
router.get('/profile/:id', clientAuthController.getProfile); // Alternative route with ID
router.put('/profile', clientAuthController.updateProfile);
router.post('/change-password', clientAuthController.changePassword);
router.post('/logout', clientAuthController.logout);

// Client dashboard
router.use(authenticateClient);
router.get('/dashboard/stats', clientAuthController.getDashboard);

// Application management
router.get('/applications', clientAuthController.getApplications);
router.post('/applications', clientAuthController.createApplication);
router.get('/applications/:id', clientAuthController.getApplication);
router.put('/applications/:id', clientAuthController.updateApplication);
router.delete('/applications/:id', clientAuthController.deleteApplication);
router.post('/applications/:id/regenerate-secret', clientAuthController.regenerateApplicationSecret);

// User management for client applications
router.get('/applications/:appId/users', clientAuthController.getApplicationUsers);
router.get('/applications/:appId/users/:userId', clientAuthController.getApplicationUser);
router.put('/applications/:appId/users/:userId', clientAuthController.updateApplicationUser);
router.delete('/applications/:appId/users/:userId', clientAuthController.deleteApplicationUser);

// Role management (for advanced auth applications)
router.get('/applications/:appId/roles', clientAuthController.getApplicationRoles);
router.post('/applications/:appId/roles', clientAuthController.createApplicationRole);
router.put('/applications/:appId/roles/:roleId', clientAuthController.updateApplicationRole);
router.delete('/applications/:appId/roles/:roleId', clientAuthController.deleteApplicationRole);

// Session management
router.get('/applications/:appId/sessions', clientAuthController.getApplicationSessions);
router.delete('/applications/:appId/sessions/:sessionId', clientAuthController.revokeApplicationSession);

// Analytics for client applications
router.get('/applications/:appId/analytics', clientAuthController.getApplicationAnalytics);
router.get('/applications/:appId/analytics/logins', clientAuthController.getLoginAnalytics);
router.get('/applications/:appId/analytics/users', clientAuthController.getUserAnalytics);

// Webhook management
router.get('/webhooks/logs', clientAuthController.getWebhookLogs);
router.post('/webhooks/test', clientAuthController.testWebhook);

// Billing and subscription
router.get('/billing/current', clientAuthController.getCurrentBilling);
router.get('/billing/history', clientAuthController.getBillingHistory);
router.post('/billing/upgrade', clientAuthController.upgradePlan);

module.exports = router;
