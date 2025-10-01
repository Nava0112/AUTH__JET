const crypto = require('../utils/crypto');
const database = require('../utils/database');
const logger = require('../utils/logger');

const authenticateClient = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];
    const clientSecret = req.headers['x-client-secret'];
    
    if (!apiKey) {
      return res.status(401).json({
        error: 'API key required',
        code: 'MISSING_API_KEY',
      });
    }

    // Find client by API key
    const clientQuery = 'SELECT * FROM clients WHERE api_key = $1';
    const clientResult = await database.query(clientQuery, [apiKey]);
    
    if (clientResult.rows.length === 0) {
      return res.status(401).json({
        error: 'Invalid API key',
        code: 'INVALID_API_KEY',
      });
    }

    const client = clientResult.rows[0];

    // If client secret is provided, verify it
    if (clientSecret) {
      const isValidSecret = await crypto.verifyHash(clientSecret, client.secret_key_hash);
      
      if (!isValidSecret) {
        return res.status(401).json({
          error: 'Invalid client secret',
          code: 'INVALID_CLIENT_SECRET',
        });
      }
    }

    // Check if client is allowed to make requests from this domain
    if (req.headers.origin) {
      const allowedDomains = client.allowed_domains || [];
      const requestOrigin = new URL(req.headers.origin).hostname;
      
      const isDomainAllowed = allowedDomains.some(domain => {
        if (domain.startsWith('*.')) {
          const baseDomain = domain.substring(2);
          return requestOrigin.endsWith('.' + baseDomain) || requestOrigin === baseDomain;
        }
        return requestOrigin === domain;
      });

      if (!isDomainAllowed && allowedDomains.length > 0) {
        return res.status(403).json({
          error: 'Domain not allowed',
          code: 'DOMAIN_NOT_ALLOWED',
        });
      }
    }

    // Attach client to request
    req.client = client;
    next();

  } catch (error) {
    logger.error('Client authentication error:', error);
    res.status(500).json({
      error: 'Authentication failed',
      code: 'AUTH_ERROR',
    });
  }
};

const requireClientSecret = (req, res, next) => {
  const clientSecret = req.headers['x-client-secret'];
  
  if (!clientSecret) {
    return res.status(401).json({
      error: 'Client secret required',
      code: 'MISSING_CLIENT_SECRET',
    });
  }
  
  next();
};

module.exports = {
  authenticateClient,
  requireClientSecret,
};