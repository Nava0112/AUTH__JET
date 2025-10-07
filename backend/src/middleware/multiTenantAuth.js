const jwtService = require('../services/jwt.service');
const database = require('../utils/database');
const logger = require('../utils/logger');

/**
 * Admin Authentication Middleware
 * For SaaS platform administrators
 */
const authenticateAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Admin access token required',
        code: 'MISSING_ADMIN_TOKEN',
      });
    }

    const token = authHeader.substring(7);

    try {
      const decoded = await jwtService.verifyToken(token);
      
      // Verify admin exists and is active
      const adminQuery = `
        SELECT * FROM admins 
        WHERE id = $1 AND is_active = true
      `;
      
      const adminResult = await database.query(adminQuery, [decoded.sub]);
      
      if (adminResult.rows.length === 0) {
        return res.status(401).json({
          error: 'Admin not found or inactive',
          code: 'ADMIN_INACTIVE',
        });
      }

      const admin = adminResult.rows[0];
      
      // Verify session exists and is valid
      const sessionQuery = `
        SELECT * FROM sessions 
        WHERE admin_id = $1 AND session_type = 'admin' 
        AND expires_at > NOW() AND revoked = false
      `;
      
      const sessionResult = await database.query(sessionQuery, [admin.id]);
      
      if (sessionResult.rows.length === 0) {
        return res.status(401).json({
          error: 'Invalid or expired admin session',
          code: 'INVALID_ADMIN_SESSION',
        });
      }

      // Attach admin info to request
      req.admin = {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        userType: 'admin'
      };

      next();
    } catch (jwtError) {
      logger.warn('Admin JWT verification failed:', jwtError.message);
      
      return res.status(401).json({
        error: 'Invalid or expired admin token',
        code: 'INVALID_ADMIN_TOKEN',
      });
    }
  } catch (error) {
    logger.error('Admin authentication middleware error:', error);
    res.status(500).json({
      error: 'Admin authentication failed',
      code: 'ADMIN_AUTH_ERROR',
    });
  }
};

/**
 * Client Authentication Middleware
 * For client organizations using the SaaS
 */
const authenticateClient = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Client access token required',
        code: 'MISSING_CLIENT_TOKEN',
      });
    }

    const token = authHeader.substring(7);

    try {
      const decoded = await jwtService.verifyToken(token);
      
      // Verify client exists and is active
      const clientQuery = `
        SELECT * FROM clients 
        WHERE id = $1 AND is_active = true
      `;
      
      const clientResult = await database.query(clientQuery, [decoded.sub]);
      
      if (clientResult.rows.length === 0) {
        return res.status(401).json({
          error: 'Client not found or inactive',
          code: 'CLIENT_INACTIVE',
        });
      }

      const client = clientResult.rows[0];
      /*
      // Verify session exists and is valid
      const sessionQuery = `
        SELECT * FROM sessions 
        WHERE client_id = $1 AND session_type = 'client' 
        AND expires_at > NOW() AND revoked = false
      `;
      
      const sessionResult = await database.query(sessionQuery, [client.id]);
      
      if (sessionResult.rows.length === 0) {
        return res.status(401).json({
          error: 'Invalid or expired client session',
          code: 'INVALID_CLIENT_SESSION',
        });
      }
      */
      // Attach client info to request
      req.client = {
        id: client.id,
        email: client.email,
        name: client.name,
        company_name: client.company_name,
        plan_type: client.plan_type,
        userType: 'client'
      };

      next();
    } catch (jwtError) {
      logger.warn('Client JWT verification failed:', jwtError.message);
      
      return res.status(401).json({
        error: 'Invalid or expired client token',
        code: 'INVALID_CLIENT_TOKEN',
      });
    }
  } catch (error) {
    logger.error('Client authentication middleware error:', error);
    res.status(500).json({
      error: 'Client authentication failed',
      code: 'CLIENT_AUTH_ERROR',
    });
  }
};

/**
 * User Authentication Middleware
 * For end-users of client applications
 */
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
      const decoded = await jwtService.verifyToken(token);
      
      // Verify user exists and is active
      const userQuery = `
        SELECT u.*, c.name as client_name, ca.name as application_name, ca.auth_type
        FROM users u
        JOIN clients c ON u.client_id = c.id
        JOIN client_applications ca ON u.application_id = ca.id
        WHERE u.id = $1 AND u.is_active = true AND c.is_active = true AND ca.is_active = true
      `;
      
      const userResult = await database.query(userQuery, [decoded.sub]);
      
      if (userResult.rows.length === 0) {
        return res.status(401).json({
          error: 'User not found or inactive',
          code: 'USER_INACTIVE',
        });
      }

      const user = userResult.rows[0];
      
      // Verify session exists and is valid
      const sessionQuery = `
        SELECT * FROM sessions 
        WHERE user_id = $1 AND session_type = 'user' 
        AND expires_at > NOW() AND revoked = false
      `;

      const sessionResult = await database.query(sessionQuery, [user.id]);
      
      if (sessionResult.rows.length === 0) {
        return res.status(401).json({
          error: 'Invalid or expired user session',
          code: 'INVALID_USER_SESSION',
        });
      }
      
      // Attach user info to request
      req.user = {
        id: user.id,
        email: user.email,
        name: user.name,
        roles: user.roles,
        client_id: user.client_id,
        application_id: user.application_id,
        client_name: user.client_name,
        application_name: user.application_name,
        auth_type: user.auth_type,
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

/**
 * Application API Key Authentication
 * For server-to-server communication from client applications
 */
const authenticateApplication = async (req, res, next) => {
  try {
    const clientId = req.headers['x-client-id'];
    const clientSecret = req.headers['x-client-secret'];
    
    if (!clientId || !clientSecret) {
      return res.status(401).json({
        error: 'Application credentials required',
        code: 'MISSING_APP_CREDENTIALS',
      });
    }

    // Verify application exists and is active
    const appQuery = `
      SELECT ca.*, c.name as client_name, c.is_active as client_active
      FROM client_applications ca
      JOIN clients c ON ca.client_id = c.id
      WHERE ca.client_id_key = $1 AND ca.is_active = true AND c.is_active = true
    `;
    
    const appResult = await database.query(appQuery, [clientId]);
    
    if (appResult.rows.length === 0) {
      return res.status(401).json({
        error: 'Application not found or inactive',
        code: 'APP_INACTIVE',
      });
    }

    const application = appResult.rows[0];
    
    // Verify client secret
    const crypto = require('../utils/crypto');
    const isValidSecret = await crypto.comparePassword(clientSecret, application.client_secret_hash);
    
    if (!isValidSecret) {
      return res.status(401).json({
        error: 'Invalid application credentials',
        code: 'INVALID_APP_CREDENTIALS',
      });
    }

    // Attach application info to request
    req.application = {
      id: application.id,
      name: application.name,
      client_id: application.client_id,
      client_name: application.client_name,
      auth_type: application.auth_type,
      settings: application.settings,
      userType: 'application'
    };

    next();
  } catch (error) {
    logger.error('Application authentication middleware error:', error);
    res.status(500).json({
      error: 'Application authentication failed',
      code: 'APP_AUTH_ERROR',
    });
  }
};

/**
 * Role-based authorization middleware
 */
const requireRole = (allowedRoles, userType = 'user') => {
  return (req, res, next) => {
    let user;
    
    switch (userType) {
      case 'admin':
        user = req.admin;
        break;
      case 'client':
        user = req.client;
        break;
      case 'user':
        user = req.user;
        break;
      default:
        return res.status(500).json({
          error: 'Invalid user type for role check',
          code: 'INVALID_USER_TYPE',
        });
    }

    if (!user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    // For users, check roles array
    if (userType === 'user') {
      const userRoles = user.roles || [];
      const hasRequiredRole = allowedRoles.some(role => userRoles.includes(role));

      if (!hasRequiredRole) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          code: 'FORBIDDEN',
        });
      }
    } else {
      // For admin/client, check single role
      if (!allowedRoles.includes(user.role || 'admin')) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          code: 'FORBIDDEN',
        });
      }
    }

    next();
  };
};

module.exports = {
  authenticateAdmin,
  authenticateClient,
  authenticateUser,
  authenticateApplication,
  requireRole,
};
