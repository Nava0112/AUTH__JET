const database = require('../utils/database');
const logger = require('../utils/logger');

class DashboardController {
  // Admin dashboard statistics
  async getAdminStats(req, res) {
    try {
      // Get total applications
      const appsResult = await database.query(`
        SELECT COUNT(*) as total_applications
        FROM client_applications 
        WHERE is_active = true
      `);

      // Get total users across all applications
      const usersResult = await database.query(`
        SELECT COUNT(*) as total_users
        FROM users 
        WHERE is_active = true
      `);

      // Get total clients
      const clientsResult = await database.query(`
        SELECT COUNT(*) as total_clients
        FROM clients 
        WHERE is_active = true
      `);

      // Get recent users (last 7 days)
      const recentUsersResult = await database.query(`
        SELECT COUNT(*) as recent_users
        FROM users 
        WHERE is_active = true 
        AND created_at >= NOW() - INTERVAL '7 days'
      `);

      const stats = {
        totalApplications: parseInt(appsResult.rows[0].total_applications),
        totalUsers: parseInt(usersResult.rows[0].total_users),
        totalClients: parseInt(clientsResult.rows[0].total_clients),
        authModes: {},
        recentApplications: 0,
        recentUsers: parseInt(recentUsersResult.rows[0].recent_users)
      };

      res.json({
        success: true,
        stats: stats
      });

    } catch (error) {
      logger.error('Admin stats error:', error);
      res.status(500).json({
        error: 'Failed to fetch admin statistics',
        details: error.message
      });
    }
  }

  // Client dashboard statistics
  async getClientStats(req, res) {
    try {
      // For now, using clientId = 1 (should come from auth middleware)
      const clientId = req.client?.id;
      if (!clientId) {
        return res.status(401).json({
          error: 'Client authentication required',
          code: 'CLIENT_AUTH_REQUIRED',
        });
      }

      // Get client's applications count
      const appsResult = await database.query(`
        SELECT COUNT(*) as client_applications
        FROM client_applications 
        WHERE client_id = $1 AND is_active = true
      `, [clientId]);

      // Get total users across client's applications
      const usersResult = await database.query(`
        SELECT COUNT(*) as total_users
        FROM users u
        JOIN client_applications ca ON u.application_id = ca.id
        WHERE ca.client_id = $1 AND u.is_active = true AND ca.is_active = true
      `, [clientId]);

      // Get applications with user counts
      const appsWithUsersResult = await database.query(`
        SELECT 
          ca.id,
          ca.name,
          ca.redirect_url,
          COUNT(u.id) as user_count
        FROM client_applications ca
        LEFT JOIN users u ON ca.id = u.application_id AND u.is_active = true
        WHERE ca.client_id = $1 AND ca.is_active = true
        GROUP BY ca.id, ca.name, ca.redirect_url
        ORDER BY ca.id DESC
      `, [clientId]);

      // Get recent users (last 7 days)
      const recentUsersResult = await database.query(`
        SELECT COUNT(*) as recent_users
        FROM users u
        JOIN client_applications ca ON u.application_id = ca.id
        WHERE ca.client_id = $1 
        AND u.is_active = true 
        AND ca.is_active = true
        AND u.created_at >= NOW() - INTERVAL '7 days'
      `, [clientId]);

      const stats = {
        clientApplications: parseInt(appsResult.rows[0].client_applications),
        totalUsers: parseInt(usersResult.rows[0].total_users),
        recentUsers: parseInt(recentUsersResult.rows[0].recent_users),
        applications: appsWithUsersResult.rows.map(app => ({
          id: app.id,
          name: app.name,
          redirectUrl: app.redirect_url,
          userCount: parseInt(app.user_count),
        }))
      };

      res.json({
        success: true,
        stats: stats
      });

    } catch (error) {
      logger.error('Client stats error:', error);
      res.status(500).json({
        error: 'Failed to fetch client statistics',
        details: error.message
      });
    }
  }

  // Get detailed application statistics
  async getApplicationStats(req, res) {
    try {
      const clientId = req.client?.id;
      if (!clientId) {
        return res.status(401).json({
          error: 'Client authentication required',
          code: 'CLIENT_AUTH_REQUIRED',
        });
      } // Should come from auth middleware

      // Get applications with detailed user statistics
      const result = await database.query(`
        SELECT 
          ca.id,
          ca.name,
          ca.description,
          ca.redirect_url,
          COUNT(u.id) as total_users,
          COUNT(CASE WHEN u.created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as recent_users,
          COUNT(CASE WHEN u.last_login >= NOW() - INTERVAL '7 days' THEN 1 END) as active_users
        FROM client_applications ca
        LEFT JOIN users u ON ca.id = u.application_id AND u.is_active = true
        WHERE ca.client_id = $1 AND ca.is_active = true
        GROUP BY ca.id, ca.name, ca.description, ca.redirect_url
        ORDER BY ca.id DESC
      `, [clientId]);

      const applications = result.rows.map(app => {
        return {
          id: app.id,
          name: app.name,
          description: app.description,
          redirectUrl: app.redirect_url,
          totalUsers: parseInt(app.total_users),
          recentUsers: parseInt(app.recent_users),
          activeUsers: parseInt(app.active_users)
        };
      });

      // Calculate totals
      const totalUsers = applications.reduce((sum, app) => sum + app.totalUsers, 0);
      const totalRecentUsers = applications.reduce((sum, app) => sum + app.recentUsers, 0);

      res.json({
        success: true,
        summary: {
          totalApplications: applications.length,
          totalUsers: totalUsers,
          totalRecentUsers: totalRecentUsers
        },
        applications: applications
      });

    } catch (error) {
      logger.error('Application stats error:', error);
      res.status(500).json({
        error: 'Failed to fetch application statistics',
        details: error.message
      });
    }
  }
}

module.exports = new DashboardController();
