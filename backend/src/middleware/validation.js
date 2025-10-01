const { body, query, param, validationResult } = require('express-validator');
const { validateEmail, validatePassword } = require('../utils/validators');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: errors.array().map(err => ({
        field: err.param,
        message: err.msg,
        value: err.value,
      })),
    });
  }
  
  next();
};

// User registration validation
const validateRegistration = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain uppercase, lowercase, number and special character'),
  body('client_id')
    .isUUID()
    .withMessage('Valid client ID is required'),
  body('redirect_uri')
    .optional()
    .isURL()
    .withMessage('Valid redirect URL is required'),
  handleValidationErrors,
];

// User login validation
const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  body('client_id')
    .isUUID()
    .withMessage('Valid client ID is required'),
  handleValidationErrors,
];

// Client creation validation
const validateClientCreation = [
  body('name')
    .isLength({ min: 2, max: 255 })
    .withMessage('Name must be between 2 and 255 characters'),
  body('contact_email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid contact email is required'),
  body('website')
    .optional()
    .isURL()
    .withMessage('Valid website URL is required'),
  body('business_type')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Business type must be less than 100 characters'),
  body('allowed_domains')
    .optional()
    .isArray()
    .withMessage('Allowed domains must be an array'),
  body('default_roles')
    .optional()
    .isArray()
    .withMessage('Default roles must be an array'),
  handleValidationErrors,
];

// Webhook configuration validation
const validateWebhookConfig = [
  body('webhook_url')
    .optional()
    .isURL()
    .withMessage('Valid webhook URL is required'),
  body('webhook_secret')
    .optional()
    .isLength({ min: 16 })
    .withMessage('Webhook secret must be at least 16 characters long'),
  handleValidationErrors,
];

// Pagination validation
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('sort')
    .optional()
    .isIn(['created_at', 'email', 'last_login', 'login_count'])
    .withMessage('Invalid sort field'),
  query('order')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Order must be asc or desc'),
  handleValidationErrors,
];

module.exports = {
  validateRegistration,
  validateLogin,
  validateClientCreation,
  validateWebhookConfig,
  validatePagination,
  handleValidationErrors,
};