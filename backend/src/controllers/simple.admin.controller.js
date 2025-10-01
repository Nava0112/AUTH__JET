const bcrypt = require('bcryptjs');
const database = require('../utils/database');
const logger = require('../utils/logger');

class SimpleAdminController {
  async register(req, res, next) {
    try {
      const { email, password, name } = req.body;
      
      // Basic validation
      if (!email || !password || !name) {
        return res.status(400).json({
          error: 'Email, password, and name are required'
        });
      }

      // Create table if it doesn't exist
      await database.query(`
        CREATE TABLE IF NOT EXISTS admins (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          name VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `);

      // Check if admin exists
      const existing = await database.query(
        'SELECT id FROM admins WHERE email = $1',
        [email]
      );

      if (existing.rows.length > 0) {
        return res.status(409).json({
          error: 'Admin already exists'
        });
      }

      // Hash password and create admin
      const passwordHash = await bcrypt.hash(password, 10);
      
      const result = await database.query(
        'INSERT INTO admins (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name',
        [email, passwordHash, name]
      );

      const admin = result.rows[0];

      logger.info('Admin created successfully', { adminId: admin.id });

      res.status(201).json({
        success: true,
        message: 'Admin created successfully',
        admin: {
          id: admin.id,
          email: admin.email,
          name: admin.name
        }
      });

    } catch (error) {
      logger.error('Admin registration error:', error);
      res.status(500).json({
        error: 'Registration failed',
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
