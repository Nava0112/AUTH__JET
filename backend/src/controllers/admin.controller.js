const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('../utils/crypto');
const database = require('../utils/database');
const logger = require('../utils/logger');
const jwtService = require('../services/jwt.service');
const emailService = require('../services/email.service');
class AdminController {
  async register(req, res, next) {
    const { email, password, name, justification } = req.body;
    
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

      // Create admin_requests table if it doesn't exist
      await database.query(`
        CREATE TABLE IF NOT EXISTS admin_requests (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          name VARCHAR(255) NOT NULL,
          justification TEXT,
          status VARCHAR(20) DEFAULT 'pending',
          requested_at TIMESTAMP DEFAULT NOW(),
          reviewed_at TIMESTAMP,
          reviewed_by UUID,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
      `);

      // Check if request already exists
      const existingRequest = await database.query(
        'SELECT id, status FROM admin_requests WHERE email = $1',
        [email.toLowerCase()]
      );

      if (existingRequest.rows.length > 0) {
        const request = existingRequest.rows[0];
        return res.status(409).json({
          error: `Admin request already exists with status: ${request.status}`,
          code: 'REQUEST_EXISTS',
        });
      }

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

      // Hash password for storage
      const passwordHash = await bcrypt.hash(password, 12);

      // Create admin request
      const query = `
        INSERT INTO admin_requests (email, password_hash, name, justification)
        VALUES ($1, $2, $3, $4)
        RETURNING id, email, name, requested_at
      `;

      const result = await database.query(query, [
        email.toLowerCase(),
        passwordHash,
        name,
        justification || 'No justification provided'
      ]);

      const request = result.rows[0];

      // Send approval email to super admin
      const superAdminEmail = 'nsmnavarasan@gmail.com';
      const emailContent = {
        to: superAdminEmail,
        subject: 'New Admin Registration Request - AuthJet',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #dc2626;">🔐 New Admin Registration Request</h2>
            
            <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3>Request Details:</h3>
              <p><strong>Name:</strong> ${name}</p>
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Requested At:</strong> ${new Date(request.requested_at).toLocaleString()}</p>
              <p><strong>Request ID:</strong> ${request.id}</p>
            </div>

            <div style="background: #fff7ed; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h4>Justification:</h4>
              <p>${justification || 'No justification provided'}</p>
            </div>

            <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h4>Actions Required:</h4>
              <p>To approve or reject this request, please:</p>
              <ol>
                <li>Log in to your admin dashboard</li>
                <li>Review the request details carefully</li>
                <li>Verify the requester's identity and legitimacy</li>
                <li>Use the admin approval system to approve/reject</li>
              </ol>
            </div>

            <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>⚠️ Security Note:</strong> Only approve admin requests for trusted individuals who require platform administration access.</p>
            </div>
          </div>
        `
      };

      try {
        await emailService.send(emailContent);
        logger.info('Admin approval email sent', { 
          requestId: request.id, 
          requesterEmail: email,
          superAdminEmail: superAdminEmail
        });
      } catch (emailError) {
        logger.error('Failed to send admin approval email', { 
          error: emailError.message,
          requestId: request.id
        });
        // Don't fail the request if email fails, just log it
      }

      logger.info('Admin registration request created', { 
        requestId: request.id, 
        email: request.email 
      });

      res.status(201).json({
        success: true,
        message: 'Admin registration request submitted successfully',
        request: {
          id: request.id,
          email: request.email,
          name: request.name,
          status: 'pending',
          requested_at: request.requested_at
        },
        note: 'Your request has been sent to the system administrator for approval. You will be notified once your request is reviewed.'
      });

    } catch (error) {
      logger.error('Admin registration request error:', error);
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
          error: 'Invalid login. Only existing admins can login.',
          code: 'ADMIN_NOT_FOUND',
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
      const accessToken = jwt.sign(
        {
          sub: admin.id,
          email: admin.email,
          name: admin.name,
          type: 'admin',
          provider: 'email',
          iat: Math.floor(Date.now() / 1000)
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );
      
      const refreshToken = jwt.sign(
        {
          sub: admin.id,
          type: 'admin_refresh',
          iat: Math.floor(Date.now() / 1000)
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

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

      logger.info('Admin login successful', { adminId: admin.id, email, provider: 'email' });

      res.json({
        success: true,
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: 'Bearer',
        expires_in: 86400, // 24 hours
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
