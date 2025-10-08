const userJwtService = require('../services/userJwt.service');
const database = require('../utils/database');
const logger = require('../utils/logger');

const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'User access token required',
        code: 'MISSING_USER_TOKEN',
      });
    }

    const token = authHeader.substring(7);

    try {
      const decoded = await userJwtService.verifyToken(token);
      
      // Verify user exists and is active
      const userQuery = `
        SELECT u.*, ca.name as application_name, c.name as client_name
        FROM users u
        JOIN client_applications ca ON u.application_id = ca.id
        JOIN clients c ON u.client_id = c.id
        WHERE u.id = $1 AND u.client_id = $2 AND u.application_id = $3
        AND u.is_active = true AND ca.is_active = true AND c.is_active = true
      `;
      
      const userResult = await database.query(userQuery, [
        decoded.sub, 
        decoded.client_id, 
        decoded.application_id
      ]);
      
      if (userResult.rows.length === 0) {
        return res.status(401).json({
          error: 'User not found or inactive',
          code: 'USER_INACTIVE',
        });
      }

      const user = userResult.rows[0];

      // Attach user info to request
      req.user = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        client_id: user.client_id,
        application_id: user.application_id,
        client_name: user.client_name,
        application_name: user.application_name,
        userType: 'user'
      };

      next();
    } catch (jwtError) {
      logger.warn('User JWT verification failed:', jwtError.message);
      
      return res.status(401).json({
        error: 'Invalid or expired user token',
        code: 'INVALID_USER_TOKEN',
      });
    }
  } catch (error) {
    logger.error('User authentication middleware error:', error);
    res.status(500).json({
      error: 'User authentication failed',
      code: 'USER_AUTH_ERROR',
    });
  }
};

module.exports = {
  authenticateUser
};