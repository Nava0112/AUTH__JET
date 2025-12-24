import axios from 'axios';
import { authService } from './auth';
import { APP_CONFIG } from '../utils/constants';

// Create axios instance
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Deduplicate concurrent identical requests (method+url+params)
const pendingRequests = new Map();

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = authService.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Create a more specific request ID that includes params to avoid over-aggressive cancellation
    const requestId = `${config.method}-${config.url}-${JSON.stringify(config.params || {})}`;

    // Only cancel if the exact same request (including params) is pending
    if (pendingRequests.has(requestId)) {
      const existingRequest = pendingRequests.get(requestId);
      // Only cancel if the request is still pending (not already completed)
      if (existingRequest && !existingRequest.token.reason) {
        existingRequest.cancel('Duplicate request cancelled');
      }
    }

    const cancelSource = axios.CancelToken.source();
    config.cancelToken = cancelSource.token;
    pendingRequests.set(requestId, cancelSource);

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => {
    const requestId = `${response.config.method}-${response.config.url}-${JSON.stringify(response.config.params || {})}`;
    pendingRequests.delete(requestId);
    return response;
  },
  async (error) => {
    if (axios.isCancel(error)) {
      return Promise.reject(error);
    }

    const originalRequest = error.config || {};
    const requestId = `${originalRequest.method}-${originalRequest.url}-${JSON.stringify(originalRequest.params || {})}`;
    pendingRequests.delete(requestId);

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        await authService.refreshToken();
        const token = authService.getToken();
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      } catch (refreshError) {
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
  // Don't throw errors for cancelled requests
  if (axios.isCancel(error)) {
    throw error; // Let the calling code handle cancellation
  }

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
  // Auth endpoints (End-Users)
  auth: {
    login: (email, password, applicationId) => {
      // Use provided appId or default
      const appId = applicationId || APP_CONFIG.DEFAULT_APPLICATION_ID;

      return api.post('/api/user/login', {
        email,
        password
      }, {
        headers: {
          'X-Application-ID': appId
        }
      })
        .then(response => response.data)
        .catch(handleApiError);
    },

    register: (email, password, applicationId) => {
      const appId = applicationId || APP_CONFIG.DEFAULT_APPLICATION_ID;

      return api.post('/api/user/register', {
        email,
        password
      }, {
        headers: {
          'X-Application-ID': appId
        }
      })
        .then(response => response.data)
        .catch(handleApiError);
    },

    logout: (payload) =>
      api.post('/api/user/logout', payload)
        .then(response => response.data)
        .catch(handleApiError),

    refreshToken: (payload, applicationId) => {
      const appId = applicationId || APP_CONFIG.DEFAULT_APPLICATION_ID;

      return api.post('/api/user/refresh-token', payload, {
        headers: {
          'X-Application-ID': appId
        }
      })
        .then(response => response.data)
        .catch(handleApiError);
    },

    verifyToken: (token) =>
      // Use profile to verify token validity since we don't have a dedicated verify endpoint
      api.get('/api/user/profile')
        .then(() => ({ valid: true }))
        .catch(() => ({ valid: false })),

    getCurrentUser: () =>
      api.get('/api/user/profile')
        .then(response => response.data)
        .catch(handleApiError),

    changePassword: (passwordData) =>
      api.post('/api/user/change-password', passwordData) // Note: Need to implement this if missing
        .then(response => response.data)
        .catch(handleApiError),
  },

  // Client endpoints (For Admin Dashboard)
  clients: {
    list: (params = {}) =>
      api.get('/api/admin/clients', { params })
        .then(response => response.data)
        .catch(handleApiError),

    get: (id) =>
      api.get(`/api/admin/clients/${id}`)
        .then(response => response.data)
        .catch(handleApiError),

    create: (clientData) =>
      api.post('/api/admin/clients', clientData) // Note: Admin creates clients?
        .then(response => response.data)
        .catch(handleApiError),

    update: (id, clientData) =>
      api.put(`/api/admin/clients/${id}`, clientData)
        .then(response => response.data)
        .catch(handleApiError),

    delete: (id) =>
      api.delete(`/api/admin/clients/${id}`)
        .then(response => response.data)
        .catch(handleApiError),

    regenerateApiKey: (id) =>
      api.post(`/api/admin/clients/${id}/regenerate-key`)
        .then(response => response.data)
        .catch(handleApiError),

    getStats: (id) =>
      api.get(`/api/admin/clients/${id}/stats`)
        .then(response => response.data)
        .catch(handleApiError),
  },

  // User endpoints (Admin managing users of a client)
  users: {
    list: (clientId, params = {}) =>
      api.get(`/api/admin/clients/${clientId}/users`, { params })
        .then(response => response.data)
        .catch(handleApiError),

    get: (clientId, userId) =>
      api.get(`/api/admin/clients/${clientId}/users/${userId}`)
        .then(response => response.data)
        .catch(handleApiError),

    update: (clientId, userId, userData) =>
      api.put(`/api/admin/clients/${clientId}/users/${userId}`, userData)
        .then(response => response.data)
        .catch(handleApiError),

    getSessions: (clientId, userId) =>
      api.get(`/api/admin/clients/${clientId}/users/${userId}/sessions`)
        .then(response => response.data)
        .catch(handleApiError),

    revokeSession: (clientId, userId, sessionId) =>
      api.delete(`/api/admin/clients/${clientId}/users/${userId}/sessions/${sessionId}`)
        .then(response => response.data)
        .catch(handleApiError),
  },

  // Webhook endpoints
  webhooks: {
    test: (clientId, webhookData) =>
      api.post(`/api/admin/clients/${clientId}/webhooks/test`, webhookData)
        .then(response => response.data)
        .catch(handleApiError),

    getLogs: (clientId, params = {}) =>
      api.get(`/api/admin/clients/${clientId}/webhooks/logs`, { params })
        .then(response => response.data)
        .catch(handleApiError),
  },

  // Analytics endpoints
  analytics: {
    getDashboardStats: () =>
      api.get('/api/admin/dashboard/stats')
        .then(response => response.data)
        .catch(handleApiError),

    getClientStats: (clientId, period = '30d') =>
      api.get(`/api/admin/clients/${clientId}/stats`, { params: { period } }) // Helper if stats route exists?
        .then(response => response.data)
        .catch(handleApiError),
    getLoginTrends: (clientId, period = '30d') =>
      api.get(`/api/admin/clients/${clientId}/analytics/logins`, { params: { period } })
        .then(response => response.data)
        .catch(handleApiError),
  },
};

// Export as both api and apiService for compatibility
export { api };
export const apiService = apiServiceObj;
export default apiServiceObj;