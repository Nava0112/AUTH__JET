import { apiService } from './api';

class AuthService {
  constructor() {
    this.tokenKey = 'authjet_token';
    this.refreshTokenKey = 'authjet_refresh_token';
    this.userKey = 'authjet_user';
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

  setUser(user) {
    localStorage.setItem(this.userKey, JSON.stringify(user));
  }

  getUser() {
    const userStr = localStorage.getItem(this.userKey);
    return userStr ? JSON.parse(userStr) : null;
  }

  clearToken() {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.refreshTokenKey);
    localStorage.removeItem(this.userKey);
  }

  // Authentication methods
  async login(email, password) {
    try {
      const response = await apiService.auth.login(email, password);
      
      if (response.access_token) {
        this.setToken(response.access_token);
        this.setRefreshToken(response.refresh_token);
        this.setUser(response.user);
      }
      
      return response;
    } catch (error) {
      this.clearToken();
      throw error;
    }
  }

  async signup(email, password) {
    try {
      const response = await apiService.auth.register(email, password);
      
      if (response.access_token) {
        this.setToken(response.access_token);
        this.setRefreshToken(response.refresh_token);
        this.setUser(response.user);
      }
      
      return response;
    } catch (error) {
      this.clearToken();
      throw error;
    }
  }

  async logout() {
    try {
      const refreshToken = this.getRefreshToken();
      if (refreshToken) {
        await apiService.auth.logout({ refresh_token: refreshToken });
      }
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

      const response = await apiService.auth.refreshToken({ refresh_token: refreshToken });
      
      if (response.access_token) {
        this.setToken(response.access_token);
        if (response.refresh_token) {
          this.setRefreshToken(response.refresh_token);
        }
        return response.access_token;
      }
      
      throw new Error('No access token in response');
    } catch (error) {
      this.clearToken();
      throw error;
    }
  }

  async getCurrentUser() {
    try {
      const response = await apiService.auth.getCurrentUser();
      this.setUser(response.user);
      return response;
    } catch (error) {
      this.clearToken();
      throw error;
    }
  }

  async verifyToken(token) {
    return await apiService.auth.verifyToken(token);
  }

  // Utility methods
  isAuthenticated() {
    const token = this.getToken();
    if (!token) return false;

    try {
      // Basic token expiration check (without parsing JWT)
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

  // OAuth methods
  startOAuthFlow(provider) {
    const state = Math.random().toString(36).substring(2);
    const nonce = Math.random().toString(36).substring(2);
    
    localStorage.setItem('oauth_state', state);
    localStorage.setItem('oauth_nonce', nonce);

    const params = new URLSearchParams({
      client_id: process.env.REACT_APP_OAUTH_CLIENT_ID,
      redirect_uri: `${window.location.origin}/oauth/callback`,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      nonce,
    });

    const oauthUrls = {
      google: `https://accounts.google.com/o/oauth2/v2/auth?${params}`,
      github: `https://github.com/login/oauth/authorize?${params}`,
    };

    window.location.href = oauthUrls[provider];
  }

  handleOAuthCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const storedState = localStorage.getItem('oauth_state');

    if (!code || !state || state !== storedState) {
      throw new Error('Invalid OAuth response');
    }

    localStorage.removeItem('oauth_state');
    localStorage.removeItem('oauth_nonce');

    return this.exchangeOAuthCode(code);
  }

  async exchangeOAuthCode(code) {
    // This would be handled by your backend
    const response = await apiService.auth.oauthExchange({ code });
    
    if (response.access_token) {
      this.setToken(response.access_token);
      this.setRefreshToken(response.refresh_token);
      this.setUser(response.user);
    }
    
    return response;
  }
}

export const authService = new AuthService();