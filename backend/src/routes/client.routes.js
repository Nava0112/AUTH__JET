const express = require('express');
const clientController = require('../controllers/client.controller');
const { authenticateJWT, requireRole } = require('../middleware/auth');
const { validateClientCreation, validatePagination } = require('../middleware/validation');
const { createUserRateLimit } = require('../middleware/rateLimit');

const router = express.Router();

// Apply rate limiting to all client routes
router.use(createUserRateLimit(100, 15)); // 100 requests per 15 minutes

// All routes require authentication
router.use(authenticateJWT);

// Client management routes
router.post('/', requireRole(['admin']), validateClientCreation, (req, res, next) => {
  clientController.createClient(req, res, next);
});

router.get('/', requireRole(['admin', 'viewer']), validatePagination, (req, res, next) => {
  clientController.getClients(req, res, next);
});

router.get('/:id', requireRole(['admin', 'viewer']), (req, res, next) => {
  clientController.getClient(req, res, next);
});

router.put('/:id', requireRole(['admin']), (req, res, next) => {
  clientController.updateClient(req, res, next);
});

router.delete('/:id', requireRole(['admin']), (req, res, next) => {
  clientController.deleteClient(req, res, next);
});

router.post('/:id/regenerate-key', requireRole(['admin']), (req, res, next) => {
  clientController.regenerateApiKey(req, res, next);
});

router.get('/:id/stats', requireRole(['admin', 'viewer']), (req, res, next) => {
  clientController.getClientStats(req, res, next);
});

// Client-specific user management routes
router.get('/:client_id/users', requireRole(['admin', 'viewer']), validatePagination, (req, res, next) => {
  // The user controller will handle this route
  require('../controllers/user.controller').getUsers(req, res, next);
});

router.get('/:client_id/users/:user_id', requireRole(['admin', 'viewer']), (req, res, next) => {
  require('../controllers/user.controller').getUser(req, res, next);
});

router.put('/:client_id/users/:user_id', requireRole(['admin']), (req, res, next) => {
  require('../controllers/user.controller').updateUser(req, res, next);
});

router.get('/:client_id/users/:user_id/sessions', requireRole(['admin', 'viewer']), (req, res, next) => {
  require('../controllers/user.controller').getUserSessions(req, res, next);
});

router.delete('/:client_id/users/:user_id/sessions/:session_id', requireRole(['admin']), (req, res, next) => {
  require('../controllers/user.controller').revokeUserSession(req, res, next);
});

router.delete('/:client_id/users/:user_id/sessions', requireRole(['admin']), (req, res, next) => {
  require('../controllers/user.controller').revokeAllUserSessions(req, res, next);
});

router.get('/:client_id/users/:user_id/login-history', requireRole(['admin', 'viewer']), validatePagination, (req, res, next) => {
  require('../controllers/user.controller').getUserLoginHistory(req, res, next);
});

// Webhook management routes for specific client
router.post('/:client_id/webhooks/test', requireRole(['admin']), (req, res, next) => {
  require('../controllers/webhook.controller').testWebhook(req, res, next);
});

router.get('/:client_id/webhooks/logs', requireRole(['admin', 'viewer']), validatePagination, (req, res, next) => {
  require('../controllers/webhook.controller').getWebhookLogs(req, res, next);
});

router.get('/:client_id/webhooks/stats', requireRole(['admin', 'viewer']), (req, res, next) => {
  require('../controllers/webhook.controller').getWebhookStats(req, res, next);
});

router.post('/:client_id/webhooks/logs/:log_id/retry', requireRole(['admin']), (req, res, next) => {
  require('../controllers/webhook.controller').retryWebhook(req, res, next);
});

// Analytics routes
router.get('/:client_id/analytics/users', requireRole(['admin', 'viewer']), (req, res, next) => {
  const { period = '30d' } = req.query;
  
  require('../models/User').getStats(req.params.client_id, period)
    .then(stats => res.json({ stats }))
    .catch(next);
});

router.get('/:client_id/analytics/sessions', requireRole(['admin', 'viewer']), (req, res, next) => {
  const { period = '30d' } = req.query;
  
  require('../models/Session').getSessionStats(req.params.client_id, period)
    .then(stats => res.json({ stats }))
    .catch(next);
});

router.get('/:client_id/analytics/webhooks', requireRole(['admin', 'viewer']), (req, res, next) => {
  const { period = '7d' } = req.query;
  
  require('../models/WebhookLog').getStats(req.params.client_id, period)
    .then(stats => res.json({ stats }))
    .catch(next);
});

// Client settings routes
router.put('/:id/settings', requireRole(['admin']), (req, res, next) => {
  const { id } = req.params;
  const { settings } = req.body;

  require('../services/client.service').updateClientSettings(id, settings)
    .then(client => res.json({ client }))
    .catch(next);
});

router.get('/:id/usage', requireRole(['admin', 'viewer']), (req, res, next) => {
  const { id } = req.params;
  const { period = '30d' } = req.query;

  require('../services/client.service').getClientUsage(id, period)
    .then(usage => res.json({ usage }))
    .catch(next);
});

router.get('/:id/limits', requireRole(['admin', 'viewer']), (req, res, next) => {
  const { id } = req.params;

  require('../services/client.service').getClientPlanLimits(id)
    .then(limits => res.json({ limits }))
    .catch(next);
});

router.post('/:id/upgrade', requireRole(['admin']), (req, res, next) => {
  const { id } = req.params;
  const { plan } = req.body;

  require('../services/client.service').upgradeClientPlan(id, plan)
    .then(client => res.json({ client }))
    .catch(next);
});

module.exports = router;