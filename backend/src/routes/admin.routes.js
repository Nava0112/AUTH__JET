const express = require('express');
const { authenticateAdmin } = require('../middleware/multiTenantAuth');
const adminController = require('../controllers/admin.controller');

const router = express.Router();

// Admin authentication routes (no auth required)
router.post('/login', adminController.login);
router.post('/refresh-token', adminController.refreshToken);

// Protected admin routes
router.use(authenticateAdmin);

// Admin profile management
router.get('/profile', adminController.getProfile);
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
router.get('/system/health', adminController.getSystemHealth);

module.exports = router;
