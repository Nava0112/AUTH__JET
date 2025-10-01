const database = require('../utils/database');
const logger = require('../utils/logger');

class WebhookLog {
  static async create(logData) {
    const {
      client_id,
      user_id = null,
      event_type,
      url,
      request_payload,
      response_status = null,
      response_body = null,
      retry_count = 0,
      success = false,
      error_message = null,
      duration_ms = null,
    } = logData;

    try {
      const query = `
        INSERT INTO webhook_logs (
          client_id, user_id, event_type, url, request_payload,
          response_status, response_body, retry_count, success,
          error_message, duration_ms
        ) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `;
      
      const result = await database.query(query, [
        client_id,
        user_id,
        event_type,
        url,
        JSON.stringify(request_payload),
        response_status,
        typeof response_body === 'string' ? response_body : JSON.stringify(response_body),
        retry_count,
        success,
        error_message,
        duration_ms,
      ]);

      return result.rows[0];
    } catch (error) {
      logger.error('Webhook log creation error:', error);
      throw error;
    }
  }

  static async findByClient(clientId, options = {}) {
    try {
      const { 
        page = 1, 
        limit = 50, 
        event_type, 
        success, 
        start_date, 
        end_date 
      } = options;
      
      const offset = (page - 1) * limit;

      let query = `
        SELECT 
          id, event_type, url, request_payload, response_status,
          response_body, retry_count, success, error_message,
          duration_ms, created_at
        FROM webhook_logs 
        WHERE client_id = $1
      `;
      
      let countQuery = 'SELECT COUNT(*) FROM webhook_logs WHERE client_id = $1';
      const params = [clientId];
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
        params.push(success);
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
        database.query(countQuery, params.slice(0, -2)),
      ]);

      return {
        logs: logsResult.rows,
        total: parseInt(countResult.rows[0].count),
        page,
        limit,
        pages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
      };
    } catch (error) {
      logger.error('Find webhook logs by client error:', error);
      throw error;
    }
  }

  static async findById(id, clientId) {
    try {
      const query = `
        SELECT * FROM webhook_logs 
        WHERE id = $1 AND client_id = $2
      `;
      
      const result = await database.query(query, [id, clientId]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Find webhook log by ID error:', error);
      throw error;
    }
  }

  static async getStats(clientId, period = '7d') {
    try {
      let interval;
      switch (period) {
        case '24h': interval = '1 day'; break;
        case '7d': interval = '7 days'; break;
        case '30d': interval = '30 days'; break;
        default: interval = '7 days';
      }

      const statsQuery = `
        SELECT 
          COUNT(*) as total_calls,
          COUNT(CASE WHEN success = true THEN 1 END) as successful_calls,
          COUNT(CASE WHEN success = false THEN 1 END) as failed_calls,
          AVG(duration_ms) as avg_duration,
          PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95_duration,
          MAX(duration_ms) as max_duration,
          AVG(retry_count) as avg_retries,
          MAX(retry_count) as max_retries
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
        database.query(statsQuery, [clientId]),
        database.query(hourlyTrendQuery, [clientId]),
        database.query(eventTypeStatsQuery, [clientId]),
      ]);

      const stats = statsResult.rows[0];

      return {
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
        hourly_trend: trendResult.rows,
        event_types: eventTypeResult.rows,
      };
    } catch (error) {
      logger.error('Get webhook stats error:', error);
      throw error;
    }
  }

  static async cleanupOldLogs(retentionDays = 30) {
    try {
      const query = `
        DELETE FROM webhook_logs 
        WHERE created_at < NOW() - INTERVAL '${retentionDays} days'
        RETURNING COUNT(*) as deleted_count
      `;
      
      const result = await database.query(query);
      return parseInt(result.rows[0].deleted_count) || 0;
    } catch (error) {
      logger.error('Cleanup old webhook logs error:', error);
      throw error;
    }
  }

  static async getFailureReasons(clientId, period = '7d') {
    try {
      let interval;
      switch (period) {
        case '24h': interval = '1 day'; break;
        case '7d': interval = '7 days'; break;
        case '30d': interval = '30 days'; break;
        default: interval = '7 days';
      }

      const query = `
        SELECT 
          error_message,
          COUNT(*) as count
        FROM webhook_logs 
        WHERE client_id = $1 AND success = false AND created_at > NOW() - INTERVAL '${interval}'
        GROUP BY error_message
        ORDER BY count DESC
        LIMIT 10
      `;
      
      const result = await database.query(query, [clientId]);
      return result.rows;
    } catch (error) {
      logger.error('Get webhook failure reasons error:', error);
      throw error;
    }
  }
}

module.exports = WebhookLog;