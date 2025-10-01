const database = require('../utils/database');
const logger = require('../utils/logger');

class ClientService {
  async validateClientDomain(clientId, domain) {
    try {
      const query = 'SELECT allowed_domains FROM clients WHERE id = $1';
      const result = await database.query(query, [clientId]);
      
      if (result.rows.length === 0) {
        return false;
      }

      const client = result.rows[0];
      const allowedDomains = client.allowed_domains || [];

      // If no domains are configured, allow all
      if (allowedDomains.length === 0) {
        return true;
      }

      // Check if domain is allowed
      return allowedDomains.some(allowedDomain => {
        if (allowedDomain.startsWith('*.')) {
          const baseDomain = allowedDomain.substring(2);
          return domain.endsWith('.' + baseDomain) || domain === baseDomain;
        }
        return domain === allowedDomain;
      });

    } catch (error) {
      logger.error('Domain validation error:', error);
      return false;
    }
  }

  async getClientByApiKey(apiKey) {
    try {
      const query = 'SELECT * FROM clients WHERE api_key = $1';
      const result = await database.query(query, [apiKey]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Get client by API key error:', error);
      throw error;
    }
  }

  async updateClientSettings(clientId, settings) {
    try {
      const query = `
        UPDATE clients 
        SET settings = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `;
      
      const result = await database.query(query, [JSON.stringify(settings), clientId]);
      
      if (result.rows.length === 0) {
        throw new Error('Client not found');
      }

      logger.info('Client settings updated', { clientId });
      return result.rows[0];

    } catch (error) {
      logger.error('Update client settings error:', error);
      throw error;
    }
  }

  async getClientUsage(clientId, period = '30d') {
    try {
      let interval;
      switch (period) {
        case '24h':
          interval = '1 day';
          break;
        case '7d':
          interval = '7 days';
          break;
        case '30d':
          interval = '30 days';
          break;
        default:
          interval = '30 days';
      }

      const queries = {
        totalUsers: `
          SELECT COUNT(*) as count 
          FROM client_users 
          WHERE client_id = $1 AND created_at > NOW() - INTERVAL '${interval}'
        `,
        activeUsers: `
          SELECT COUNT(DISTINCT user_id) as count
          FROM sessions 
          WHERE client_id = $1 AND created_at > NOW() - INTERVAL '${interval}'
        `,
        totalLogins: `
          SELECT COUNT(*) as count
          FROM audit_logs 
          WHERE client_id = $1 AND action = 'login' AND created_at > NOW() - INTERVAL '${interval}'
        `,
        webhookCalls: `
          SELECT COUNT(*) as count
          FROM webhook_logs 
          WHERE client_id = $1 AND created_at > NOW() - INTERVAL '${interval}'
        `,
        failedLogins: `
          SELECT COUNT(*) as count
          FROM failed_logins 
          WHERE client_id = $1 AND created_at > NOW() - INTERVAL '${interval}'
        `,
      };

      const usage = {};
      
      for (const [key, query] of Object.entries(queries)) {
        const result = await database.query(query, [clientId]);
        usage[key] = parseInt(result.rows[0].count) || 0;
      }

      return usage;

    } catch (error) {
      logger.error('Get client usage error:', error);
      throw error;
    }
  }

  async getClientPlanLimits(clientId) {
    try {
      const query = 'SELECT plan_type, settings FROM clients WHERE id = $1';
      const result = await database.query(query, [clientId]);
      
      if (result.rows.length === 0) {
        throw new Error('Client not found');
      }

      const client = result.rows[0];
      const planLimits = {
        free: {
          maxUsers: 1000,
          maxWebhooks: 1000,
          maxSessions: 10000,
          retentionDays: 30,
        },
        pro: {
          maxUsers: 10000,
          maxWebhooks: 10000,
          maxSessions: 100000,
          retentionDays: 90,
        },
        enterprise: {
          maxUsers: 100000,
          maxWebhooks: Infinity,
          maxSessions: Infinity,
          retentionDays: 365,
        },
      };

      return planLimits[client.plan_type] || planLimits.free;

    } catch (error) {
      logger.error('Get client plan limits error:', error);
      throw error;
    }
  }

  async checkClientLimit(clientId, limitType) {
    try {
      const limits = await this.getClientPlanLimits(clientId);
      const usage = await this.getClientUsage(clientId, '30d');

      const limitMap = {
        users: { usage: usage.totalUsers, limit: limits.maxUsers },
        webhooks: { usage: usage.webhookCalls, limit: limits.maxWebhooks },
        sessions: { usage: usage.totalLogins, limit: limits.maxSessions },
      };

      const limitInfo = limitMap[limitType];
      if (!limitInfo) {
        return { withinLimit: true, usage: 0, limit: Infinity };
      }

      return {
        withinLimit: limitInfo.usage < limitInfo.limit,
        usage: limitInfo.usage,
        limit: limitInfo.limit,
        remaining: Math.max(0, limitInfo.limit - limitInfo.usage),
      };

    } catch (error) {
      logger.error('Check client limit error:', error);
      throw error;
    }
  }

  async upgradeClientPlan(clientId, newPlan) {
    try {
      const validPlans = ['free', 'pro', 'enterprise'];
      if (!validPlans.includes(newPlan)) {
        throw new Error('Invalid plan type');
      }

      const query = `
        UPDATE clients 
        SET plan_type = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `;
      
      const result = await database.query(query, [newPlan, clientId]);
      
      if (result.rows.length === 0) {
        throw new Error('Client not found');
      }

      logger.info('Client plan upgraded', { clientId, newPlan });
      return result.rows[0];

    } catch (error) {
      logger.error('Upgrade client plan error:', error);
      throw error;
    }
  }

  async getClientAnalytics(clientId, period = '30d') {
    try {
      let interval;
      switch (period) {
        case '24h':
          interval = '1 day';
          break;
        case '7d':
          interval = '7 days';
          break;
        case '30d':
          interval = '30 days';
          break;
        default:
          interval = '30 days';
      }

      const analyticsQueries = {
        dailyLogins: `
          SELECT 
            DATE(created_at) as date,
            COUNT(*) as logins,
            COUNT(DISTINCT user_id) as unique_users
          FROM audit_logs 
          WHERE client_id = $1 AND action = 'login' AND created_at > NOW() - INTERVAL '${interval}'
          GROUP BY DATE(created_at)
          ORDER BY date
        `,
        userRegistrations: `
          SELECT 
            DATE(created_at) as date,
            COUNT(*) as registrations
          FROM client_users 
          WHERE client_id = $1 AND created_at > NOW() - INTERVAL '${interval}'
          GROUP BY DATE(created_at)
          ORDER BY date
        `,
        geographicDistribution: `
          SELECT 
            metadata->>'country' as country,
            COUNT(*) as logins
          FROM audit_logs 
          WHERE client_id = $1 AND action = 'login' AND created_at > NOW() - INTERVAL '${interval}'
          AND metadata->>'country' IS NOT NULL
          GROUP BY metadata->>'country'
          ORDER BY logins DESC
          LIMIT 10
        `,
        deviceTypes: `
          SELECT 
            metadata->>'device_type' as device_type,
            COUNT(*) as logins
          FROM audit_logs 
          WHERE client_id = $1 AND action = 'login' AND created_at > NOW() - INTERVAL '${interval}'
          AND metadata->>'device_type' IS NOT NULL
          GROUP BY metadata->>'device_type'
          ORDER BY logins DESC
        `,
      };

      const analytics = {};
      
      for (const [key, query] of Object.entries(analyticsQueries)) {
        const result = await database.query(query, [clientId]);
        analytics[key] = result.rows;
      }

      return analytics;

    } catch (error) {
      logger.error('Get client analytics error:', error);
      throw error;
    }
  }
}

module.exports = new ClientService();