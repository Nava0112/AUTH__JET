const database = require('../utils/database');
const logger = require('../utils/logger');

/**
 * Application Authentication Middleware
 * 
 * Validates that requests come from a legitimate client application.
 * Client apps must provide:
 * - X-Application-ID header (application database ID)
 * - X-Application-Secret header (application secret)
 * 
 * This middleware populates:
 * - req.application - Full application details
 * - req.clientId - Client database ID (integer)
 * 
 * Use this for user registration/login endpoints to ensure only
 * authorized applications can create users.
 */
/**
 * Application Authentication Middleware
 * 
 * Validates that requests come from a legitimate client application.
 * Supports two modes:
 * 1. Confidential Client (Backend): Requires X-Application-ID + X-Application-Secret
 * 2. Public Client (SPA/Mobile): Requires X-Application-ID + Matching Origin (Secret optional)
 * 
 * This middleware populates:
 * - req.application - Full application details
 * - req.clientId - Client database ID (integer)
 */
async function authenticateApplication(req, res, next) {
    try {
        const applicationId = req.headers['x-application-id'];
        const applicationSecret = req.headers['x-application-secret'];
        const origin = req.headers['origin'];

        // Validate App ID present
        if (!applicationId) {
            return res.status(401).json({
                error: 'Missing application credentials',
                code: 'MISSING_APP_CREDENTIALS',
                message: 'X-Application-ID header is required'
            });
        }

        // Query application
        // Note: We don't filter by secret in SQL anymore, we check it in logic
        const query = `
      SELECT 
        ca.*,
        c.id as client_db_id,
        c.client_id as client_string_id,
        c.name as client_name,
        c.is_active as client_is_active
      FROM client_applications ca
      JOIN clients c ON ca.client_id = c.id
      WHERE ca.id = $1 
        AND ca.is_active = true
        AND c.is_active = true
    `;

        const result = await database.query(query, [applicationId]);

        if (result.rows.length === 0) {
            return res.status(401).json({
                error: 'Invalid application',
                code: 'INVALID_APP',
                message: 'Application not found or inactive'
            });
        }

        const appData = result.rows[0];

        // Check validation method
        let isAuthenticated = false;

        // Method 1: Secret Validation (for confidential clients / backends)
        if (applicationSecret) {
            if (appData.application_secret === applicationSecret) {
                isAuthenticated = true;
            } else {
                return res.status(401).json({
                    error: 'Invalid application secret',
                    code: 'INVALID_APP_SECRET',
                    message: 'The provided application secret is incorrect'
                });
            }
        }
        // Method 2: Origin Validation (for public clients / SPA)
        else if (origin) {
            const allowedOrigins = appData.allowed_origins || [];

            // Allow localhost in development automatically if not explicitly set
            if (process.env.NODE_ENV === 'development' &&
                (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
                isAuthenticated = true;
                logger.debug('Allowing localhost origin in dev mode', { origin });
            }
            else if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
                isAuthenticated = true;
            } else {
                return res.status(403).json({
                    error: 'Origin not allowed',
                    code: 'ORIGIN_NOT_ALLOWED',
                    message: `Requests from origin ${origin} are not allowed for this application`
                });
            }
        }
        // No checks passed
        else {
            return res.status(401).json({
                error: 'Authentication failed',
                code: 'AUTH_FAILED',
                message: 'Either X-Application-Secret or a registered Origin is required'
            });
        }

        if (!isAuthenticated) {
            return res.status(401).json({
                error: 'Authentication failed',
                code: 'AUTH_FAILED'
            });
        }

        // Attach application info to request
        req.application = {
            id: appData.id,
            name: appData.name,
            description: appData.description,
            auth_mode: appData.auth_mode,
            main_page_url: appData.main_page_url,
            redirect_url: appData.redirect_url,
            webhook_url: appData.webhook_url,
            default_role: appData.default_role,
            roles_config: appData.roles_config,
            client_id: appData.client_db_id, // Database ID
            client_string_id: appData.client_string_id, // Public ID (cli_...)
            client_name: appData.client_name,
            userType: 'application' // Context marker
        };

        // Also attach client ID directly for convenience
        req.clientId = appData.client_db_id;

        next();

    } catch (error) {
        logger.error('Application authentication error:', error);
        res.status(500).json({
            error: 'Authentication failed',
            code: 'AUTH_ERROR'
        });
    }
}

/**
 * Optional Application Authentication Middleware
 */
async function optionalApplicationAuth(req, res, next) {
    const applicationId = req.headers['x-application-id'];
    if (!applicationId) return next();
    return authenticateApplication(req, res, next);
}

module.exports = {
    authenticateApplication,
    optionalApplicationAuth
};
