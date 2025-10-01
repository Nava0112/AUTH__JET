const webhookService = require('../services/webhook.service');
const database = require('../utils/database');
const logger = require('../utils/logger');

class WebhookController {
  async testWebhook(req, res, next) {
    try {
      const { client_id } = req.params;
      const { user_id, event_type = 'test', payload } = req.body;

      // Verify client access
      if (req.client && req.client.id !== client_id) {
        return res.status(403).json({
          error: 'Access to this client data is forbidden',
          code: 'FORBIDDEN',
        });
      }

      // Get client with webhook URL
      const clientQuery = 'SELECT * FROM clients WHERE id = $1';
      const clientResult = await database.query(clientQuery, [client_id]);
      
      if (clientResult.rows.length === 0) {
        return res.status(404).json({
          error: 'Client not found',
          code: 'CLIENT_NOT_FOUND',
        });
      }

      const client = clientResult.rows[0];

      if (!client.webhook_url) {
        return res.status(400).json({
          error: 'Webhook URL not configured for this client',
          code: 'WEBHOOK_NOT_CONFIGURED',
        });
      }

      // Prepare test data
      const testPayload = payload || {
        event: event_type,
        user_id: user_id || 'test_user_id',
        email: 'test@example.com',
        timestamp: new Date().toISOString(),
        data: {
          message: 'Test webhook call from AuthJet',
          action: 'test',
        },
      };

      // Call webhook
      const result = await webhookService.callWebhook(client, testPayload, event_type);

      res.json({
        success: result.success,
        message: result.success ? 'Webhook test successful' : 'Webhook test failed',
        response: {
          status: result.response_status,
          body: result.response_body,
          duration: result.duration_ms,
        },
        retry_count: result.retry_count,
      });

    } catch (error) {
      logger.error('Test webhook error:', error);
      next(error);
    }
  }

  async getWebhookLogs(req, res, next) {
    try {
      const { client_id } = req.params;
      const { 
        page = 1, 
        limit = 50, 
        event_type, 
        success, 
        start_date, 
        end_date 
      } = req.query;
      
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
          id, event_type, url, request_payload, response_status,
          response_body, retry_count, success, error_message,
          duration_ms, created_at
        FROM webhook_logs 
        WHERE client_id = $1
      `;
      
      let countQuery = 'SELECT COUNT(*) FROM webhook_logs WHERE client_id = $1';
      const params = [client_id];
      let paramCount = 1;

      if (event_type) {
        paramCount++;
        query += ` AND event_type = $${paramCount}`;
        countQuery += ` AND event_type = $${paramCount}`;
        params.push(event_type);
      }

      if (success !== undefined) {
        paramCount++;
        query += ` AND success = $${paramCount}`;
        countQuery += ` AND success = $${paramCount}`;
        params.push(success === 'true');
      }

      if (start_date) {
        paramCount++;
        query += ` AND created_at >= $${paramCount}`;
        countQuery += ` AND created_at >= $${paramCount}`;
        params.push(new Date(start_date));
      }

      if (end_date) {
        paramCount++;
        query += ` AND created_at <= $${paramCount}`;
        countQuery += ` AND created_at <= $${paramCount}`;
        params.push(new Date(end_date));
      }

      paramCount++;
      query += ` ORDER BY created_at DESC LIMIT $${paramCount}`;
      params.push(limit);

      paramCount++;
      query += ` OFFSET $${paramCount}`;
      params.push(offset);

      const [logsResult, countResult] = await Promise.all([
        database.query(query, params),
        database.query(countQuery, params.slice(0, -2)), // Remove limit/offset for count
      ]);

      const totalCount = parseInt(countResult.rows[0].count);

      // Calculate webhook statistics
      const statsQuery = `
        SELECT 
          COUNT(*) as total_calls,
          COUNT(CASE WHEN success = true THEN 1 END) as successful_calls,
          COUNT(CASE WHEN success = false THEN 1 END) as failed_calls,
          AVG(duration_ms) as avg_duration,
          MAX(duration_ms) as max_duration
        FROM webhook_logs 
        WHERE client_id = $1 AND created_at > NOW() - INTERVAL '7 days'
      `;

      const statsResult = await database.query(statsQuery, [client_id]);
      const stats = statsResult.rows[0];

      res.json({
        logs: logsResult.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount,
          pages: Math.ceil(totalCount / limit),
        },
        stats: {
          total_calls: parseInt(stats.total_calls) || 0,
          successful_calls: parseInt(stats.successful_calls) || 0,
          failed_calls: parseInt(stats.failed_calls) || 0,
          success_rate: stats.total_calls > 0 ? 
            (parseInt(stats.successful_calls) / parseInt(stats.total_calls) * 100).toFixed(2) : 0,
          avg_duration: parseFloat(stats.avg_duration) || 0,
          max_duration: parseFloat(stats.max_duration) || 0,
        },
      });

    } catch (error) {
      logger.error('Get webhook logs error:', error);
      next(error);
    }
  }

  async getWebhookStats(req, res, next) {
    try {
      const { client_id } = req.params;
      const { period = '7d' } = req.query;

      // Verify client access
      if (req.client && req.client.id !== client_id) {
        return res.status(403).json({
          error: 'Access to this client data is forbidden',
          code: 'FORBIDDEN',
        });
      }

      // Calculate time interval based on period
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
          interval = '7 days';
      }

      const statsQuery = `
        SELECT 
          -- Total calls
          COUNT(*) as total_calls,
          
          -- Success rate
          COUNT(CASE WHEN success = true THEN 1 END) as successful_calls,
          COUNT(CASE WHEN success = false THEN 1 END) as failed_calls,
          
          -- Performance
          AVG(duration_ms) as avg_duration,
          PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95_duration,
          MAX(duration_ms) as max_duration,
          
          -- Retry statistics
          AVG(retry_count) as avg_retries,
          MAX(retry_count) as max_retries,
          
          -- Error breakdown
          COUNT(CASE WHEN error_message LIKE '%timeout%' THEN 1 END) as timeout_errors,
          COUNT(CASE WHEN error_message LIKE '%network%' THEN 1 END) as network_errors,
          COUNT(CASE WHEN response_status >= 400 AND response_status < 500 THEN 1 END) as client_errors,
          COUNT(CASE WHEN response_status >= 500 THEN 1 END) as server_errors
          
        FROM webhook_logs 
        WHERE client_id = $1 AND created_at > NOW() - INTERVAL '${interval}'
      `;

      const hourlyTrendQuery = `
        SELECT 
          DATE_TRUNC('hour', created_at) as hour,
          COUNT(*) as calls,
          COUNT(CASE WHEN success = true THEN 1 END) as successful_calls
        FROM webhook_logs 
        WHERE client_id = $1 AND created_at > NOW() - INTERVAL '24 hours'
        GROUP BY DATE_TRUNC('hour', created_at)
        ORDER BY hour
      `;

      const eventTypeStatsQuery = `
        SELECT 
          event_type,
          COUNT(*) as total_calls,
          COUNT(CASE WHEN success = true THEN 1 END) as successful_calls
        FROM webhook_logs 
        WHERE client_id = $1 AND created_at > NOW() - INTERVAL '${interval}'
        GROUP BY event_type
        ORDER BY total_calls DESC
      `;

      const [statsResult, trendResult, eventTypeResult] = await Promise.all([
        database.query(statsQuery, [client_id]),
        database.query(hourlyTrendQuery, [client_id]),
        database.query(eventTypeStatsQuery, [client_id]),
      ]);

      const stats = statsResult.rows[0];
      const hourlyTrend = trendResult.rows;
      const eventTypeStats = eventTypeResult.rows;

      res.json({
        period,
        overview: {
          total_calls: parseInt(stats.total_calls) || 0,
          successful_calls: parseInt(stats.successful_calls) || 0,
          failed_calls: parseInt(stats.failed_calls) || 0,
          success_rate: stats.total_calls > 0 ? 
            (parseInt(stats.successful_calls) / parseInt(stats.total_calls) * 100).toFixed(2) : 0,
        },
        performance: {
          avg_duration: parseFloat(stats.avg_duration) || 0,
          p95_duration: parseFloat(stats.p95_duration) || 0,
          max_duration: parseFloat(stats.max_duration) || 0,
          avg_retries: parseFloat(stats.avg_retries) || 0,
          max_retries: parseInt(stats.max_retries) || 0,
        },
        errors: {
          timeout_errors: parseInt(stats.timeout_errors) || 0,
          network_errors: parseInt(stats.network_errors) || 0,
          client_errors: parseInt(stats.client_errors) || 0,
          server_errors: parseInt(stats.server_errors) || 0,
        },
        hourly_trend: hourlyTrend,
        event_types: eventTypeStats,
      });

    } catch (error) {
      logger.error('Get webhook stats error:', error);
      next(error);
    }
  }

  async retryWebhook(req, res, next) {
    try {
      const { client_id, log_id } = req.params;

      // Verify client access
      if (req.client && req.client.id !== client_id) {
        return res.status(403).json({
          error: 'Access to this client data is forbidden',
          code: 'FORBIDDEN',
        });
      }

      // Get webhook log entry
      const logQuery = `
        SELECT * FROM webhook_logs 
        WHERE id = $1 AND client_id = $2
      `;
      
      const logResult = await database.query(logQuery, [log_id, client_id]);

      if (logResult.rows.length === 0) {
        return res.status(404).json({
          error: 'Webhook log not found',
          code: 'WEBHOOK_LOG_NOT_FOUND',
        });
      }

      const logEntry = logResult.rows[0];

      // Get client
      const clientQuery = 'SELECT * FROM clients WHERE id = $1';
      const clientResult = await database.query(clientQuery, [client_id]);
      const client = clientResult.rows[0];

      // Retry the webhook call
      const result = await webhookService.retryWebhookCall(client, logEntry);

      res.json({
        success: result.success,
        message: result.success ? 'Webhook retry successful' : 'Webhook retry failed',
        response: {
          status: result.response_status,
          body: result.response_body,
          duration: result.duration_ms,
        },
        retry_count: result.retry_count,
      });

    } catch (error) {
      logger.error('Retry webhook error:', error);
      next(error);
    }
  }
}

module.exports = new WebhookController();