const express = require('express');
const ApplicationKeyService = require('../services/applicationKey.service');
const logger = require('../utils/logger');
const database = require('../utils/database');

const router = express.Router();

/**
 * PUBLIC JWKS ENDPOINT
 * 
 * Returns public keys for an application in JWK format.
 * This endpoint MUST be public (no authentication) so that
 * third parties can verify JWTs issued by your applications.
 * 
 * Standard endpoint: /.well-known/jwks/:application_id.json
 */
router.get('/.well-known/jwks/:application_id.json', async (req, res) => {
  try {
    const { application_id } = req.params;

    logger.info('JWKS request for application', { application_id });

    // Validate application exists and is active
    const appQuery = `
      SELECT ca.id, ca.name, ca.is_active, c.is_active as client_is_active
      FROM client_applications ca
      JOIN clients c ON ca.client_id = c.id
      WHERE ca.id = $1
    `;

    const appResult = await database.query(appQuery, [application_id]);

    if (appResult.rows.length === 0) {
      logger.warn('JWKS requested for non-existent application', { application_id });
      return res.status(404).json({
        error: 'Application not found',
        code: 'APPLICATION_NOT_FOUND'
      });
    }

    const app = appResult.rows[0];

    // Check if application and client are active
    if (!app.is_active || !app.client_is_active) {
      logger.warn('JWKS requested for inactive application', { application_id });
      return res.status(404).json({
        error: 'Application is inactive',
        code: 'APPLICATION_INACTIVE'
      });
    }

    // Get public JWKs for application
    const keys = await ApplicationKeyService.getPublicJwk(application_id);

    if (keys.length === 0) {
      logger.warn('No active keys found for application', { application_id });
      return res.status(404).json({
        error: 'No active keys found for this application',
        code: 'NO_KEYS_FOUND',
        message: 'Application must generate keys first'
      });
    }

    // Return JWKS with proper caching headers
    res.set({
      'Cache-Control': 'public, max-age=3600',  // Cache for 1 hour
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'  // JWKS must be publicly accessible
    });

    res.json({ keys });

  } catch (error) {
    logger.error('JWKS endpoint error:', error);
    res.status(500).json({
      error: 'Failed to retrieve JWKS',
      code: 'JWKS_ERROR',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * DEVELOPMENT ENDPOINTS
 * Only available in development mode for testing
 */
if (process.env.NODE_ENV === 'development') {

  // Generate keys for an application (dev only)
  router.post('/applications/:application_id/generate-keys', async (req, res) => {
    try {
      const { application_id } = req.params;

      logger.info('Generating keys for application (dev)', { application_id });

      // Check if application exists
      const appQuery = `SELECT id, name FROM client_applications WHERE id = $1`;
      const appResult = await database.query(appQuery, [application_id]);

      if (appResult.rows.length === 0) {
        return res.status(404).json({
          error: 'Application not found',
          code: 'APPLICATION_NOT_FOUND'
        });
      }

      // Generate key pair
      const keyPair = await ApplicationKeyService.generateKeyPair(application_id);

      res.json({
        success: true,
        message: 'Key pair generated successfully',
        key: {
          kid: keyPair.kid,
          keyId: keyPair.keyId,
          algorithm: keyPair.algorithm
        },
        jwks_url: `${req.protocol}://${req.get('host')}/.well-known/jwks/${application_id}.json`
      });

    } catch (error) {
      logger.error('Key generation error:', error);
      res.status(500).json({
        error: error.message,
        code: 'KEY_GENERATION_ERROR'
      });
    }
  });

  // Get all keys for an application (dev only)
  router.get('/applications/:application_id/keys', async (req, res) => {
    try {
      const { application_id } = req.params;

      const keys = await ApplicationKeyService.getApplicationKeys(application_id);

      res.json({
        application_id: parseInt(application_id),
        keys: keys.map(k => ({
          id: k.id,
          keyId: k.key_id,
          kid: k.kid,
          algorithm: k.algorithm,
          is_active: k.is_active,
          created_at: k.created_at,
          revoked_at: k.revoked_at
        }))
      });

    } catch (error) {
      logger.error('Get keys error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Rotate keys for an application (dev only)
  router.post('/applications/:application_id/rotate-keys', async (req, res) => {
    try {
      const { application_id } = req.params;

      const result = await ApplicationKeyService.rotateKeys(application_id);

      res.json({
        success: true,
        message: 'Keys rotated successfully',
        new_key: result
      });

    } catch (error) {
      logger.error('Key rotation error:', error);
      res.status(500).json({ error: error.message });
    }
  });
}

/**
 * HEALTH CHECK for JWKS service
 */
router.get('/jwks/health', async (req, res) => {
  try {
    // Test database connection
    const dbResult = await database.query('SELECT 1 as test');
    const dbHealthy = dbResult.rows.length > 0;

    // Count total active keys
    const keysResult = await database.query(
      'SELECT COUNT(*) FROM application_keys WHERE is_active = true'
    );
    const activeKeys = parseInt(keysResult.rows[0].count);

    res.json({
      status: 'OK',
      service: 'jwks',
      database: dbHealthy ? 'connected' : 'disconnected',
      active_keys: activeKeys,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV
    });

  } catch (error) {
    logger.error('JWKS health check failed:', error);
    res.status(500).json({
      status: 'ERROR',
      service: 'jwks',
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;