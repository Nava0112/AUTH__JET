const express = require('express');
const JwksController = require('../controllers/jwks.controller');

const router = express.Router();

router.post('/.well-known/jwks', JwksController.getJwksBySecret);

module.exports = router;