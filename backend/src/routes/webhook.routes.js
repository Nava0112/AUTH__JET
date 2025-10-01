const express = require('express');
const webhookController = require('../controllers/webhook.controller');
const { authenticateClient } = require('../middleware/clientAuth');
const { webhookRateLimit } = require('../middleware/rateLimit');

const router = express.Router();

// Apply webhook-specific rate limiting
router.use(webhookRateLimit);

// All routes require client authentication
router.use(authenticateClient);

// Webhook test endpoint
router.post('/:client_id/test', (req, res, next) => {
  webhookController.testWebhook(req, res, next);
});

// Webhook logs retrieval
router.get('/:client_id/logs', (req, res, next) => {
  webhookController.getWebhookLogs(req, res, next);
});

// Webhook statistics
router.get('/:client_id/stats', (req, res, next) => {
  webhookController.getWebhookStats(req, res, next);
});

// Webhook retry endpoint
router.post('/:client_id/logs/:log_id/retry', (req, res, next) => {
  webhookController.retryWebhook(req, res, next);
});

// Webhook health check
router.get('/:client_id/health', (req, res, next) => {
  const { client_id } = req.params;

  require('../services/webhook.service').getWebhookHealth(client_id)
    .then(health => res.json({ health }))
    .catch(next);
});

// Webhook failure analysis
router.get('/:client_id/failures', (req, res, next) => {
  const { client_id } = req.params;
  const { period = '7d' } = req.query;

  require('../models/WebhookLog').getFailureReasons(client_id, period)
    .then(failures => res.json({ failures }))
    .catch(next);
});

// Webhook configuration validation
router.post('/:client_id/validate', (req, res, next) => {
  const { client_id } = req.params;
  const { webhook_url, webhook_secret } = req.body;

  // Basic URL validation
  try {
    new URL(webhook_url);
  } catch (error) {
    return res.status(400).json({
      error: 'Invalid webhook URL',
      code: 'INVALID_URL',
    });
  }

  // Test the webhook configuration
  require('../models/Client').findById(client_id)
    .then(client => {
      if (!client) {
        throw new Error('Client not found');
      }

      const testClient = {
        ...client,
        webhook_url,
        settings: {
          ...client.settings,
          webhook_secret,
        },
      };

      const testPayload = {
        event: 'validation',
        timestamp: new Date().toISOString(),
        data: {
          message: 'Webhook configuration test',
          status: 'success',
        },
      };

      return require('../services/webhook.service').callWebhook(testClient, testPayload, 'validation');
    })
    .then(result => {
      res.json({
        valid: result.success,
        message: result.success ? 'Webhook configuration is valid' : 'Webhook test failed',
        response: {
          status: result.response_status,
          duration: result.duration_ms,
        },
      });
    })
    .catch(next);
});

module.exports = router;