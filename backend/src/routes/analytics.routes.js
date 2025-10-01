const express = require('express');
const { authenticateJWT } = require('../middleware/auth');

const router = express.Router();

router.get('/dashboard', authenticateJWT, async (req, res) => {
  try {
    const analyticsData = {
      total_users: 0,
      active_sessions: 0,
      api_usage: {
        today: 0,
        this_week: 0,
        this_month: 0,
      },
      recent_activity: [],
    };

    res.json(analyticsData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

module.exports = router;


