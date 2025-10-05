import axios from 'axios';

class ClientAuthService {
  constructor() {
    this.tokenKey = 'authjet_client_token';
    this.refreshTokenKey = 'authjet_client_refresh_token';
    this.clientKey = 'authjet_client_user';
    this.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
    
    // Create axios instance for client API
    this.api = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true,
    });

    // Request interceptor to add auth token
    this.api.interceptors.request.use(
      (config) => {
        const token = this.getToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor to handle token refresh
    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          
          try {
            await this.refreshToken();
            const token = this.getToken();
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return this.api(originalRequest);
          } catch (refreshError) {
            this.clearToken();
            window.location.href = '/client/login';
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  // Token management
  setToken(token) {
    localStorage.setItem(this.tokenKey, token);
  }

  getToken() {
    return localStorage.getItem(this.tokenKey);
  }

  setRefreshToken(refreshToken) {
    localStorage.setItem(this.refreshTokenKey, refreshToken);
  }

  getRefreshToken() {
    return localStorage.getItem(this.refreshTokenKey);
  }

  setClient(client) {
    localStorage.setItem(this.clientKey, JSON.stringify(client));
  }

  getClient() {
    const clientStr = localStorage.getItem(this.clientKey);
    return clientStr ? JSON.parse(clientStr) : null;
  }

  clearToken() {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.refreshTokenKey);
    localStorage.removeItem(this.clientKey);
  }

  // Authentication methods
  async register(clientData) {
    try {
      const response = await this.api.post('/api/client/register', clientData);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async login(email, password) {
    try {
      const response = await this.api.post('/api/client/login', {
        email,
        password
      });
      
      if (response.data.access_token) {
        this.setToken(response.data.access_token);
        this.setRefreshToken(response.data.refresh_token);
        this.setClient(response.data.client);
      }
      
      return response.data;
    } catch (error) {
      this.clearToken();
      throw this.handleError(error);
    }
  }

  async logout() {
    try {
      await this.api.post('/api/client/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.clearToken();
    }
  }

  async refreshToken() {
    try {
      const refreshToken = this.getRefreshToken();
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await this.api.post('/api/client/refresh-token', {
        refresh_token: refreshToken
      });
      
      if (response.data.access_token) {
        this.setToken(response.data.access_token);
        if (response.data.refresh_token) {
          this.setRefreshToken(response.data.refresh_token);
        }
        return response.data.access_token;
      }
      
      throw new Error('No access token in response');
    } catch (error) {
      this.clearToken();
      throw error;
    }
  }

  async getProfile() {
    try {
      const response = await this.api.get('/api/client/profile');
      this.setClient(response.data.client);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Dashboard methods
  async getDashboardStats() {
    try {
      const response = await this.api.get('/api/client/dashboard/stats');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Application management
  async getApplications(params = {}) {
    try {
      const response = await this.api.get('/api/client/applications', { params });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async createApplication(applicationData) {
    try {
      const response = await this.api.post('/api/client/applications', applicationData);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getApplication(applicationId) {
    try {
      const response = await this.api.get(`/api/client/applications/${applicationId}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateApplication(applicationId, updates) {
    try {
      const response = await this.api.put(`/api/client/applications/${applicationId}`, updates);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async deleteApplication(applicationId) {
    try {
      const response = await this.api.delete(`/api/client/applications/${applicationId}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async regenerateApplicationSecret(applicationId) {
    try {
      const response = await this.api.post(`/api/client/applications/${applicationId}/regenerate-secret`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // User management
  async getApplicationUsers(applicationId, params = {}) {
    try {
      const response = await this.api.get(`/api/client/applications/${applicationId}/users`, { params });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getApplicationUser(applicationId, userId) {
    try {
      const response = await this.api.get(`/api/client/applications/${applicationId}/users/${userId}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateApplicationUser(applicationId, userId, updates) {
    try {
      const response = await this.api.put(`/api/client/applications/${applicationId}/users/${userId}`, updates);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async deleteApplicationUser(applicationId, userId) {
    try {
      const response = await this.api.delete(`/api/client/applications/${applicationId}/users/${userId}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Analytics
  async getApplicationAnalytics(applicationId, params = {}) {
    try {
      const response = await this.api.get(`/api/client/applications/${applicationId}/analytics`, { params });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Billing
  async getCurrentBilling() {
    try {
      const response = await this.api.get('/api/client/billing/current');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async upgradePlan(planData) {
    try {
      const response = await this.api.post('/api/client/billing/upgrade', planData);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Utility methods
  isAuthenticated() {
    const token = this.getToken();
    if (!token) return false;

    try {
      // Basic token expiration check
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Date.now() / 1000;
      return payload.exp > currentTime;
    } catch {
      return false;
    }
  }

  getAuthHeaders() {
    const token = this.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  handleError(error) {
    if (error.response?.data?.error) {
      return new Error(error.response.data.error);
    } else if (error.request) {
      return new Error('Network error: Unable to connect to server');
    } else {
      return new Error(error.message || 'An unexpected error occurred');
    }
  }
}

export const clientAuthService = new ClientAuthService();
