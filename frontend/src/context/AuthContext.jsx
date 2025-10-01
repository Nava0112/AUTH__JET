import React, { createContext, useContext, useReducer, useEffect, useRef, useCallback, useMemo } from 'react';
import { authService } from '../services/auth';
import { api } from '../services/api';

const AuthContext = createContext();

// Auth state reducer
const authReducer = (state, action) => {
  switch (action.type) {
    case 'AUTH_START':
      return { ...state, isLoading: true, error: null };
    
    case 'AUTH_SUCCESS':
      return {
        ...state,
        isLoading: false,
        isAuthenticated: true,
        user: action.payload.user,
        client: action.payload.client,
        error: null,
      };
    
    case 'AUTH_FAILURE':
      return {
        ...state,
        isLoading: false,
        isAuthenticated: false,
        user: null,
        client: null,
        error: action.payload,
      };
    
    case 'AUTH_LOGOUT':
      return {
        ...state,
        isLoading: false,
        isAuthenticated: false,
        user: null,
        client: null,
        error: null,
      };
    
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    
    default:
      return state;
  }
};

const initialState = {
  isAuthenticated: false,
  isLoading: true,
  user: null,
  client: null,
  error: null,
};

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  const checkingRef = useRef(false);

  const checkAuthStatus = useCallback(async () => {
    if (checkingRef.current) return;
    checkingRef.current = true;
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      const token = authService.getToken();
      
      if (!token) {
        dispatch({ type: 'AUTH_LOGOUT' });
        return;
      }

      // Verify token is still valid
      const userData = await authService.getCurrentUser();
      
      dispatch({
        type: 'AUTH_SUCCESS',
        payload: {
          user: userData.user,
          client: userData.client,
        },
      });
    } catch (error) {
      authService.clearToken();
      dispatch({ type: 'AUTH_LOGOUT' });
    } finally {
      checkingRef.current = false;
    }
  }, [dispatch]);

  // Check authentication status on app start
  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  const login = useCallback(async (email, password) => {
    try {
      dispatch({ type: 'AUTH_START' });
      
      const response = await authService.login(email, password);
      
      dispatch({
        type: 'AUTH_SUCCESS',
        payload: {
          user: response.user,
          client: response.client,
        },
      });
      
      return response;
    } catch (error) {
      dispatch({
        type: 'AUTH_FAILURE',
        payload: error.message,
      });
      throw error;
    }
  }, [dispatch]);

  const signup = useCallback(async (email, password) => {
    try {
      dispatch({ type: 'AUTH_START' });
      
      const response = await authService.signup(email, password);
      
      dispatch({
        type: 'AUTH_SUCCESS',
        payload: {
          user: response.user,
          client: response.client,
        },
      });
      
      return response;
    } catch (error) {
      dispatch({
        type: 'AUTH_FAILURE',
        payload: error.message,
      });
      throw error;
    }
  }, [dispatch]);

  const loginWithOAuth = useCallback((provider) => {
    // Redirect to OAuth provider
    const oauthUrl = `${process.env.REACT_APP_API_URL}/api/auth/oauth/${provider}`;
    window.location.href = oauthUrl;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      authService.clearToken();
      dispatch({ type: 'AUTH_LOGOUT' });
    }
  }, [dispatch]);

  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, [dispatch]);

  const value = useMemo(() => ({
    ...state,
    login,
    signup,
    loginWithOAuth,
    logout,
    clearError,
    checkAuthStatus,
  }), [state, login, signup, loginWithOAuth, logout, clearError, checkAuthStatus]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
};