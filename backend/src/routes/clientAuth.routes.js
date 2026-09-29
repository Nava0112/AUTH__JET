const express = require('express');
const { authenticateClient } = require('../middleware/multiTenantAuth');
const clientAuthController = require('../controllers/clientAuth.controller');

const router = express.Router();

// Client authentication routes (no auth required)
router.post('/register', clientAuthController.register);
router.post('/login', clientAuthController.login);
router.post('/refresh-token', clientAuthController.refreshToken);

// Client profile management
router.use(authenticateClient);
router.get('/profile', clientAuthController.getProfile);
router.post('/logout', clientAuthController.logout);

// Client dashboard
router.get('/dashboard/stats', clientAuthController.getDashboardStats);

// Application management
router.get('/applications', clientAuthController.getApplications);
router.post('/applications', clientAuthController.createApplication);
router.get('/applications/:id', clientAuthController.getApplication);
router.put('/applications/:id', clientAuthController.updateApplication);
router.delete('/applications/:id', clientAuthController.deleteApplication);

// Key management
router.get('/applications/:id/keys', clientAuthController.getApplicationKeys);
router.post('/applications/:id/keys/rotate', clientAuthController.rotateApplicationKeys);
router.get('/applications/:id/jwks', clientAuthController.getApplicationJwks);


module.exports = router;
