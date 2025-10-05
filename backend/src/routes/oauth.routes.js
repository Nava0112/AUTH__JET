const express = require('express');
const oauthController = require('../controllers/oauth.controller');

const router = express.Router();

// OAuth 2.0 Authorization Flow
router.get('/authorize', oauthController.authorize);

// User Authentication for OAuth
router.post('/login', oauthController.login);
router.post('/register', oauthController.register);

// User Profile and Role Management
router.get('/profile', oauthController.getProfile);
router.post('/request-role', oauthController.requestRole);

module.exports = router;
