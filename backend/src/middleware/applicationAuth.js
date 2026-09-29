const database = require('../utils/database');
const logger = require('../utils/logger');

async function authenticateApplication(req, res, next) {
    try {
        const applicationId = req.headers['x-application-id'];
        const applicationSecret = req.headers['x-application-secret'];

        // Validate App ID present
        if (!applicationId) {
            return res.status(401).json({
                error: 'Missing application credentials',
                code: 'MISSING_APP_CREDENTIALS',
                message: 'X-Application-ID header is required'
            });
        }

        // Query application by its public OAuth identifier.
        const query = `
      SELECT 
        ca.*,
        c.id as client_db_id,
        c.client_id as client_string_id,
        c.name as client_name,
        c.is_active as client_is_active
      FROM client_applications ca
      JOIN clients c ON ca.client_id = c.id
    WHERE ca.oauth_application_id = $1
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

        if (!applicationSecret) {
            return res.status(401).json({
                error: 'Missing application credentials',
                code: 'MISSING_APP_CREDENTIALS',
                message: 'X-Application-Secret header is required'
            });
        }

        if (appData.oauth_application_secret !== applicationSecret) {
            return res.status(401).json({
                error: 'Invalid application secret',
                code: 'INVALID_APP_SECRET',
                message: 'The provided application secret is incorrect'
            });
        }

        // Attach application info to request
        req.application = {
            id: appData.id,
            name: appData.name,
            description: appData.description,
            redirect_url: appData.redirect_url,
            oauth_application_id: appData.oauth_application_id,
            oauth_allowed_scopes: appData.oauth_allowed_scopes,
            oauth_jwt_claims: appData.oauth_jwt_claims,
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
