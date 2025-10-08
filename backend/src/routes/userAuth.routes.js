const express = require('express');
const { authenticateUser } = require('../middleware/userAuth');
const userAuthController = require('../controllers/userAuth.controller');
const database = require('../utils/database');
const logger = require('../utils/logger');

const router = express.Router();

// Public routes - no authentication required
router.post('/register', userAuthController.register.bind(userAuthController));
router.post('/login', userAuthController.login.bind(userAuthController));
router.post('/refresh-token', userAuthController.refreshToken.bind(userAuthController));
router.post('/verify-email', userAuthController.verifyEmail.bind(userAuthController));
router.post('/resend-verification', userAuthController.resendVerificationEmail.bind(userAuthController));

// Client application info endpoint
router.get('/applications/:application_id', async (req, res) => {
  try {
    const { application_id } = req.params;
    const client_id = req.query.client_id;

    if (!client_id) {
      return res.status(400).json({
        error: 'client_id query parameter is required',
        code: 'MISSING_CLIENT_ID',
      });
    }

    const query = `
      SELECT id, name, description, logo_url, auth_mode, available_roles, default_user_role
      FROM client_applications 
      WHERE id = $1 AND client_id = $2 AND is_active = true
    `;
    
    const result = await database.query(query, [application_id, client_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Application not found',
        code: 'APPLICATION_NOT_FOUND',
      });
    }

    res.json({ application: result.rows[0] });
  } catch (error) {
    logger.error('Get application info error:', error);
    res.status(500).json({
      error: 'Failed to fetch application info',
      details: error.message
    });
  }
});

// Protected routes - require user authentication
router.use(authenticateUser);

router.get('/profile', userAuthController.getProfile.bind(userAuthController));
router.post('/logout', userAuthController.logout.bind(userAuthController));
router.post('/:user_id/request-role', userAuthController.requestRoleUpgrade.bind(userAuthController));
router.get('/:user_id/role-requests', userAuthController.getRoleRequests.bind(userAuthController));
router.put('/profile', userAuthController.updateProfile.bind(userAuthController));

module.exports = router;