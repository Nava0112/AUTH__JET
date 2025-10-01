const database = require('../utils/database');
const logger = require('../utils/logger');
const jwtService = require('../services/jwt.service');

class UserController {
  async getUsers(req, res, next) {
    try {
      const { client_id } = req.params;
      const { page = 1, limit = 20, search, sort = 'created_at', order = 'desc' } = req.query;
      const offset = (page - 1) * limit;

      // Verify client access
      if (req.client && req.client.id !== client_id) {
        return res.status(403).json({
          error: 'Access to this client data is forbidden',
          code: 'FORBIDDEN',
        });
      }

      let query = `
        SELECT 
          u.id, u.email, u.email_verified, u.status, u.last_login, u.login_count,
          u.created_at, u.updated_at, cu.roles, cu.custom_data
        FROM users u
        JOIN client_users cu ON u.id = cu.user_id
        WHERE cu.client_id = $1
      `;
      
      let countQuery = `
        SELECT COUNT(*)
        FROM users u
        JOIN client_users cu ON u.id = cu.user_id
        WHERE cu.client_id = $1
      `;
      
      const params = [client_id];
      let paramCount = 1;

      if (search) {
        paramCount++;
        query += ` AND u.email ILIKE $${paramCount}`;
        countQuery += ` AND u.email ILIKE $${paramCount}`;
        params.push(`%${search}%`);
      }

      // Validate sort field to prevent SQL injection
      const validSortFields = ['created_at', 'email', 'last_login', 'login_count'];
      const sortField = validSortFields.includes(sort) ? sort : 'created_at';
      const sortOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

      paramCount++;
      query += ` ORDER BY u.${sortField} ${sortOrder} LIMIT $${paramCount}`;
      params.push(limit);

      paramCount++;
      query += ` OFFSET $${paramCount}`;
      params.push(offset);

      const [usersResult, countResult] = await Promise.all([
        database.query(query, params),
        database.query(countQuery, params.slice(0, -2)), // Remove limit/offset for count
      ]);

      const totalCount = parseInt(countResult.rows[0].count);

      res.json({
        users: usersResult.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount,
          pages: Math.ceil(totalCount / limit),
        },
      });

    } catch (error) {
      logger.error('Get users error:', error);
      next(error);
    }
  }

  async getUser(req, res, next) {
    try {
      const { client_id, user_id } = req.params;

      // Verify client access
      if (req.client && req.client.id !== client_id) {
        return res.status(403).json({
          error: 'Access to this client data is forbidden',
          code: 'FORBIDDEN',
        });
      }

      const query = `
        SELECT 
          u.id, u.email, u.email_verified, u.status, u.last_login, u.login_count,
          u.created_at, u.updated_at, cu.roles, cu.custom_data
        FROM users u
        JOIN client_users cu ON u.id = cu.user_id
        WHERE u.id = $1 AND cu.client_id = $2
      `;
      
      const result = await database.query(query, [user_id, client_id]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'User not found',
          code: 'USER_NOT_FOUND',
        });
      }

      res.json({ user: result.rows[0] });

    } catch (error) {
      logger.error('Get user error:', error);
      next(error);
    }
  }

  async updateUser(req, res, next) {
    try {
      const { client_id, user_id } = req.params;
      const { roles, custom_data, status } = req.body;

      // Verify client access
      if (req.client && req.client.id !== client_id) {
        return res.status(403).json({
          error: 'Access to this client data is forbidden',
          code: 'FORBIDDEN',
        });
      }

      const updates = [];
      const params = [user_id, client_id];
      let paramCount = 2;

      if (roles !== undefined) {
        paramCount++;
        updates.push(`roles = $${paramCount}`);
        params.push(JSON.stringify(roles));
      }

      if (custom_data !== undefined) {
        paramCount++;
        updates.push(`custom_data = $${paramCount}`);
        params.push(JSON.stringify(custom_data));
      }

      if (status !== undefined && req.user) { // Only allow status updates for authenticated users (not client API)
        paramCount++;
        updates.push(`status = $${paramCount}`);
        params.push(status);
      }

      if (updates.length === 0) {
        return res.status(400).json({
          error: 'No valid fields to update',
          code: 'NO_VALID_FIELDS',
        });
      }

      const query = `
        UPDATE client_users 
        SET ${updates.join(', ')}, updated_at = NOW()
        WHERE user_id = $1 AND client_id = $2
        RETURNING *
      `;

      const result = await database.query(query, params);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'User not found',
          code: 'USER_NOT_FOUND',
        });
      }

      logger.info('User updated successfully', { userId: user_id, clientId: client_id });

      res.json({ user: result.rows[0] });

    } catch (error) {
      logger.error('Update user error:', error);
      next(error);
    }
  }

  async getUserSessions(req, res, next) {
    try {
      const { client_id, user_id } = req.params;

      // Verify client access
      if (req.client && req.client.id !== client_id) {
        return res.status(403).json({
          error: 'Access to this client data is forbidden',
          code: 'FORBIDDEN',
        });
      }

      const query = `
        SELECT 
          id, device_info, ip_address, created_at, last_used_at, expires_at
        FROM sessions 
        WHERE user_id = $1 AND client_id = $2 AND revoked = false AND expires_at > NOW()
        ORDER BY last_used_at DESC
      `;
      
      const result = await database.query(query, [user_id, client_id]);

      res.json({ sessions: result.rows });

    } catch (error) {
      logger.error('Get user sessions error:', error);
      next(error);
    }
  }

  async revokeUserSession(req, res, next) {
    try {
      const { client_id, user_id, session_id } = req.params;

      // Verify client access
      if (req.client && req.client.id !== client_id) {
        return res.status(403).json({
          error: 'Access to this client data is forbidden',
          code: 'FORBIDDEN',
        });
      }

      const query = `
        UPDATE sessions 
        SET revoked = true, revoked_at = NOW()
        WHERE id = $1 AND user_id = $2 AND client_id = $3
        RETURNING id
      `;
      
      const result = await database.query(query, [session_id, user_id, client_id]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Session not found',
          code: 'SESSION_NOT_FOUND',
        });
      }

      logger.info('User session revoked', { userId: user_id, sessionId: session_id, clientId: client_id });

      res.json({ message: 'Session revoked successfully' });

    } catch (error) {
      logger.error('Revoke user session error:', error);
      next(error);
    }
  }

  async revokeAllUserSessions(req, res, next) {
    try {
      const { client_id, user_id } = req.params;

      // Verify client access
      if (req.client && req.client.id !== client_id) {
        return res.status(403).json({
          error: 'Access to this client data is forbidden',
          code: 'FORBIDDEN',
        });
      }

      await jwtService.revokeAllUserSessions(user_id, client_id);

      logger.info('All user sessions revoked', { userId: user_id, clientId: client_id });

      res.json({ message: 'All sessions revoked successfully' });

    } catch (error) {
      logger.error('Revoke all user sessions error:', error);
      next(error);
    }
  }

  async getUserLoginHistory(req, res, next) {
    try {
      const { client_id, user_id } = req.params;
      const { page = 1, limit = 50 } = req.query;
      const offset = (page - 1) * limit;

      // Verify client access
      if (req.client && req.client.id !== client_id) {
        return res.status(403).json({
          error: 'Access to this client data is forbidden',
          code: 'FORBIDDEN',
        });
      }

      const query = `
        SELECT action, ip_address, user_agent, metadata, created_at
        FROM audit_logs 
        WHERE user_id = $1 AND client_id = $2 AND action IN ('login', 'logout', 'register')
        ORDER BY created_at DESC
        LIMIT $3 OFFSET $4
      `;
      
      const countQuery = `
        SELECT COUNT(*)
        FROM audit_logs 
        WHERE user_id = $1 AND client_id = $2 AND action IN ('login', 'logout', 'register')
      `;

      const [logsResult, countResult] = await Promise.all([
        database.query(query, [user_id, client_id, limit, offset]),
        database.query(countQuery, [user_id, client_id]),
      ]);

      const totalCount = parseInt(countResult.rows[0].count);

      res.json({
        logs: logsResult.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount,
          pages: Math.ceil(totalCount / limit),
        },
      });

    } catch (error) {
      logger.error('Get user login history error:', error);
      next(error);
    }
  }
}

module.exports = new UserController();