const express = require('express');
const userJwtService = require('../services/userJwt.service');
const jose = require('jose');

const router = express.Router();

// JWKS endpoint for public key distribution
router.get('/jwks', async (req, res) => {
  try {
    const publicKey = await jose.importSPKI(userJwtService.publicKey, 'RS256');
    const jwk = await jose.exportJWK(publicKey);
    
    const jwks = {
      keys: [{
        ...jwk,
        use: 'sig',
        alg: 'RS256',
        kid: 'authjet-1',
      }]
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    
    res.json(jwks);
  } catch (error) {
    console.error('JWKS endpoint error:', error);
    res.status(500).json({
      error: 'Failed to generate JWKS',
      code: 'JWKS_ERROR'
    });
  }
});

// Public key endpoint (simple format)
router.get('/public-key', (req, res) => {
  try {
    res.setHeader('Content-Type', 'application/x-pem-file');
    res.send(userJwtService.publicKey);
  } catch (error) {
    console.error('Public key endpoint error:', error);
    res.status(500).json({
      error: 'Failed to retrieve public key',
      code: 'PUBLIC_KEY_ERROR'
    });
  }
});

module.exports = router;