const crypto = require('crypto');
const database = require('../utils/database');
const logger = require('../utils/logger');

class WebhookService {
  constructor() {
    this.circuitBreakers = new Map();
    this.maxRetries = 3;
    this.timeout = 5000; // 5 seconds
  }

  getCircuitBreaker(clientId) {
    if (!this.circuitBreakers.has(clientId)) {
      this.circuitBreakers.set(clientId, {
        failures: 0,
        lastFailure: 0,
        state: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
      });
    }
    return this.circuitBreakers.get(clientId);
  }

  async callWebhook(client, payload, eventType = 'user_event') {
    const circuitBreaker = this.getCircuitBreaker(client.id);
    
    // Check circuit breaker
    if (circuitBreaker.state === 'OPEN') {
      const timeSinceLastFailure = Date.now() - circuitBreaker.lastFailure;
      if (timeSinceLastFailure < 60000) { // 1 minute cooldown
        throw new Error(`Circuit breaker open for client ${client.id}`);
      }
      circuitBreaker.state = 'HALF_OPEN';
    }

    const startTime = Date.now();
    let retryCount = 0;
    let success = false;
    let responseStatus = null;
    let responseBody = null;
    let errorMessage = null;

    while (retryCount <= this.maxRetries && !success) {
      try {
        const result = await this.makeWebhookRequest(client, payload, eventType, retryCount);
        
        success = true;
        responseStatus = result.status;
        responseBody = result.body;

        // Reset circuit breaker on success
        if (circuitBreaker.state === 'HALF_OPEN') {
          circuitBreaker.state = 'CLOSED';
          circuitBreaker.failures = 0;
        }

      } catch (error) {
        retryCount++;
        errorMessage = error.message;

        // Update circuit breaker
        circuitBreaker.failures++;
        circuitBreaker.lastFailure = Date.now();

        if (circuitBreaker.failures >= 5) {
          circuitBreaker.state = 'OPEN';
        }

        if (retryCount > this.maxRetries) {
          logger.warn(`Webhook call failed after ${this.maxRetries} retries`, {
            clientId: client.id,
            eventType,
            error: error.message,
          });
        } else {
          // Exponential backoff
          const backoffTime = Math.pow(2, retryCount) * 1000;
          await new Promise(resolve => setTimeout(resolve, backoffTime));
        }
      }
    }

    const duration = Date.now() - startTime;

    // Log webhook call
    await this.logWebhookCall(
      client.id,
      eventType,
      client.webhook_url,
      payload,
      responseStatus,
      responseBody,
      retryCount,
      success,
      errorMessage,
      duration
    );

    if (success) {
      return {
        success: true,
        response_status: responseStatus,
        response_body: responseBody,
        duration_ms: duration,
        retry_count: retryCount,
      };
    } else {
      throw new Error(`Webhook call failed: ${errorMessage}`);
    }
  }

  async makeWebhookRequest(client, payload, eventType, retryCount) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Webhook request timeout'));
      }, this.timeout);

      const requestBody = JSON.stringify({
        event: eventType,
        timestamp: new Date().toISOString(),
        data: payload,
        retry_count: retryCount,
      });

      // Generate signature
      const signature = crypto
        .createHmac('sha256', client.settings?.webhook_secret || '')
        .update(requestBody)
        .digest('hex');

      const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'AuthJet-Webhook/1.0',
        'X-AuthJet-Signature': signature,
        'X-AuthJet-Event': eventType,
        'X-AuthJet-Delivery': crypto.randomUUID(),
        'X-AuthJet-Timestamp': new Date().toISOString(),
      };

      fetch(client.webhook_url, {
        method: 'POST',
        headers,
        body: requestBody,
      })
        .then(async (response) => {
          clearTimeout(timeout);
          
          const responseText = await response.text();
          let responseBody;

          try {
            responseBody = JSON.parse(responseText);
          } catch {
            responseBody = responseText;
          }

          if (response.status >= 200 && response.status < 300) {
            resolve({
              status: response.status,
              body: responseBody,
            });
          } else {
            reject(new Error(`Webhook returned status ${response.status}: ${responseText}`));
          }
        })
        .catch((error) => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  async callUserWebhook(client, userData, action = 'register') {
    if (!client.webhook_url) {
      logger.debug('No webhook URL configured for client', { clientId: client.id });
      return { roles: client.default_roles || ['user'] };
    }

    const payload = {
      user_id: userData.user_id,
      email: userData.email,
      action: action,
      timestamp: new Date().toISOString(),
    };

    try {
      const result = await this.callWebhook(client, payload, `user.${action}`);
      
      if (result.success && result.response_body) {
        return result.response_body;
      } else {
        throw new Error('Webhook call failed');
      }
    } catch (error) {
      logger.warn('Webhook call failed, using default roles', {
        clientId: client.id,
        error: error.message,
      });
      
      return { roles: client.default_roles || ['user'] };
    }
  }

  async logWebhookCall(
    clientId,
    eventType,
    url,
    requestPayload,
    responseStatus,
    responseBody,
    retryCount,
    success,
    errorMessage,
    durationMs
  ) {
    try {
      const query = `
        INSERT INTO webhook_logs (
          client_id, event_type, url, request_payload, response_status,
          response_body, retry_count, success, error_message, duration_ms
        ) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `;

      await database.query(query, [
        clientId,
        eventType,
        url,
        JSON.stringify(requestPayload),
        responseStatus,
        typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody),
        retryCount,
        success,
        errorMessage,
        durationMs,
      ]);
    } catch (error) {
      logger.error('Failed to log webhook call:', error);
    }
  }

  async retryWebhookCall(client, logEntry) {
    try {
      const payload = logEntry.request_payload;
      const eventType = logEntry.event_type;

      const result = await this.callWebhook(client, payload, eventType);

      return result;
    } catch (error) {
      logger.error('Webhook retry failed:', error);
      throw error;
    }
  }

  async getWebhookHealth(clientId) {
    const query = `
      SELECT 
        COUNT(*) as total_calls,
        COUNT(CASE WHEN success = true THEN 1 END) as successful_calls,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '1 hour' THEN 1 END) as recent_calls,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '1 hour' AND success = false THEN 1 END) as recent_failures
      FROM webhook_logs 
      WHERE client_id = $1
    `;

    const result = await database.query(query, [clientId]);
    const stats = result.rows[0];

    const totalCalls = parseInt(stats.total_calls);
    const successRate = totalCalls > 0 ? (parseInt(stats.successful_calls) / totalCalls) * 100 : 100;

    let status = 'healthy';
    if (parseInt(stats.recent_failures) > 5) {
      status = 'unhealthy';
    } else if (parseInt(stats.recent_failures) > 0) {
      status = 'degraded';
    }

    return {
      status,
      success_rate: successRate.toFixed(2),
      total_calls: totalCalls,
      recent_calls: parseInt(stats.recent_calls),
      recent_failures: parseInt(stats.recent_failures),
    };
  }
}

module.exports = new WebhookService();