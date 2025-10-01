const validator = require('validator');

const validateEmail = (email) => {
  return validator.isEmail(email) && validator.isLength(email, { max: 255 });
};

const validatePassword = (password) => {
  // At least 8 characters, contains uppercase, lowercase, number and special character
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return passwordRegex.test(password);
};

const validateURL = (url) => {
  return validator.isURL(url, {
    require_protocol: true,
    require_valid_protocol: true,
    protocols: ['http', 'https'],
  });
};

const validateDomain = (domain) => {
  if (domain.startsWith('*.')) {
    // Wildcard domain - validate the base part
    const baseDomain = domain.substring(2);
    return validator.isFQDN(baseDomain) || validator.isIP(baseDomain);
  }
  return validator.isFQDN(domain) || validator.isIP(domain);
};

const validateUUID = (uuid) => {
  return validator.isUUID(uuid);
};

const validateIP = (ip) => {
  return validator.isIP(ip);
};

const validateJSON = (jsonString) => {
  try {
    JSON.parse(jsonString);
    return true;
  } catch {
    return false;
  }
};

const validateRole = (role) => {
  const validRoles = ['user', 'admin', 'moderator', 'viewer', 'editor'];
  return validRoles.includes(role);
};

const validateClientName = (name) => {
  return validator.isLength(name, { min: 2, max: 255 }) &&
         validator.matches(name, /^[a-zA-Z0-9\s\-_\.]+$/);
};

const validateBusinessType = (type) => {
  const validTypes = [
    'ecommerce', 'saas', 'education', 'healthcare', 'finance',
    'entertainment', 'technology', 'other'
  ];
  return validTypes.includes(type);
};

const validateWebhookEvent = (event) => {
  const validEvents = [
    'user.register',
    'user.login', 
    'user.update',
    'user.delete',
    'test',
  ];
  return validEvents.includes(event);
};

const validatePaginationParams = (page, limit) => {
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  
  return (
    Number.isInteger(pageNum) && pageNum > 0 &&
    Number.isInteger(limitNum) && limitNum > 0 && limitNum <= 100
  );
};

const sanitizeInput = (input) => {
  if (typeof input === 'string') {
    return validator.escape(input.trim());
  }
  return input;
};

const validateRateLimitConfig = (config) => {
  const { windowMs, max } = config;
  return (
    Number.isInteger(windowMs) && windowMs > 0 &&
    Number.isInteger(max) && max > 0
  );
};

const validateJWTConfig = (config) => {
  const { accessTokenExpiry, refreshTokenExpiry } = config;
  return (
    Number.isInteger(accessTokenExpiry) && accessTokenExpiry > 0 &&
    Number.isInteger(refreshTokenExpiry) && refreshTokenExpiry > 0
  );
};

module.exports = {
  validateEmail,
  validatePassword,
  validateURL,
  validateDomain,
  validateUUID,
  validateIP,
  validateJSON,
  validateRole,
  validateClientName,
  validateBusinessType,
  validateWebhookEvent,
  validatePaginationParams,
  sanitizeInput,
  validateRateLimitConfig,
  validateJWTConfig,
};