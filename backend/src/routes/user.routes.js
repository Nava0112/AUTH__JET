const express = require('express');
const userController = require('../controllers/user.controller');
const { authenticateClient } = require('../middleware/clientAuth');
const { validatePagination } = require('../middleware/validation');
const { clientRateLimit } = require('../middleware/rateLimit');

const router = express.Router();

// Apply client rate limiting
router.use(clientRateLimit);

// All routes require client authentication
router.use(authenticateClient);

// User management routes for client applications
router.get('/:client_id/users', validatePagination, (req, res, next) => {
  userController.getUsers(req, res, next);
});

router.get('/:client_id/users/:user_id', (req, res, next) => {
  userController.getUser(req, res, next);
});

router.put('/:client_id/users/:user_id', (req, res, next) => {
  userController.updateUser(req, res, next);
});

router.get('/:client_id/users/:user_id/sessions', (req, res, next) => {
  userController.getUserSessions(req, res, next);
});

router.delete('/:client_id/users/:user_id/sessions/:session_id', (req, res, next) => {
  userController.revokeUserSession(req, res, next);
});

router.delete('/:client_id/users/:user_id/sessions', (req, res, next) => {
  userController.revokeAllUserSessions(req, res, next);
});

router.get('/:client_id/users/:user_id/login-history', validatePagination, (req, res, next) => {
  userController.getUserLoginHistory(req, res, next);
});

// Bulk operations
router.post('/:client_id/users/bulk', (req, res, next) => {
  const { users } = req.body;
  
  // This would implement bulk user creation/updating
  // For now, return not implemented
  res.status(501).json({
    error: 'Bulk operations not yet implemented',
    code: 'NOT_IMPLEMENTED',
  });
});

// Search users
router.get('/:client_id/users/search/:email', (req, res, next) => {
  const { client_id, email } = req.params;

  const query = `
    SELECT u.id, u.email, u.email_verified, u.status, u.last_login,
           u.created_at, cu.roles, cu.custom_data
    FROM users u
    JOIN client_users cu ON u.id = cu.user_id
    WHERE cu.client_id = $1 AND u.email ILIKE $2
    LIMIT 10
  `;

  require('../utils/database').query(query, [client_id, `%${email}%`])
    .then(result => res.json({ users: result.rows }))
    .catch(next);
});

// User statistics for client
router.get('/:client_id/stats', (req, res, next) => {
  const { client_id } = req.params;
  const { period = '30d' } = req.query;

  require('../models/User').getStats(client_id, period)
    .then(stats => res.json({ stats }))
    .catch(next);
});

// Export users (basic implementation)
router.get('/:client_id/users/export', (req, res, next) => {
  const { client_id } = req.params;
  const { format = 'json' } = req.query;

  if (format !== 'json') {
    return res.status(400).json({
      error: 'Only JSON export is currently supported',
      code: 'UNSUPPORTED_FORMAT',
    });
  }

  const query = `
    SELECT u.id, u.email, u.email_verified, u.status, u.last_login, u.login_count,
           u.created_at, cu.roles, cu.custom_data
    FROM users u
    JOIN client_users cu ON u.id = cu.user_id
    WHERE cu.client_id = $1
    ORDER BY u.created_at DESC
  `;

  require('../utils/database').query(query, [client_id])
    .then(result => {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=users-${client_id}-${Date.now()}.json`);
      res.json({ users: result.rows });
    })
    .catch(next);
});

module.exports = router;