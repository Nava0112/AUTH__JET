const express = require('express');
const JwksController = require('../controllers/jwks.controller');

const router = express.Router();

router.post('/.well-known/jwks', JwksController.getJwksByOauthApplicationId);
router.get('/.well-known/jwks', JwksController.getJwksByOauthApplicationId);

module.exports = router;