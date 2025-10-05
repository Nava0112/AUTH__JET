import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { clientAuthService } from '../../services/clientAuth';

const ClientProtectedRoute = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthentication();
  }, []);

  const checkAuthentication = async () => {
    try {
      // Check if token exists and is valid
      if (!clientAuthService.isAuthenticated()) {
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }

      // Verify token with server
      await clientAuthService.getProfile();
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Client authentication check failed:', error);
      clientAuthService.clearToken();
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto"></div>
          <p className="mt-4 text-sm text-gray-600">Verifying client access...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/client/login" replace />;
  }

  return children;
};

export default ClientProtectedRoute;
