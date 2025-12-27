const express = require('express');
const { authenticateAdmin, requireRole } = require('../middleware/multiTenantAuth');
const { createUserRateLimit } = require('../middleware/rateLimit');
const adminController = require('../controllers/admin.controller');

const router = express.Router();

// Apply rate limiting to all admin routes (temporarily disabled for testing)
// router.use(createUserRateLimit(50, 15)); // 50 requests per 15 minutes

// Admin authentication routes (no auth required)
router.post('/login', adminController.login);
router.post('/refresh-token', adminController.refreshToken);
router.post('/register', adminController.register); // Only for initial setup
router.post('/forgot-password', adminController.forgotPassword);
router.post('/reset-password', adminController.resetPassword);

// Admin approval routes (no auth required - secured by JWT tokens)
router.get('/approve/:token', adminController.approveAdminRequest);
router.get('/reject/:token', adminController.rejectAdminRequest);

// Protected admin routes
router.use(authenticateAdmin);

// Admin profile management
router.get('/profile', adminController.getProfile);
router.put('/profile', adminController.updateProfile);
router.post('/change-password', adminController.changePassword);
router.post('/logout', adminController.logout);

// SaaS platform management
router.get('/dashboard/stats', adminController.getDashboardStats);

// Client management (SaaS customers)
router.get('/clients', adminController.getClients);
router.get('/clients/:id', adminController.getClient);
router.put('/clients/:id', adminController.updateClient);
router.delete('/clients/:id', adminController.deleteClient);
router.post('/clients/:id/suspend', adminController.suspendClient);
router.post('/clients/:id/activate', adminController.activateClient);

// Client applications management
router.get('/clients/:clientId/applications', adminController.getClientApplications);
router.get('/clients/:clientId/users', adminController.getClientUsers);
router.get('/applications/:id', adminController.getApplication);

// Platform analytics
router.get('/analytics/overview', adminController.getAnalyticsOverview);
router.get('/analytics/clients', adminController.getClientAnalytics);
router.get('/analytics/revenue', adminController.getRevenueAnalytics);

// System management
router.get('/system/logs', adminController.getSystemLogs);
router.post('/system/maintenance', adminController.toggleMaintenance);
router.get('/system/health', adminController.getSystemHealth);

// Billing management
router.get('/billing/overview', adminController.getBillingOverview);
router.get('/billing/transactions', adminController.getTransactions);

module.exports = router;
