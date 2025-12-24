const express = require('express');
const { authenticateApplication } = require('../middleware/applicationAuth');
const { authenticateUser } = require('../middleware/multiTenantAuth');
const userAuthController = require('../controllers/userAuth.controller');
const database = require('../utils/database');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * User Authentication Routes
 * 
 * UPDATED: Now uses application authentication middleware.
 * Client apps must provide X-Application-ID and X-Application-Secret headers.
 * 
 * Flow:
 * 1. Client app sends request with application credentials in headers
 * 2. authenticateApplication middleware validates credentials
 * 3. req.application and req.clientId are populated
 * 4. Controller uses application context for user operations
 */

// ============================================================================
// PUBLIC ROUTES - Require Application Authentication
// ============================================================================

/**
 * User Registration
 * Headers: X-Application-ID, X-Application-Secret
 * Body: { email, password, name, requested_role? }
 */
router.post('/register',
  authenticateApplication,
  userAuthController.register.bind(userAuthController)
);

/**
 * User Login
 * Headers: X-Application-ID, X-Application-Secret
 * Body: { email, password }
 */
router.post('/login',
  authenticateApplication,
  userAuthController.login.bind(userAuthController)
);

/**
 * Refresh Access Token
 * Headers: X-Application-ID, X-Application-Secret
 * Body: { refresh_token }
 */
router.post('/refresh-token',
  authenticateApplication,
  userAuthController.refreshToken.bind(userAuthController)
);

/**
 * Verify Email
 * Body: { token }
 */
router.post('/verify-email',
  userAuthController.verifyEmail.bind(userAuthController)
);

/**
 * Resend Verification Email
 * Body: { user_id?, email? }
 */
router.post('/resend-verification',
  userAuthController.resendVerificationEmail.bind(userAuthController)
);

/**
 * Get Application Details (Public)
 * This allows client apps to fetch their configuration
 */
router.get('/applications/:application_id', async (req, res) => {
  try {
    const { application_id } = req.params;

    const query = `
      SELECT 
        ca.id,
        ca.name,
        ca.description,
        ca.auth_mode,
        ca.main_page_url,
        ca.redirect_url,
        ca.default_role,
        ca.roles_config,
        ca.is_active
      FROM client_applications ca
      JOIN clients c ON ca.client_id = c.id
      WHERE ca.id = $1 AND ca.is_active = true AND c.is_active = true
    `;

    const result = await database.query(query, [application_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Application not found',
        code: 'APPLICATION_NOT_FOUND'
      });
    }

    const app = result.rows[0];

    // Extract roles from JSONB
    let roles = ['user'];
    let defaultRole = 'user';

    if (app.roles_config && Array.isArray(app.roles_config)) {
      roles = app.roles_config.map(r => r.name);
      const defaultRoleObj = app.roles_config.find(r => r.isDefault);
      if (defaultRoleObj) defaultRole = defaultRoleObj.name;
    }

    res.json({
      application: {
        id: app.id,
        name: app.name,
        description: app.description,
        auth_mode: app.auth_mode,
        available_roles: roles,
        default_role: defaultRole,
        main_page_url: app.main_page_url,
        redirect_url: app.redirect_url
      }
    });

  } catch (error) {
    logger.error('Get application error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
});

// ============================================================================
// PROTECTED ROUTES - Require User Authentication
// ============================================================================

/**
 * Get User Profile
 * Requires: User JWT token
 */
router.get('/profile',
  authenticateUser,
  userAuthController.getProfile.bind(userAuthController)
);

/**
 * Update User Profile
 * Requires: User JWT token
 * Body: { name }
 */
router.put('/profile',
  authenticateUser,
  userAuthController.updateProfile.bind(userAuthController)
);

/**
 * User Logout
 * Requires: User JWT token
 * Body: { refresh_token? }
 */
router.post('/logout',
  authenticateUser,
  userAuthController.logout.bind(userAuthController)
);

/**
 * Request Role Upgrade
 * Requires: User JWT token
 * Body: { requested_role }
 */
router.post('/:user_id/request-role',
  authenticateUser,
  userAuthController.requestRoleUpgrade.bind(userAuthController)
);

/**
 * Get Role Requests
 * Requires: User JWT token
 */
router.get('/:user_id/role-requests',
  authenticateUser,
  userAuthController.getRoleRequests.bind(userAuthController)
);

module.exports = router;