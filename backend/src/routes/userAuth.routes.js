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

    // Client application info endpoint - FIXED with correct schema
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
          SELECT 
            id, 
            name, 
            description, 
            auth_mode,
            main_page_url,
            redirect_url,
            default_role,
            is_active,
            roles_config
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

        const application = result.rows[0];
        
        // Extract roles from roles_config JSONB
        let available_roles = [];
        let default_user_role = 'user'; // Fallback default
        
        if (application.roles_config) {
          try {
            // Parse roles_config JSONB
            const rolesConfig = typeof application.roles_config === 'string' 
              ? JSON.parse(application.roles_config) 
              : application.roles_config;
            
            if (Array.isArray(rolesConfig) && rolesConfig.length > 0) {
              // Extract available role names
              available_roles = rolesConfig.map(role => role.name).filter(Boolean);
              
              // Find the default role based on isDefault boolean
              const defaultRoleByFlag = rolesConfig.find(role => role.isDefault === true);
              
              if (defaultRoleByFlag) {
                // Use the role marked as isDefault
                default_user_role = defaultRoleByFlag.name;
              } else {
                // If no isDefault found, use the role with lowest hierarchy
                const sortedByHierarchy = [...rolesConfig].sort((a, b) => (a.hierarchy || 0) - (b.hierarchy || 0));
                default_user_role = sortedByHierarchy[0].name;
              }
            }
          } catch (error) {
            console.warn('Failed to parse roles_config:', error);
            // Keep default fallback values
          }
        }

        // Ensure we have at least some roles
        if (available_roles.length === 0) {
          available_roles = ['user'];
        }

        res.json({ 
          application: {
            id: application.id,
            name: application.name,
            description: application.description,
            auth_mode: application.auth_mode,
            main_page_url: application.main_page_url,
            redirect_url: application.redirect_url,
            available_roles: available_roles,
            default_user_role: default_user_role,
            is_active: application.is_active
          }
        });
      } catch (error) {
        logger.error('Get application info error:', error);
        console.error('Full error details:', error);
        res.status(500).json({
          error: 'Failed to fetch application info',
          details: error.message,
          code: 'DATABASE_ERROR'
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