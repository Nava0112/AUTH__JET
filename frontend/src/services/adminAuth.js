import axios from 'axios';

class AdminAuthService {
  constructor() {
    this.tokenKey = 'authjet_admin_token';
    this.refreshTokenKey = 'authjet_admin_refresh_token';
    this.adminKey = 'authjet_admin_user';
    this.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
    
    // Create axios instance for admin API
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
            window.location.href = '/admin/login';
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

  setAdmin(admin) {
    localStorage.setItem(this.adminKey, JSON.stringify(admin));
  }

  getAdmin() {
    const adminStr = localStorage.getItem(this.adminKey);
    return adminStr ? JSON.parse(adminStr) : null;
  }

  clearToken() {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.refreshTokenKey);
    localStorage.removeItem(this.adminKey);
  }

  // Authentication methods
  async login(email, password) {
    try {
      const response = await this.api.post('/api/admin/login', {
        email,
        password
      });
      
      if (response.data.access_token) {
        this.setToken(response.data.access_token);
        this.setRefreshToken(response.data.refresh_token);
        this.setAdmin(response.data.admin);
      }
      
      return response.data;
    } catch (error) {
      this.clearToken();
      throw this.handleError(error);
    }
  }

  async register(email, password, name) {
    try {
      const response = await this.api.post('/api/admin/register', {
        email,
        password,
        name
      });
      
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async logout() {
    try {
      await this.api.post('/api/admin/logout');
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

      const response = await this.api.post('/api/admin/refresh-token', {
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
      const response = await this.api.get('/api/admin/profile');
      this.setAdmin(response.data.admin);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Platform management methods
  async getDashboardStats() {
    try {
      const response = await this.api.get('/api/admin/dashboard/stats');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getClients(params = {}) {
    try {
      const response = await this.api.get('/api/admin/clients', { params });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getClient(clientId) {
    try {
      const response = await this.api.get(`/api/admin/clients/${clientId}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateClient(clientId, updates) {
    try {
      const response = await this.api.put(`/api/admin/clients/${clientId}`, updates);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async suspendClient(clientId, reason) {
    try {
      const response = await this.api.post(`/api/admin/clients/${clientId}/suspend`, { reason });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async activateClient(clientId) {
    try {
      const response = await this.api.post(`/api/admin/clients/${clientId}/activate`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getSystemHealth() {
    try {
      const response = await this.api.get('/api/admin/system/health');
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

export const adminAuthService = new AdminAuthService();
