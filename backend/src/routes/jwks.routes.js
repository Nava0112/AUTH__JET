const express = require('express');
const ClientKeyService = require('../services/clientKey.service');
const logger = require('../utils/logger');
const database = require('../utils/database');

const router = express.Router();

// PUBLIC CLIENT-SPECIFIC JWKS ENDPOINT (NO AUTH REQUIRED)
// This is what external client applications use to verify user JWTs
router.get('/clients/:clientId/jwks.json', async (req, res) => {
  try {
    const { clientId } = req.params;
    
    // Verify client exists and is active
    const clientQuery = 'SELECT id FROM clients WHERE id = $1 AND is_active = true';
    const clientResult = await database.query(clientQuery, [clientId]);
    
    if (clientResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Client not found or inactive',
        code: 'CLIENT_NOT_FOUND'
      });
    }
    
    // Get public JWK for this client
    const jwk = await ClientKeyService.getPublicJwk(clientId);
    
    // Set cache headers for better performance
    res.set('Cache-Control', 'public, max-age=3600');
    res.set('Access-Control-Allow-Origin', '*'); // Allow CORS for public endpoint
    res.json({ keys: [jwk] });
    
  } catch (error) {
    logger.error('Client JWKS endpoint error:', error);
    
    if (error.message.includes('No key found')) {
      return res.status(404).json({ 
        error: 'No active key found for this client. Client must generate keys first.',
        code: 'NO_KEYS_FOUND'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to retrieve JWKS for client',
      code: 'CLIENT_JWKS_ERROR'
    });
  }
});

// PUBLIC APPLICATION-SPECIFIC JWKS ENDPOINT (NO AUTH REQUIRED)
// Alternative endpoint using application_id
router.get('/applications/:applicationId/jwks.json', async (req, res) => {
  try {
    const { applicationId } = req.params;
    
    // Get client_id from application
    const appQuery = `
      SELECT ca.client_id, c.is_active as client_active, ca.is_active as app_active
      FROM client_applications ca
      JOIN clients c ON ca.client_id = c.id
      WHERE ca.id = $1
    `;
    const appResult = await database.query(appQuery, [applicationId]);
    
    if (appResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Application not found',
        code: 'APPLICATION_NOT_FOUND'
      });
    }
    
    const app = appResult.rows[0];
    
    if (!app.client_active || !app.app_active) {
      return res.status(404).json({
        error: 'Application or client is inactive',
        code: 'APPLICATION_INACTIVE'
      });
    }
    
    // Get public JWK for this client
    const jwk = await ClientKeyService.getPublicJwk(app.client_id);
    
    // Set cache headers for better performance
    res.set('Cache-Control', 'public, max-age=3600');
    res.set('Access-Control-Allow-Origin', '*'); // Allow CORS for public endpoint
    res.json({ keys: [jwk] });
    
  } catch (error) {
    logger.error('Application JWKS endpoint error:', error);
    
    if (error.message.includes('No key found')) {
      return res.status(404).json({ 
        error: 'No active key found for this application. Client must generate keys first.',
        code: 'NO_KEYS_FOUND'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to retrieve JWKS for application',
      code: 'APPLICATION_JWKS_ERROR'
    });
  }
});

module.exports = router;
