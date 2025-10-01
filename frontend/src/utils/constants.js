// Application constants
export const APP_CONFIG = {
    NAME: 'AuthJet',
    VERSION: '1.0.0',
    DESCRIPTION: 'JWT Authentication as a Service',
  };
  
  // API endpoints
  export const API_ENDPOINTS = {
    AUTH: {
      LOGIN: '/api/auth/login',
      REGISTER: '/api/auth/register',
      LOGOUT: '/api/auth/logout',
      REFRESH: '/api/auth/refresh',
      VERIFY: '/api/auth/verify',
      ME: '/api/auth/me',
    },
    CLIENTS: {
      BASE: '/api/clients',
      BY_ID: (id) => `/api/clients/${id}`,
      REGENERATE_KEY: (id) => `/api/clients/${id}/regenerate-key`,
      STATS: (id) => `/api/clients/${id}/stats`,
    },
    USERS: {
      BASE: (clientId) => `/api/users/${clientId}/users`,
      BY_ID: (clientId, userId) => `/api/users/${clientId}/users/${userId}`,
      SESSIONS: (clientId, userId) => `/api/users/${clientId}/users/${userId}/sessions`,
    },
    WEBHOOKS: {
      TEST: (clientId) => `/api/webhooks/${clientId}/test`,
      LOGS: (clientId) => `/api/webhooks/${clientId}/logs`,
    },
    ANALYTICS: {
      DASHBOARD: '/api/analytics/dashboard',
      CLIENT_STATS: (clientId) => `/api/analytics/clients/${clientId}`,
      LOGIN_TRENDS: (clientId) => `/api/analytics/clients/${clientId}/logins`,
    },
  };
  
  // User roles and permissions
  export const USER_ROLES = {
    ADMIN: 'admin',
    USER: 'user',
    VIEWER: 'viewer',
    EDITOR: 'editor',
  };
  
  export const CLIENT_PLANS = {
    FREE: 'free',
    PRO: 'pro',
    ENTERPRISE: 'enterprise',
  };
  
  // Validation constants
  export const VALIDATION = {
    EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    PASSWORD: {
      MIN_LENGTH: 8,
      REGEX: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    },
    API_KEY: {
      PREFIX: 'cli_',
      LENGTH: 16,
    },
    SECRET_KEY: {
      LENGTH: 32,
    },
  };
  
  // Time constants
  export const TIME = {
    ACCESS_TOKEN_EXPIRY: 15 * 60 * 1000, // 15 minutes
    REFRESH_TOKEN_EXPIRY: 7 * 24 * 60 * 60 * 1000, // 7 days
    SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes
  };
  
  // Local storage keys
  export const STORAGE_KEYS = {
    TOKEN: 'authjet_token',
    REFRESH_TOKEN: 'authjet_refresh_token',
    USER: 'authjet_user',
    THEME: 'authjet_theme',
    LANGUAGE: 'authjet_language',
  };
  
  // Error messages
  export const ERROR_MESSAGES = {
    NETWORK_ERROR: 'Unable to connect to the server. Please check your internet connection.',
    UNAUTHORIZED: 'Your session has expired. Please login again.',
    FORBIDDEN: 'You do not have permission to perform this action.',
    NOT_FOUND: 'The requested resource was not found.',
    VALIDATION_ERROR: 'Please check your input and try again.',
    SERVER_ERROR: 'An unexpected error occurred. Please try again later.',
    RATE_LIMIT: 'Too many requests. Please try again later.',
  };
  
  // Success messages
  export const SUCCESS_MESSAGES = {
    CLIENT_CREATED: 'Client created successfully.',
    CLIENT_UPDATED: 'Client updated successfully.',
    CLIENT_DELETED: 'Client deleted successfully.',
    API_KEY_REGENERATED: 'API keys regenerated successfully.',
    SETTINGS_SAVED: 'Settings saved successfully.',
    PASSWORD_CHANGED: 'Password changed successfully.',
  };