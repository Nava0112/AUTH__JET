const express = require('express');
const dashboardController = require('../controllers/dashboard.controller');

const router = express.Router();

// Admin dashboard statistics
router.get('/admin/stats', dashboardController.getAdminStats);

// Client dashboard statistics
router.get('/client/stats', dashboardController.getClientStats);

// Detailed application statistics
router.get('/client/applications', dashboardController.getApplicationStats);

module.exports = router;
