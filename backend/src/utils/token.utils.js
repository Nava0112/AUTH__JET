// src/utils/token.utils.js
const crypto = require('crypto');

function hashToken(token) {
  if (!token) {
    throw new Error('Token cannot be empty');
  }
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateRandomToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

module.exports = {
  hashToken,
  generateRandomToken
};