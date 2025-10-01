const jwtService = require('../services/jwt.service');
const database = require('../utils/database');
const logger = require('../utils/logger');

const authenticateJWT = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Access token required',
        code: 'MISSING_TOKEN',
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
      const decoded = await jwtService.verifyToken(token);
      
      // Verify user still exists and is active
      const userQuery = `
        SELECT u.*, cu.roles, cu.client_id
        FROM users u
        JOIN client_users cu ON u.id = cu.user_id
        WHERE u.id = $1 AND u.status = 'active'
      `;
      
      const userResult = await database.query(userQuery, [decoded.sub]);
      
      if (userResult.rows.length === 0) {
        return res.status(401).json({
          error: 'User not found or inactive',
          code: 'USER_INACTIVE',
        });
      }

      const user = userResult.rows[0];
      
      // Verify client exists and is active
      const clientQuery = 'SELECT * FROM clients WHERE id = $1';
      const clientResult = await database.query(clientQuery, [user.client_id]);
      
      if (clientResult.rows.length === 0) {
        return res.status(401).json({
          error: 'Client not found',
          code: 'CLIENT_NOT_FOUND',
        });
      }

      // Attach user and client info to request
      req.user = {
        id: user.id,
        email: user.email,
        email_verified: user.email_verified,
        roles: user.roles,
        client_id: user.client_id,
      };
      
      req.client = clientResult.rows[0];

      next();
    } catch (jwtError) {
      logger.warn('JWT verification failed:', jwtError.message);
      
      return res.status(401).json({
        error: 'Invalid or expired token',
        code: 'INVALID_TOKEN',
      });
    }
  } catch (error) {
    logger.error('Authentication middleware error:', error);
    res.status(500).json({
      error: 'Authentication failed',
      code: 'AUTH_ERROR',
    });
  }
};

const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    const userRoles = req.user.roles || [];
    const hasRequiredRole = allowedRoles.some(role => userRoles.includes(role));

    if (!hasRequiredRole) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        code: 'FORBIDDEN',
      });
    }

    next();
  };
};

const requireEmailVerification = (req, res, next) => {
  if (!req.user.email_verified) {
    return res.status(403).json({
      error: 'Email verification required',
      code: 'EMAIL_NOT_VERIFIED',
    });
  }
  next();
};

module.exports = {
  authenticateJWT,
  requireRole,
  requireEmailVerification,
};