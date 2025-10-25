const express = require('express');
const { authenticateClient } = require('../middleware/multiTenantAuth');
const ClientKeyService = require('../services/clientKey.service');
const logger = require('../utils/logger');

const router = express.Router();

// All routes require client authentication
router.use(authenticateClient);

// Generate new key pair for client
router.post('/keys/generate', async (req, res) => {
  try {
    const clientId = req.client.id;
    const keyPair = await ClientKeyService.generateKeyPair(clientId);

    res.json({
      success: true,
      keyId: keyPair.keyId,
      kid: keyPair.kid,
      publicKey: keyPair.publicKey,
      algorithm: keyPair.algorithm,
      // Private key only returned once during generation
      privateKey: keyPair.privateKey,
      warning: 'Store the private key securely. It will not be shown again.'
    });
  } catch (error) {
    logger.error('Key generation error:', error);
    res.status(500).json({
      error: 'Failed to generate key pair',
      code: 'KEY_GENERATION_ERROR'
    });
  }
});

// Get client's public JWKS
router.get('/.well-known/jwks.json', async (req, res) => {
  try {
    const clientId = req.client.id;
    const jwk = await ClientKeyService.getPublicJwk(clientId);

    res.set('Cache-Control', 'public, max-age=3600');
    res.json({ keys: [jwk] });
  } catch (error) {
    logger.error('JWKS endpoint error:', error);
    res.status(500).json({
      error: 'Failed to retrieve JWKS',
      code: 'JWKS_ERROR'
    });
  }
});

// Get all client keys
router.get('/keys', async (req, res) => {
  try {
    const clientId = req.client.id;
    const keys = await ClientKeyService.getClientKeys(clientId);

    res.json({ keys });
  } catch (error) {
    logger.error('Get client keys error:', error);
    res.status(500).json({
      error: 'Failed to retrieve client keys',
      code: 'GET_KEYS_ERROR'
    });
  }
});

// Rotate keys (generate new, revoke old)
router.post('/keys/rotate', async (req, res) => {
  try {
    const clientId = req.client.id;
    const newKey = await ClientKeyService.rotateKeys(clientId);

    res.json({
      success: true,
      message: 'Keys rotated successfully',
      newKey: {
        keyId: newKey.keyId,
        kid: newKey.kid,
        publicKey: newKey.publicKey,
        privateKey: newKey.privateKey,
        algorithm: newKey.algorithm
      }
    });
  } catch (error) {
    logger.error('Key rotation error:', error);
    res.status(500).json({
      error: 'Failed to rotate keys',
      code: 'KEY_ROTATION_ERROR'
    });
  }
});

// Revoke specific key
router.post('/keys/:keyId/revoke', async (req, res) => {
  try {
    const clientId = req.client.id;
    const { keyId } = req.params;

    const revokedKey = await ClientKeyService.revokeKey(clientId, keyId);

    res.json({
      success: true,
      message: 'Key revoked successfully',
      keyId: revokedKey.key_id
    });
  } catch (error) {
    logger.error('Key revocation error:', error);
    res.status(500).json({
      error: 'Failed to revoke key',
      code: 'KEY_REVOCATION_ERROR'
    });
  }
});

module.exports = router;