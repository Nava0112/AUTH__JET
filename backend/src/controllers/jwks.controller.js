const ApplicationKeyService = require('../services/applicationKey.service');
const logger = require('../utils/logger');
const database = require('../utils/database');

class JwksController {
  /**
   * Get JWKS for an application using body credentials
   * POST /.well-known/jwks
   */
  static async getJwksByOauthApplicationId(req, res) {
    try {
      const { oauth_application_id, oauth_application_secret } = req.body || {};

      if (!oauth_application_id || !oauth_application_secret) {
        return res.status(400).json({
          error: 'Missing application credentials',
          code: 'MISSING_APP_CREDENTIALS',
          message: 'oauth_application_id and oauth_application_secret are required'
        });
      }

      logger.info('JWKS request with application credentials', { oauth_application_id });

      const app = await JwksController.validateApplicationWithSecret(
        oauth_application_id,
        oauth_application_secret
      );

      if (!app) {
        return res.status(401).json({
          error: 'Invalid application credentials',
          code: 'INVALID_APP_CREDENTIALS'
        });
      }

      if (!app.is_active || !app.client_is_active) {
        logger.warn('JWKS requested for inactive application', { oauth_application_id });
        return res.status(404).json({
          error: 'Application is inactive',
          code: 'APPLICATION_INACTIVE'
        });
      }

      const keys = await ApplicationKeyService.getPublicJwk(app.id);

      res.set({
        'Cache-Control': 'public, max-age=3600',
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });

      res.json({ keys });
    } catch (error) {
      logger.error('JWKS credentialed endpoint error:', error);
      res.status(500).json({
        error: 'Failed to retrieve JWKS',
        code: 'JWKS_ERROR',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }

  /**
   * Helper: Validate application exists, is active, and matches the provided secret
   */
  static async validateApplicationWithSecret(application_id, application_secret) {
    const appQuery = `
      SELECT ca.id, ca.name, ca.is_active, ca.oauth_application_secret, c.is_active as client_is_active
      FROM client_applications ca
      JOIN clients c ON ca.client_id = c.id
      WHERE ca.oauth_application_id = $1
    `;
    const appResult = await database.query(appQuery, [application_id]);

    if (appResult.rows.length === 0) {
      return null;
    }

    const app = appResult.rows[0];
    if (app.oauth_application_secret !== application_secret) {
      return null;
    }

    return app;
  }

}

module.exports = JwksController;