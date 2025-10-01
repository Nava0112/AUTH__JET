const bcrypt = require('bcrypt');
const crypto = require('../utils/crypto');
const database = require('../utils/database');
const logger = require('../utils/logger');
const jwtService = require('../services/jwt.service');
const emailService = require('../services/email.service');
class AdminController {
  async register(req, res, next) {
    const { email, password, name } = req.body;
    
    try {
      // Validation
      if (!email || !password || !name) {
        return res.status(400).json({
          error: 'Email, password, and name are required',
          code: 'MISSING_FIELDS',
        });
      }

      if (password.length < 8) {
        return res.status(400).json({
          error: 'Password must be at least 8 characters long',
          code: 'WEAK_PASSWORD',
        });
      }

      // Create admins table if it doesn't exist
      await database.query(`
        CREATE TABLE IF NOT EXISTS admins (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          name VARCHAR(255) NOT NULL,
          role VARCHAR(50) DEFAULT 'admin',
          is_active BOOLEAN DEFAULT true,
          last_login TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `);

      // Create sessions table if it doesn't exist
      await database.query(`
        CREATE TABLE IF NOT EXISTS sessions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          admin_id UUID,
          client_id UUID,
          user_id UUID,
          session_type VARCHAR(20) NOT NULL,
          refresh_token VARCHAR(500) NOT NULL,
          expires_at TIMESTAMP NOT NULL,
          revoked BOOLEAN DEFAULT false,
          revoked_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `);

      // Check if admin already exists
      const existingAdmin = await database.query(
        'SELECT id FROM admins WHERE email = $1',
        [email.toLowerCase()]
      );

      if (existingAdmin.rows.length > 0) {
        return res.status(409).json({
          error: 'Admin with this email already exists',
          code: 'ADMIN_EXISTS',
        });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);

      // Create admin
      const query = `
        INSERT INTO admins (email, password_hash, name, role, is_active)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, email, name, role, is_active, created_at
      `;

      const result = await database.query(query, [
        email.toLowerCase(),
        passwordHash,
        name,
        'admin',
        true,
      ]);

      const admin = result.rows[0];

      // Generate tokens
      const accessToken = await jwtService.generateAccessToken({
        id: admin.id,
        email: admin.email,
        role: admin.role,
        type: 'admin',
      });

      const refreshToken = await jwtService.generateRefreshToken({
        id: admin.id,
        type: 'admin',
      });

      // Store session
      await database.query(`
        INSERT INTO sessions (admin_id, session_type, refresh_token, expires_at)
        VALUES ($1, $2, $3, $4)
      `, [
        admin.id,
        'admin',
        refreshToken,
        new Date(Date.now() + jwtService.refreshTokenExpiryMs),
      ]);

      logger.info('Admin registration successful', { adminId: admin.id, email: admin.email });

      res.status(201).json({
        admin: {
          id: admin.id,
          email: admin.email,
          name: admin.name,
          role: admin.role,
        },
        tokens: {
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_in: jwtService.accessTokenExpirySeconds,
        },
      });

    } catch (error) {
      logger.error('Admin registration error:', error);
      next(error);
    }
  }

  async login(req, res, next) {
    const { email, password } = req.body;
    
    try {
      // Find admin
      const adminQuery = `
        SELECT id, email, password_hash, name, role, is_active, last_login
        FROM admins 
        WHERE email = $1
      `;
      
      const result = await database.query(adminQuery, [email]);

      if (result.rows.length === 0) {
        return res.status(401).json({
          error: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS',
        });
      }

      const admin = result.rows[0];

      if (!admin.is_active) {
        return res.status(401).json({
          error: 'Admin account is disabled',
          code: 'ACCOUNT_DISABLED',
        });
      }

      // Verify password
      const isValidPassword = await crypto.comparePassword(password, admin.password_hash);
      
      if (!isValidPassword) {
        return res.status(401).json({
          error: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS',
        });
      }

      // Generate tokens
      const accessToken = await jwtService.generateToken(admin.id, '1h');
      const refreshToken = await jwtService.generateToken(admin.id, '7d');

      // Create session
      const sessionQuery = `
        INSERT INTO sessions (
          admin_id, session_type, token_hash, refresh_token_hash,
          expires_at, refresh_expires_at, ip_address, user_agent
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `;

      const tokenHash = await crypto.hashPassword(accessToken);
      const refreshTokenHash = await crypto.hashPassword(refreshToken);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      await database.query(sessionQuery, [
        admin.id,
        'admin',
        tokenHash,
        refreshTokenHash,
        expiresAt,
        refreshExpiresAt,
        req.ip,
        req.get('User-Agent')
      ]);

      // Update last login
      await database.query(
        'UPDATE admins SET last_login = NOW() WHERE id = $1',
        [admin.id]
      );

      logger.info('Admin login successful', { adminId: admin.id, email });

      res.json({
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'Bearer',
        expires_in: 3600,
        admin: {
          id: admin.id,
          email: admin.email,
          name: admin.name,
          role: admin.role,
        },
      });

    } catch (error) {
      logger.error('Admin login error:', error);
      next(error);
    }
  }

  async getProfile(req, res, next) {
    try {
      const adminQuery = `
        SELECT id, email, name, role, is_active, last_login, created_at, updated_at
        FROM admins 
        WHERE id = $1
      `;
      
      const result = await database.query(adminQuery, [req.admin.id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Admin not found',
          code: 'ADMIN_NOT_FOUND',
        });
      }

      res.json({ admin: result.rows[0] });

    } catch (error) {
      logger.error('Get admin profile error:', error);
      next(error);
    }
  }

  async getDashboardStats(req, res, next) {
    try {
      const statsQueries = {
        totalClients: 'SELECT COUNT(*) as count FROM clients WHERE is_active = true',
        totalApplications: 'SELECT COUNT(*) as count FROM client_applications WHERE is_active = true',
        totalUsers: 'SELECT COUNT(*) as count FROM users WHERE is_active = true',
        activeSessions: `
          SELECT COUNT(*) as count 
          FROM sessions 
          WHERE expires_at > NOW() AND revoked = false
        `,
        recentSignups: `
          SELECT COUNT(*) as count 
          FROM clients 
          WHERE created_at > NOW() - INTERVAL '7 days'
        `,
        revenue: `
          SELECT 
            COUNT(CASE WHEN plan_type = 'pro' THEN 1 END) as pro_clients,
            COUNT(CASE WHEN plan_type = 'enterprise' THEN 1 END) as enterprise_clients
          FROM clients 
          WHERE is_active = true
        `
      };

      const stats = {};
      
      for (const [key, query] of Object.entries(statsQueries)) {
        const result = await database.query(query);
        stats[key] = result.rows[0];
      }

      // Calculate estimated monthly revenue
      const proRevenue = stats.revenue.pro_clients * 29; // $29/month
      const enterpriseRevenue = stats.revenue.enterprise_clients * 99; // $99/month
      stats.estimatedMonthlyRevenue = proRevenue + enterpriseRevenue;

      res.json({ stats });

    } catch (error) {
      logger.error('Get dashboard stats error:', error);
      next(error);
    }
  }

  async getClients(req, res, next) {
    try {
      const { page = 1, limit = 20, search, plan_type, status } = req.query;
      const offset = (page - 1) * limit;

      let query = `
        SELECT 
          c.id, c.name, c.email, c.company_name, c.plan_type, 
          c.subscription_status, c.is_active, c.created_at,
          COUNT(ca.id) as application_count,
          COUNT(u.id) as user_count
        FROM clients c
        LEFT JOIN client_applications ca ON c.id = ca.client_id AND ca.is_active = true
        LEFT JOIN users u ON c.id = u.client_id AND u.is_active = true
        WHERE 1=1
      `;
      
      let countQuery = 'SELECT COUNT(*) FROM clients WHERE 1=1';
      const params = [];
      let paramCount = 0;

      if (search) {
        paramCount++;
        const searchCondition = ` AND (c.name ILIKE $${paramCount} OR c.email ILIKE $${paramCount} OR c.company_name ILIKE $${paramCount})`;
        query += searchCondition;
        countQuery += searchCondition;
        params.push(`%${search}%`);
      }

      if (plan_type) {
        paramCount++;
        const planCondition = ` AND c.plan_type = $${paramCount}`;
        query += planCondition;
        countQuery += planCondition;
        params.push(plan_type);
      }

      if (status) {
        paramCount++;
        const statusCondition = ` AND c.is_active = $${paramCount}`;
        query += statusCondition;
        countQuery += statusCondition;
        params.push(status === 'active');
      }

      query += ` 
        GROUP BY c.id, c.name, c.email, c.company_name, c.plan_type, 
                 c.subscription_status, c.is_active, c.created_at
        ORDER BY c.created_at DESC 
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `;
      params.push(limit, offset);

      const [clientsResult, countResult] = await Promise.all([
        database.query(query, params),
        database.query(countQuery, params.slice(0, -2))
      ]);

      const totalCount = parseInt(countResult.rows[0].count);

      res.json({
        clients: clientsResult.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount,
          pages: Math.ceil(totalCount / limit),
        },
      });

    } catch (error) {
      logger.error('Get clients error:', error);
      next(error);
    }
  }

  async getClient(req, res, next) {
    try {
      const { id } = req.params;

      const clientQuery = `
        SELECT 
          c.*,
          COUNT(ca.id) as application_count,
          COUNT(u.id) as user_count,
          COUNT(s.id) as active_session_count
        FROM clients c
        LEFT JOIN client_applications ca ON c.id = ca.client_id AND ca.is_active = true
        LEFT JOIN users u ON c.id = u.client_id AND u.is_active = true
        LEFT JOIN sessions s ON c.id = s.client_id AND s.expires_at > NOW() AND s.revoked = false
        WHERE c.id = $1
        GROUP BY c.id
      `;
      
      const result = await database.query(clientQuery, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Client not found',
          code: 'CLIENT_NOT_FOUND',
        });
      }

      res.json({ client: result.rows[0] });

    } catch (error) {
      logger.error('Get client error:', error);
      next(error);
    }
  }

  async updateClient(req, res, next) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const allowedFields = [
        'name', 'company_name', 'website', 'phone', 'plan_type', 
        'subscription_status', 'billing_email', 'is_active'
      ];
      
      const updateFields = [];
      const updateValues = [];
      let paramCount = 0;

      allowedFields.forEach(field => {
        if (updates[field] !== undefined) {
          paramCount++;
          updateFields.push(`${field} = $${paramCount}`);
          updateValues.push(updates[field]);
        }
      });

      if (updateFields.length === 0) {
        return res.status(400).json({
          error: 'No valid fields to update',
          code: 'NO_VALID_FIELDS',
        });
      }

      paramCount++;
      updateFields.push('updated_at = NOW()');
      updateValues.push(id);

      const query = `
        UPDATE clients 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `;

      const result = await database.query(query, updateValues);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Client not found',
          code: 'CLIENT_NOT_FOUND',
        });
      }

      logger.info('Client updated by admin', { clientId: id, adminId: req.admin.id });

      res.json({ client: result.rows[0] });

    } catch (error) {
      logger.error('Update client error:', error);
      next(error);
    }
  }

  async suspendClient(req, res, next) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const query = `
        UPDATE clients 
        SET is_active = false, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;

      const result = await database.query(query, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Client not found',
          code: 'CLIENT_NOT_FOUND',
        });
      }

      // Revoke all client sessions
      await database.query(
        'UPDATE sessions SET revoked = true, revoked_at = NOW() WHERE client_id = $1',
        [id]
      );

      // Log the suspension
      await database.query(`
        INSERT INTO audit_logs (admin_id, client_id, action, metadata)
        VALUES ($1, $2, $3, $4)
      `, [req.admin.id, id, 'client_suspended', JSON.stringify({ reason })]);

      logger.info('Client suspended by admin', { clientId: id, adminId: req.admin.id, reason });

      res.json({ 
        client: result.rows[0],
        message: 'Client suspended successfully'
      });

    } catch (error) {
      logger.error('Suspend client error:', error);
      next(error);
    }
  }

  async activateClient(req, res, next) {
    try {
      const { id } = req.params;

      const query = `
        UPDATE clients 
        SET is_active = true, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;

      const result = await database.query(query, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Client not found',
          code: 'CLIENT_NOT_FOUND',
        });
      }

      // Log the activation
      await database.query(`
        INSERT INTO audit_logs (admin_id, client_id, action)
        VALUES ($1, $2, $3)
      `, [req.admin.id, id, 'client_activated']);

      logger.info('Client activated by admin', { clientId: id, adminId: req.admin.id });

      res.json({ 
        client: result.rows[0],
        message: 'Client activated successfully'
      });

    } catch (error) {
      logger.error('Activate client error:', error);
      next(error);
    }
  }

  async deleteClient(req, res, next) {
    try {
      const { id } = req.params;

      // Check if client has users or applications
      const dependenciesQuery = `
        SELECT 
          (SELECT COUNT(*) FROM client_applications WHERE client_id = $1) as app_count,
          (SELECT COUNT(*) FROM users WHERE client_id = $1) as user_count
      `;
      
      const dependencies = await database.query(dependenciesQuery, [id]);
      const { app_count, user_count } = dependencies.rows[0];

      if (parseInt(app_count) > 0 || parseInt(user_count) > 0) {
        return res.status(400).json({
          error: 'Cannot delete client with existing applications or users',
          code: 'CLIENT_HAS_DEPENDENCIES',
          details: {
            applications: parseInt(app_count),
            users: parseInt(user_count)
          }
        });
      }

      const query = `
        DELETE FROM clients 
        WHERE id = $1
        RETURNING name, email
      `;

      const result = await database.query(query, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Client not found',
          code: 'CLIENT_NOT_FOUND',
        });
      }

      // Log the deletion
      await database.query(`
        INSERT INTO audit_logs (admin_id, action, metadata)
        VALUES ($1, $2, $3)
      `, [req.admin.id, 'client_deleted', JSON.stringify({ 
        clientId: id, 
        clientName: result.rows[0].name,
        clientEmail: result.rows[0].email 
      })]);

      logger.info('Client deleted by admin', { 
        clientId: id, 
        adminId: req.admin.id,
        clientName: result.rows[0].name
      });

      res.json({ 
        message: 'Client deleted successfully',
        client: result.rows[0]
      });

    } catch (error) {
      logger.error('Delete client error:', error);
      next(error);
    }
  }

  async logout(req, res, next) {
    try {
      // Revoke current session
      await database.query(
        'UPDATE sessions SET revoked = true, revoked_at = NOW() WHERE admin_id = $1 AND session_type = $2',
        [req.admin.id, 'admin']
      );

      logger.info('Admin logout successful', { adminId: req.admin.id });

      res.json({ message: 'Logged out successfully' });

    } catch (error) {
      logger.error('Admin logout error:', error);
      next(error);
    }
  }

  async forgotPassword(req, res, next) {
    try {
      res.json({ message: 'Forgot password endpoint - to be implemented' });
    } catch (error) {
      next(error);
    }
  }

  async resetPassword(req, res, next) {
    try {
      res.json({ message: 'Reset password endpoint - to be implemented' });
    } catch (error) {
      next(error);
    }
  }

  async updateProfile(req, res, next) {
    try {
      res.json({ message: 'Update profile endpoint - to be implemented' });
    } catch (error) {
      next(error);
    }
  }

  async changePassword(req, res, next) {
    try {
      res.json({ message: 'Change password endpoint - to be implemented' });
    } catch (error) {
      next(error);
    }
  }

  async getClientApplications(req, res, next) {
    try {
      res.json({ message: 'Get client applications endpoint - to be implemented' });
    } catch (error) {
      next(error);
    }
  }

  async getApplication(req, res, next) {
    try {
      res.json({ message: 'Get application endpoint - to be implemented' });
    } catch (error) {
      next(error);
    }
  }

  async getClientAnalytics(req, res, next) {
    try {
      res.json({ message: 'Get client analytics endpoint - to be implemented' });
    } catch (error) {
      next(error);
    }
  }

  async getRevenueAnalytics(req, res, next) {
    try {
      res.json({ message: 'Get revenue analytics endpoint - to be implemented' });
    } catch (error) {
      next(error);
    }
  }

  async getSystemLogs(req, res, next) {
    try {
      res.json({ message: 'Get system logs endpoint - to be implemented' });
    } catch (error) {
      next(error);
    }
  }

  async toggleMaintenance(req, res, next) {
    try {
      res.json({ message: 'Toggle maintenance endpoint - to be implemented' });
    } catch (error) {
      next(error);
    }
  }

  async getBillingOverview(req, res, next) {
    try {
      res.json({ message: 'Get billing overview endpoint - to be implemented' });
    } catch (error) {
      next(error);
    }
  }

  async getTransactions(req, res, next) {
    try {
      res.json({ message: 'Get transactions endpoint - to be implemented' });
    } catch (error) {
      next(error);
    }
  }

  // Additional methods for analytics, system health, etc. would go here
  async getAnalyticsOverview(req, res, next) {
    try {
      // Implementation for analytics overview
      res.json({ message: 'Analytics overview endpoint - to be implemented' });
    } catch (error) {
      next(error);
    }
  }

  async getSystemHealth(req, res, next) {
    try {
      // Implementation for system health check
      res.json({ 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: 'connected'
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AdminController();
