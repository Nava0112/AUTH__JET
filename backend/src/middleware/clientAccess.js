const database = require('../utils/database');
const logger = require('../utils/logger');

/**
 * Middleware to check if user can access client management features
 * Allows access if user has admin/viewer roles OR if they're the only user for their client
 */
const requireClientAccess = (allowedRoles = ['admin', 'viewer']) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'UNAUTHORIZED',
        });
      }

      const userRoles = req.user.roles || [];
      const hasRequiredRole = allowedRoles.some(role => userRoles.includes(role));

      // If user has explicit admin/viewer role, allow access
      if (hasRequiredRole) {
        return next();
      }

      // Check if user is the primary/only user for their client
      // This allows single-user setups to manage their client without explicit admin role
      const clientUserCountQuery = `
        SELECT COUNT(*) as user_count
        FROM client_users 
        WHERE client_id = $1
      `;
      
      const result = await database.query(clientUserCountQuery, [req.user.client_id]);
      const userCount = parseInt(result.rows[0].user_count);

      // If user is the only user for this client, grant access
      if (userCount === 1) {
        logger.info('Granting client access to single user', { 
          userId: req.user.id, 
          clientId: req.user.client_id 
        });
        return next();
      }

      // Otherwise, deny access
      return res.status(403).json({
        error: 'Insufficient permissions. Contact your administrator to assign admin or viewer role.',
        code: 'FORBIDDEN',
      });

    } catch (error) {
      logger.error('Client access middleware error:', error);
      res.status(500).json({
        error: 'Authorization check failed',
        code: 'AUTH_ERROR',
      });
    }
  };
};

/**
 * Middleware specifically for write operations (create, update, delete)
 */
const requireClientWriteAccess = () => {
  return requireClientAccess(['admin']);
};

/**
 * Middleware for read operations (view, list)
 */
const requireClientReadAccess = () => {
  return requireClientAccess(['admin', 'viewer']);
};

module.exports = {
  requireClientAccess,
  requireClientWriteAccess,
  requireClientReadAccess,
};
