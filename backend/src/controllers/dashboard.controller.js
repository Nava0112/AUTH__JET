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

      // Get applications by auth mode
      const authModesResult = await database.query(`
        SELECT auth_mode, COUNT(*) as count
        FROM client_applications 
        WHERE is_active = true
        GROUP BY auth_mode
      `);

      // Get recent applications (last 7 days)
      const recentAppsResult = await database.query(`
        SELECT COUNT(*) as recent_applications
        FROM client_applications 
        WHERE is_active = true 
        AND created_at >= NOW() - INTERVAL '7 days'
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
        authModes: authModesResult.rows.reduce((acc, row) => {
          acc[row.auth_mode] = parseInt(row.count);
          return acc;
        }, {}),
        recentApplications: parseInt(recentAppsResult.rows[0].recent_applications),
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
      const clientId = 1;

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
          ca.auth_mode,
          ca.created_at,
          COUNT(u.id) as user_count
        FROM client_applications ca
        LEFT JOIN users u ON ca.id = u.application_id AND u.is_active = true
        WHERE ca.client_id = $1 AND ca.is_active = true
        GROUP BY ca.id, ca.name, ca.auth_mode, ca.created_at
        ORDER BY ca.created_at DESC
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

      // Get auth mode breakdown
      const authModesResult = await database.query(`
        SELECT auth_mode, COUNT(*) as count
        FROM client_applications 
        WHERE client_id = $1 AND is_active = true
        GROUP BY auth_mode
      `, [clientId]);

      const stats = {
        clientApplications: parseInt(appsResult.rows[0].client_applications),
        totalUsers: parseInt(usersResult.rows[0].total_users),
        recentUsers: parseInt(recentUsersResult.rows[0].recent_users),
        authModes: authModesResult.rows.reduce((acc, row) => {
          acc[row.auth_mode] = parseInt(row.count);
          return acc;
        }, {}),
        applications: appsWithUsersResult.rows.map(app => ({
          id: app.id,
          name: app.name,
          authMode: app.auth_mode,
          userCount: parseInt(app.user_count),
          createdAt: app.created_at
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
      const clientId = 1; // Should come from auth middleware

      // Get applications with detailed user statistics
      const result = await database.query(`
        SELECT 
          ca.id,
          ca.name,
          ca.description,
          ca.auth_mode,
          ca.main_page_url,
          ca.created_at,
          COUNT(u.id) as total_users,
          COUNT(CASE WHEN u.created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as recent_users,
          COUNT(CASE WHEN u.last_login >= NOW() - INTERVAL '7 days' THEN 1 END) as active_users,
          ca.roles_config
        FROM client_applications ca
        LEFT JOIN users u ON ca.id = u.application_id AND u.is_active = true
        WHERE ca.client_id = $1 AND ca.is_active = true
        GROUP BY ca.id, ca.name, ca.description, ca.auth_mode, ca.main_page_url, ca.created_at, ca.roles_config
        ORDER BY ca.created_at DESC
      `, [clientId]);

      const applications = result.rows.map(app => {
        let rolesConfig = [];
        try {
          rolesConfig = app.roles_config ? JSON.parse(app.roles_config) : [];
        } catch (e) {
          rolesConfig = [];
        }

        return {
          id: app.id,
          name: app.name,
          description: app.description,
          authMode: app.auth_mode,
          mainPageUrl: app.main_page_url,
          createdAt: app.created_at,
          totalUsers: parseInt(app.total_users),
          recentUsers: parseInt(app.recent_users),
          activeUsers: parseInt(app.active_users),
          rolesConfig: rolesConfig
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
