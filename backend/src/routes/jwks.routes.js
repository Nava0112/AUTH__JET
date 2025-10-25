const express = require('express');
const ClientKeyService = require('../services/clientKey.service');
const { authenticateApplication } = require('../middleware/multiTenantAuth');
const logger = require('../utils/logger');
const database = require('../utils/database');

const router = express.Router();

// PROTECTED CLIENT-SPECIFIC JWKS ENDPOINT (REQUIRES CLIENT AUTH)
// All applications under the same client share the same key pair
router.get('/jwks.json', authenticateApplication, async (req, res) => {
  try {
    const clientId = req.application.client_id;
    
    logger.info('JWKS request from client application', {
      clientId: clientId,
      applicationId: req.application.id,
      applicationName: req.application.name
    });

    // Get public JWK for this client (shared across all applications)
    // FIX: Use numeric client ID from the application object
    const jwk = await ClientKeyService.getPublicJwk(req.application.client_id);
    
    // Set cache headers for better performance
    res.set('Cache-Control', 'public, max-age=3600');
    res.json({ 
      keys: [jwk],
      client: {
        id: clientId,
        name: req.application.client_name
      },
      application: {
        id: req.application.id,
        name: req.application.name
      }
    });
    
  } catch (error) {
    logger.error('Client JWKS endpoint error:', error);
    
    if (error.message.includes('No key found')) {
      return res.status(404).json({ 
        error: 'No active key found for this client. Please generate keys first in your client dashboard.',
        code: 'NO_KEYS_FOUND'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to retrieve JWKS for client',
      code: 'CLIENT_JWKS_ERROR'
    });
  }
});

// BACKWARD COMPATIBILITY: Public endpoint (FIXED VERSION)
router.get('/clients/:clientIdString/jwks.json', async (req, res) => {
  try {
    const { clientIdString } = req.params;
    
    logger.info('Public JWKS request for client', { clientIdString });
    
    // FIX: Look up client by client_id string column instead of numeric ID
    const clientQuery = `
      SELECT id, name, client_id 
      FROM clients 
      WHERE client_id = $1 AND is_active = true
    `;
    const clientResult = await database.query(clientQuery, [clientIdString]);
    
    if (clientResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Client not found or inactive',
        code: 'CLIENT_NOT_FOUND'
      });
    }
    
    const client = clientResult.rows[0];
    
    // Get public JWK for this client using numeric ID
    const jwk = await ClientKeyService.getPublicJwk(clientIdString);
    
    // Set cache headers
    res.set('Cache-Control', 'public, max-age=3600');
    res.set('Access-Control-Allow-Origin', '*');
    
    logger.warn('Public JWKS endpoint used', { 
      clientIdString,
      clientNumericId: client.id 
    });
    
    res.json({ 
      keys: [jwk],
      client: {
        id: client.client_id,
        name: client.name
      },
      warning: 'This public endpoint is deprecated. Use authenticated endpoint with client credentials.'
    });
    
  } catch (error) {
    logger.error('Public client JWKS endpoint error:', error);
    
    if (error.message.includes('No key found')) {
      return res.status(404).json({ 
        error: 'No active key found for this client. Client must generate keys first.',
        code: 'NO_KEYS_FOUND'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to retrieve JWKS',
      code: 'JWKS_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// HEALTH CHECK ENDPOINT FOR JWKS SERVICE
router.get('/health', async (req, res) => {
  try {
    // Test database connection
    const dbResult = await database.query('SELECT 1 as test');
    const dbHealthy = dbResult.rows.length > 0;
    
    // Test key service
    let keyServiceHealthy = false;
    let activeClients = 0;
    
    try {
      const clientsQuery = `
        SELECT COUNT(*) as count 
        FROM clients c 
        WHERE c.is_active = true 
        AND EXISTS (
          SELECT 1 FROM client_keys ck 
          WHERE ck.client_id = c.id AND ck.is_active = true
        )
      `;
      const clientsResult = await database.query(clientsQuery);
      activeClients = parseInt(clientsResult.rows[0].count);
      keyServiceHealthy = true;
    } catch (keyError) {
      logger.warn('Key service health check failed:', keyError);
    }
    
    res.json({
      status: 'OK',
      service: 'jwks',
      timestamp: new Date().toISOString(),
      components: {
        database: dbHealthy ? 'healthy' : 'unhealthy',
        key_service: keyServiceHealthy ? 'healthy' : 'unhealthy'
      },
      stats: {
        active_clients_with_keys: activeClients
      }
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

// CLIENT KEY GENERATION ENDPOINT (for testing/development)
router.post('/clients/:clientIdString/generate-keys', async (req, res) => {
  try {
    const { clientIdString } = req.params;
    
    // Only allow in development
    if (process.env.NODE_ENV !== 'development') {
      return res.status(403).json({
        error: 'Key generation endpoint only available in development',
        code: 'DEVELOPMENT_ONLY'
      });
    }
    
    // Look up client by client_id string
    const clientQuery = `
      SELECT id, name, client_id 
      FROM clients 
      WHERE client_id = $1 AND is_active = true
    `;
    const clientResult = await database.query(clientQuery, [clientIdString]);
    
    if (clientResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Client not found or inactive',
        code: 'CLIENT_NOT_FOUND'
      });
    }
    
    const client = clientResult.rows[0];
    
    // Check if client already has active keys
    const existingKeysQuery = `
      SELECT COUNT(*) as count 
      FROM client_keys 
      WHERE client_id = $1 AND is_active = true
    `;
    const existingKeysResult = await database.query(existingKeysQuery, [client.id]);
    const hasExistingKeys = parseInt(existingKeysResult.rows[0].count) > 0;
    
    if (hasExistingKeys) {
      return res.status(400).json({
        error: 'Client already has active keys. Use key rotation instead.',
        code: 'KEYS_EXIST'
      });
    }
    
    // Generate new key pair
    const keyPair = await ClientKeyService.generateKeyPair(client.id);
    
    logger.info('Key pair generated via API', {
      clientId: client.id,
      clientIdString: client.client_id,
      keyId: keyPair.keyId
    });
    
    res.json({
      success: true,
      message: 'Key pair generated successfully',
      client: {
        id: client.client_id,
        name: client.name
      },
      key: {
        keyId: keyPair.keyId,
        kid: keyPair.kid,
        algorithm: keyPair.algorithm,
        publicKey: keyPair.publicKey.substring(0, 100) + '...', // Truncated for security
        warning: 'Store the private key securely. It will not be shown again.'
      }
    });
    
  } catch (error) {
    logger.error('Key generation endpoint error:', error);
    
    if (error.message.includes('already has an active key')) {
      return res.status(400).json({
        error: error.message,
        code: 'KEYS_EXIST'
      });
    }
    
    res.status(500).json({
      error: 'Failed to generate key pair',
      code: 'KEY_GENERATION_ERROR',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// CLIENT KEY INFO ENDPOINT
router.get('/clients/:clientIdString/keys', async (req, res) => {
  try {
    const { clientIdString } = req.params;
    
    // Look up client by client_id string
    const clientQuery = `
      SELECT id, name, client_id 
      FROM clients 
      WHERE client_id = $1 AND is_active = true
    `;
    const clientResult = await database.query(clientQuery, [clientIdString]);
    
    if (clientResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Client not found or inactive',
        code: 'CLIENT_NOT_FOUND'
      });
    }
    
    const client = clientResult.rows[0];
    
    // Get all keys for this client
    const keys = await ClientKeyService.getClientKeys(client.id);
    
    res.json({
      client: {
        id: client.client_id,
        name: client.name
      },
      keys: keys
    });
    
  } catch (error) {
    logger.error('Client keys endpoint error:', error);
    res.status(500).json({
      error: 'Failed to retrieve client keys',
      code: 'GET_KEYS_ERROR'
    });
  }
});

module.exports = router;