import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { adminAuthService } from '../../services/adminAuth';

const AdminProtectedRoute = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthentication();
  }, []);

  const checkAuthentication = async () => {
    try {
      // Check if token exists and is valid
      if (!adminAuthService.isAuthenticated()) {
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }

      // Verify token with server
      await adminAuthService.getProfile();
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Admin authentication check failed:', error);
      adminAuthService.clearToken();
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
          <p className="mt-4 text-sm text-gray-600">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  return children;
};

export default AdminProtectedRoute;
