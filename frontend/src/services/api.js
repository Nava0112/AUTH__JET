import axios from 'axios';
import { authService } from './auth';
import { APP_CONFIG } from '../utils/constants';

// Create axios instance
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = authService.getToken();
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If error is 401 and we haven't tried refreshing yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Try to refresh the token
        await authService.refreshToken();
        
        // Retry the original request
        const token = authService.getToken();
        originalRequest.headers.Authorization = `Bearer ${token}`;
        
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed, logout user
        authService.clearToken();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Generic error handler
const handleApiError = (error) => {
  if (error.response) {
    // Server responded with error status
    const message = error.response.data?.error || error.response.data?.message || 'An error occurred';
    const code = error.response.data?.code || 'UNKNOWN_ERROR';
    
    throw new Error(`${message} (${code})`);
  } else if (error.request) {
    // Request made but no response received
    throw new Error('Network error: Unable to connect to server');
  } else {
    // Something else happened
    throw new Error(error.message || 'An unexpected error occurred');
  }
};

// API methods
const apiServiceObj = {
  // Auth endpoints
  auth: {
    login: (email, password) =>
      api.post('/api/auth/login', { 
        email, 
        password,
        client_id: APP_CONFIG.DEFAULT_CLIENT_ID 
      })
        .then(response => response.data)
        .catch(handleApiError),
    
    register: (email, password) =>
      api.post('/api/auth/register', { 
        email, 
        password,
        client_id: APP_CONFIG.DEFAULT_CLIENT_ID 
      })
        .then(response => response.data)
        .catch(handleApiError),
    
    logout: () =>
      api.post('/api/auth/logout')
        .then(response => response.data)
        .catch(handleApiError),
    
    refreshToken: () =>
      api.post('/api/auth/refresh')
        .then(response => response.data)
        .catch(handleApiError),
    
    verifyToken: (token) =>
      api.post('/api/auth/verify', { token })
        .then(response => response.data)
        .catch(handleApiError),
    
    getCurrentUser: () =>
      api.get('/api/auth/me')
        .then(response => response.data)
        .catch(handleApiError),
    
    changePassword: (passwordData) =>
      api.post('/api/auth/change-password', passwordData)
        .then(response => response.data)
        .catch(handleApiError),
  },

  // Client endpoints
  clients: {
    list: (params = {}) =>
      api.get('/api/clients', { params })
        .then(response => response.data)
        .catch(handleApiError),
    
    get: (id) =>
      api.get(`/api/clients/${id}`)
        .then(response => response.data)
        .catch(handleApiError),
    
    create: (clientData) =>
      api.post('/api/clients', clientData)
        .then(response => response.data)
        .catch(handleApiError),
    
    update: (id, clientData) =>
      api.put(`/api/clients/${id}`, clientData)
        .then(response => response.data)
        .catch(handleApiError),
    
    delete: (id) =>
      api.delete(`/api/clients/${id}`)
        .then(response => response.data)
        .catch(handleApiError),
    
    regenerateApiKey: (id) =>
      api.post(`/api/clients/${id}/regenerate-key`)
        .then(response => response.data)
        .catch(handleApiError),
    
    getStats: (id) =>
      api.get(`/api/clients/${id}/stats`)
        .then(response => response.data)
        .catch(handleApiError),
  },

  // User endpoints (end-users of client apps)
  users: {
    list: (clientId, params = {}) =>
      api.get(`/api/users/${clientId}/users`, { params })
        .then(response => response.data)
        .catch(handleApiError),
    
    get: (clientId, userId) =>
      api.get(`/api/users/${clientId}/users/${userId}`)
        .then(response => response.data)
        .catch(handleApiError),
    
    update: (clientId, userId, userData) =>
      api.put(`/api/users/${clientId}/users/${userId}`, userData)
        .then(response => response.data)
        .catch(handleApiError),
    
    getSessions: (clientId, userId) =>
      api.get(`/api/users/${clientId}/users/${userId}/sessions`)
        .then(response => response.data)
        .catch(handleApiError),
    
    revokeSession: (clientId, userId, sessionId) =>
      api.delete(`/api/users/${clientId}/users/${userId}/sessions/${sessionId}`)
        .then(response => response.data)
        .catch(handleApiError),
  },

  // Webhook endpoints
  webhooks: {
    test: (clientId, webhookData) =>
      api.post(`/api/webhooks/${clientId}/test`, webhookData)
        .then(response => response.data)
        .catch(handleApiError),
    
    getLogs: (clientId, params = {}) =>
      api.get(`/api/webhooks/${clientId}/logs`, { params })
        .then(response => response.data)
        .catch(handleApiError),
  },

  // Analytics endpoints
  analytics: {
    getDashboardStats: () =>
      api.get('/api/analytics/dashboard')
        .then(response => response.data)
        .catch(handleApiError),
    
    getClientStats: (clientId, period = '30d') =>
      api.get(`/api/analytics/clients/${clientId}`, { params: { period } })
        .then(response => response.data)
        .catch(handleApiError),
    getLoginTrends: (clientId, period = '30d') =>
      api.get(`/api/analytics/clients/${clientId}/logins`, { params: { period } })
        .then(response => response.data)
        .catch(handleApiError),
  },
};

// Export as both api and apiService for compatibility
export { api };
export const apiService = apiServiceObj;
export default apiServiceObj;