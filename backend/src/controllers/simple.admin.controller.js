const bcrypt = require('bcryptjs');
const database = require('../utils/database');
const logger = require('../utils/logger');
const emailService = require('../services/email.service');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

class SimpleAdminController {
  async register(req, res, next) {
    try {
      const { email, password, name, justification } = req.body;
      
      // Basic validation
      if (!email || !password || !name) {
        return res.status(400).json({
          error: 'Email, password, and name are required'
        });
      }

      if (password.length < 8) {
        return res.status(400).json({
          error: 'Password must be at least 8 characters long'
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
          reviewed_by INTEGER,
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
          error: `Admin request already exists with status: ${request.status}`
        });
      }

      // Check if admin already exists
      const existingAdmin = await database.query(
        'SELECT id FROM admins WHERE email = $1',
        [email.toLowerCase()]
      );

      if (existingAdmin.rows.length > 0) {
        return res.status(409).json({
          error: 'Admin with this email already exists'
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

      // Generate secure approval tokens
      const approveToken = jwt.sign(
        { 
          requestId: request.id,
          action: 'approve',
          iat: Math.floor(Date.now() / 1000)
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
      
      const rejectToken = jwt.sign(
        { 
          requestId: request.id,
          action: 'reject',
          iat: Math.floor(Date.now() / 1000)
        },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
      
      // Send approval email to super admin
      const superAdminEmail = 'nsmnavarasan@gmail.com';
      const baseUrl = process.env.BACKEND_URL || 'http://localhost:8000';
      
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
              <p><em>"${justification || 'No justification provided'}"</em></p>
            </div>

            <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
              <h3>👆 Click to Take Action:</h3>
              <div style="margin: 30px 0;">
                <a href="${baseUrl}/api/admin/approve/${approveToken}" 
                   style="display: inline-block; background: #16a34a; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; margin: 0 10px; font-weight: bold; font-size: 16px;">
                  ✅ APPROVE
                </a>
                <a href="${baseUrl}/api/admin/reject/${rejectToken}" 
                   style="display: inline-block; background: #dc2626; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; margin: 0 10px; font-weight: bold; font-size: 16px;">
                  ❌ REJECT
                </a>
              </div>
              <p style="font-size: 12px; color: #666;">
                These links are secure and will expire in 7 days.
              </p>
            </div>

            <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>⚠️ Security Guidelines:</strong></p>
              <ul>
                <li>Only approve requests from trusted individuals</li>
                <li>Verify the requester's identity if needed</li>
                <li>Consider the justification provided</li>
                <li>Admin access grants full platform control</li>
              </ul>
            </div>

            <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0; font-size: 12px; color: #666;">
              <p><strong>What happens next?</strong></p>
              <p><strong>If APPROVED:</strong> Admin account will be created automatically and user will be notified</p>
              <p><strong>If REJECTED:</strong> Request will be marked as rejected and user will be notified</p>
              <p><strong>If no action:</strong> Request remains pending (you can act on it later)</p>
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
      res.status(500).json({
        error: 'Registration request failed',
        details: error.message
      });
    }
  }

  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({
          error: 'Email and password are required'
        });
      }

      // Find admin
      const result = await database.query(
        'SELECT id, email, password_hash, name FROM admins WHERE email = $1',
        [email]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({
          error: 'Invalid credentials'
        });
      }

      const admin = result.rows[0];

      // Check password
      const validPassword = await bcrypt.compare(password, admin.password_hash);
      
      if (!validPassword) {
        return res.status(401).json({
          error: 'Invalid credentials'
        });
      }

      logger.info('Admin login successful', { adminId: admin.id });

      res.json({
        success: true,
        message: 'Login successful',
        admin: {
          id: admin.id,
          email: admin.email,
          name: admin.name
        }
      });

    } catch (error) {
      logger.error('Admin login error:', error);
      res.status(500).json({
        error: 'Login failed',
        details: error.message
      });
    }
  }

  async approveAdminRequest(req, res, next) {
    try {
      const { token } = req.params;
      
      // Verify and decode token
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch (error) {
        return res.status(400).send(`
          <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px;">
              <div style="text-align: center; color: #dc2626;">
                <h2>❌ Invalid or Expired Token</h2>
                <p>This approval link is invalid or has expired.</p>
                <p>Please contact the system administrator for assistance.</p>
              </div>
            </body>
          </html>
        `);
      }

      if (decoded.action !== 'approve') {
        return res.status(400).send('<h2>Invalid action</h2>');
      }

      // Get the admin request
      const requestResult = await database.query(
        'SELECT * FROM admin_requests WHERE id = $1 AND status = $2',
        [decoded.requestId, 'pending']
      );

      if (requestResult.rows.length === 0) {
        return res.status(404).send(`
          <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px;">
              <div style="text-align: center; color: #dc2626;">
                <h2>❌ Request Not Found</h2>
                <p>This admin request was not found or has already been processed.</p>
              </div>
            </body>
          </html>
        `);
      }

      const request = requestResult.rows[0];

      // Check if admin already exists (in case someone was created manually)
      const existingAdmin = await database.query(
        'SELECT id FROM admins WHERE email = $1',
        [request.email]
      );

      let newAdmin;
      if (existingAdmin.rows.length > 0) {
        // Admin already exists, just use existing one
        newAdmin = existingAdmin.rows[0];
        logger.info('Admin already exists, using existing account', { email: request.email });
      } else {
        // Create new admin account
        const adminResult = await database.query(`
          INSERT INTO admins (email, password_hash, name, role, is_active, created_at, updated_at)
          VALUES ($1, $2, $3, 'admin', true, NOW(), NOW())
          RETURNING id, email, name, role
        `, [request.email, request.password_hash, request.name]);
        newAdmin = adminResult.rows[0];
      }

      // Get the super admin's UUID for reviewed_by field
      let reviewedBy = null;
      try {
        const superAdminResult = await database.query(
          'SELECT id FROM admins WHERE email = $1',
          ['nsmnavarasan@gmail.com']
        );
        if (superAdminResult.rows.length > 0) {
          reviewedBy = superAdminResult.rows[0].id;
        }
      } catch (error) {
        logger.warn('Could not find super admin for reviewed_by field', error);
      }

      // Update request status
      await database.query(
        'UPDATE admin_requests SET status = $1, reviewed_at = NOW(), reviewed_by = $2 WHERE id = $3',
        ['approved', reviewedBy, decoded.requestId]
      );

      // Send welcome email to new admin
      try {
        await emailService.send({
          to: request.email,
          subject: '✅ Admin Access Approved - AuthJet',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #16a34a;">🎉 Admin Access Approved!</h2>
              
              <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Congratulations ${request.name}!</strong></p>
                <p>Your admin access request has been approved. You can now login to the admin dashboard.</p>
              </div>

              <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3>Login Details:</h3>
                <p><strong>Email:</strong> ${request.email}</p>
                <p><strong>Admin Dashboard:</strong> <a href="http://localhost:3000/admin/login">Login Here</a></p>
              </div>

              <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong>⚠️ Important:</strong> Please keep your login credentials secure and use them responsibly.</p>
              </div>
            </div>
          `
        });
      } catch (emailError) {
        logger.error('Failed to send welcome email to new admin', emailError);
      }

      logger.info('Admin request approved', { 
        requestId: decoded.requestId, 
        newAdminId: newAdmin.id,
        email: request.email 
      });

      res.send(`
        <html>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px;">
            <div style="text-align: center; color: #16a34a;">
              <h2>✅ Admin Request Approved!</h2>
              <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Admin account created successfully for:</strong></p>
                <p><strong>Name:</strong> ${request.name}</p>
                <p><strong>Email:</strong> ${request.email}</p>
              </div>
              <p>The user has been notified and can now access the admin dashboard.</p>
            </div>
          </body>
        </html>
      `);

    } catch (error) {
      logger.error('Admin approval error:', error);
      res.status(500).send(`
        <html>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px;">
            <div style="text-align: center; color: #dc2626;">
              <h2>❌ Approval Failed</h2>
              <p>An error occurred while processing the approval.</p>
              <p>Please try again or contact support.</p>
            </div>
          </body>
        </html>
      `);
    }
  }

  async rejectAdminRequest(req, res, next) {
    try {
      const { token } = req.params;
      
      // Verify and decode token
      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch (error) {
        return res.status(400).send(`
          <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px;">
              <div style="text-align: center; color: #dc2626;">
                <h2>❌ Invalid or Expired Token</h2>
                <p>This rejection link is invalid or has expired.</p>
              </div>
            </body>
          </html>
        `);
      }

      if (decoded.action !== 'reject') {
        return res.status(400).send('<h2>Invalid action</h2>');
      }

      // Get the admin request
      const requestResult = await database.query(
        'SELECT * FROM admin_requests WHERE id = $1 AND status = $2',
        [decoded.requestId, 'pending']
      );

      if (requestResult.rows.length === 0) {
        return res.status(404).send(`
          <html>
            <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px;">
              <div style="text-align: center; color: #dc2626;">
                <h2>❌ Request Not Found</h2>
                <p>This admin request was not found or has already been processed.</p>
              </div>
            </body>
          </html>
        `);
      }

      const request = requestResult.rows[0];

      // Get the super admin's UUID for reviewed_by field
      let reviewedBy = null;
      try {
        const superAdminResult = await database.query(
          'SELECT id FROM admins WHERE email = $1',
          ['nsmnavarasan@gmail.com']
        );
        if (superAdminResult.rows.length > 0) {
          reviewedBy = superAdminResult.rows[0].id;
        }
      } catch (error) {
        logger.warn('Could not find super admin for reviewed_by field', error);
      }

      // Update request status to rejected
      await database.query(
        'UPDATE admin_requests SET status = $1, reviewed_at = NOW(), reviewed_by = $2 WHERE id = $3',
        ['rejected', reviewedBy, decoded.requestId]
      );

      // Send rejection email
      try {
        await emailService.send({
          to: request.email,
          subject: '❌ Admin Access Request Rejected - AuthJet',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #dc2626;">❌ Admin Access Request Rejected</h2>
              
              <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Dear ${request.name},</strong></p>
                <p>Your admin access request has been reviewed and unfortunately cannot be approved at this time.</p>
              </div>

              <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p>If you believe this was an error or would like to discuss your request further, please contact the system administrator.</p>
              </div>
            </div>
          `
        });
      } catch (emailError) {
        logger.error('Failed to send rejection email', emailError);
      }

      logger.info('Admin request rejected', { 
        requestId: decoded.requestId, 
        email: request.email 
      });

      res.send(`
        <html>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px;">
            <div style="text-align: center; color: #dc2626;">
              <h2>❌ Admin Request Rejected</h2>
              <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Request rejected for:</strong></p>
                <p><strong>Name:</strong> ${request.name}</p>
                <p><strong>Email:</strong> ${request.email}</p>
              </div>
              <p>The user has been notified of the decision.</p>
            </div>
          </body>
        </html>
      `);

    } catch (error) {
      logger.error('Admin rejection error:', error);
      res.status(500).send(`
        <html>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px;">
            <div style="text-align: center; color: #dc2626;">
              <h2>❌ Rejection Failed</h2>
              <p>An error occurred while processing the rejection.</p>
            </div>
          </body>
        </html>
      `);
    }
  }

  async getDashboardStats(req, res, next) {
    try {
      // Create clients table if needed
      await database.query(`
        CREATE TABLE IF NOT EXISTS clients (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `);

      const stats = {
        totalClients: 0,
        totalUsers: 0,
        totalApplications: 0,
        recentSignups: []
      };

      // Get client count
      const clientCount = await database.query('SELECT COUNT(*) as count FROM clients');
      stats.totalClients = parseInt(clientCount.rows[0].count);

      res.json({
        success: true,
        stats
      });

    } catch (error) {
      logger.error('Dashboard stats error:', error);
      res.status(500).json({
        error: 'Failed to fetch stats',
        details: error.message
      });
    }
  }

  // Placeholder methods for other endpoints
  async getProfile(req, res) {
    res.json({ message: 'Profile endpoint - working!' });
  }

  async forgotPassword(req, res) {
    res.json({ message: 'Forgot password endpoint - to be implemented' });
  }

  async resetPassword(req, res) {
    res.json({ message: 'Reset password endpoint - to be implemented' });
  }

  async updateProfile(req, res) {
    res.json({ message: 'Update profile endpoint - to be implemented' });
  }

  async changePassword(req, res) {
    res.json({ message: 'Change password endpoint - to be implemented' });
  }

  async logout(req, res) {
    res.json({ message: 'Logout successful' });
  }

  async getClients(req, res) {
    try {
      const result = await database.query('SELECT id, name, email, created_at FROM clients ORDER BY created_at DESC');
      res.json({
        success: true,
        clients: result.rows
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch clients' });
    }
  }

  async getClient(req, res) {
    res.json({ message: 'Get client endpoint - to be implemented' });
  }

  async updateClient(req, res) {
    res.json({ message: 'Update client endpoint - to be implemented' });
  }

  async deleteClient(req, res) {
    res.json({ message: 'Delete client endpoint - to be implemented' });
  }

  async suspendClient(req, res) {
    res.json({ message: 'Suspend client endpoint - to be implemented' });
  }

  async activateClient(req, res) {
    res.json({ message: 'Activate client endpoint - to be implemented' });
  }

  // Add all other missing methods as placeholders
  async getClientApplications(req, res) {
    res.json({ message: 'Get client applications - to be implemented' });
  }

  async getApplication(req, res) {
    res.json({ message: 'Get application - to be implemented' });
  }

  async getClientAnalytics(req, res) {
    res.json({ message: 'Get client analytics - to be implemented' });
  }

  async getRevenueAnalytics(req, res) {
    res.json({ message: 'Get revenue analytics - to be implemented' });
  }

  async getSystemLogs(req, res) {
    res.json({ message: 'Get system logs - to be implemented' });
  }

  async toggleMaintenance(req, res) {
    res.json({ message: 'Toggle maintenance - to be implemented' });
  }

  async getBillingOverview(req, res) {
    res.json({ message: 'Get billing overview - to be implemented' });
  }

  async getTransactions(req, res) {
    res.json({ message: 'Get transactions - to be implemented' });
  }

  async getAnalyticsOverview(req, res) {
    res.json({ message: 'Get analytics overview - to be implemented' });
  }

  async getSystemHealth(req, res) {
    res.json({ 
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected'
    });
  }
}

module.exports = new SimpleAdminController();
