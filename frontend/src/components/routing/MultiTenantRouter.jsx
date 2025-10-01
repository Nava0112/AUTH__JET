import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Admin Components
import AdminLogin from '../../pages/admin/AdminLogin';
import AdminDashboard from '../../pages/admin/AdminDashboard';
import AdminProtectedRoute from './AdminProtectedRoute';

// Client Components
import ClientLogin from '../../pages/client/ClientLogin';
import ClientRegister from '../../pages/client/ClientRegister';
import ClientDashboard from '../../pages/client/ClientDashboard';
import ClientProtectedRoute from './ClientProtectedRoute';

// Public Components
import LandingPage from '../../pages/LandingPage';
import NotFound from '../../pages/NotFound';

const MultiTenantRouter = () => {
  return (
    <Routes>
      {/* Base route - Client Login */}
      <Route path="/" element={<ClientLogin />} />
      
      {/* Public Routes */}
      <Route path="/landing" element={<LandingPage />} />
      
      {/* Admin Routes */}
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route 
        path="/admin/dashboard" 
        element={
          <AdminProtectedRoute>
            <AdminDashboard />
          </AdminProtectedRoute>
        } 
      />
      <Route 
        path="/admin/*" 
        element={
          <AdminProtectedRoute>
            <AdminDashboard />
          </AdminProtectedRoute>
        } 
      />
      
      {/* Client Routes */}
      <Route path="/client/login" element={<ClientLogin />} />
      <Route path="/client/register" element={<ClientRegister />} />
      <Route 
        path="/client/dashboard" 
        element={
          <ClientProtectedRoute>
            <ClientDashboard />
          </ClientProtectedRoute>
        } 
      />
      <Route 
        path="/client/*" 
        element={
          <ClientProtectedRoute>
            <ClientDashboard />
          </ClientProtectedRoute>
        } 
      />
      
      {/* Legacy Routes (redirect to appropriate login) */}
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/register" element={<Navigate to="/client/register" replace />} />
      <Route path="/dashboard" element={<Navigate to="/client/dashboard" replace />} />
      
      {/* 404 Route */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default MultiTenantRouter;
