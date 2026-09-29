const express = require('express');
const oauthController = require('../controllers/oauth.controller');

const router = express.Router();

router.get('/authorize', oauthController.authorize.bind(oauthController));
router.get('/request/:request_id', oauthController.getRequest.bind(oauthController));
router.post('/login', oauthController.login.bind(oauthController));
router.post('/signup', oauthController.signup.bind(oauthController));
router.get('/consent/:request_id', oauthController.consent.bind(oauthController));
router.post('/consent', oauthController.decideConsent.bind(oauthController));
router.post('/token', oauthController.token.bind(oauthController));

module.exports = router;