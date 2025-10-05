import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import SimpleClientLogin from '../../pages/client/SimpleClientLogin';

// Direct imports with error handling
let ClientLogin, ClientRegister, ClientDashboard, AdminLogin, LandingPage;

try {
  ClientLogin = require('../../pages/client/ClientLogin').default;
} catch (e) {
  console.warn('ClientLogin not found, using fallback');
  ClientLogin = SimpleClientLogin;
}

try {
  ClientRegister = require('../../pages/client/ClientRegister').default;
} catch (e) {
  console.warn('ClientRegister not found, using fallback');
  ClientRegister = () => <Navigate to="/" replace />;
}

try {
  ClientDashboard = require('../../pages/client/ClientDashboard').default;
} catch (e) {
  console.warn('ClientDashboard not found, using fallback');
  ClientDashboard = () => <Navigate to="/" replace />;
}

try {
  AdminLogin = require('../../pages/admin/AdminLogin').default;
} catch (e) {
  console.warn('AdminLogin not found, using fallback');
  AdminLogin = () => <Navigate to="/" replace />;
}

try {
  LandingPage = require('../../pages/LandingPage').default;
} catch (e) {
  console.warn('LandingPage not found, using fallback');
  LandingPage = SimpleClientLogin;
}

// Loading component
const Loading = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-500"></div>
  </div>
);

// Simple error fallback
const NotFound = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Page Not Found</h2>
      <button
        onClick={() => window.location.href = '/'}
        className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
      >
        Go to Login
      </button>
    </div>
  </div>
);

const SafeMultiTenantRouter = () => {
  return (
    <Routes>
      {/* Base route - Client Login */}
      <Route path="/" element={<ClientLogin />} />
      
      {/* Client Routes */}
      <Route path="/client/login" element={<ClientLogin />} />
      <Route path="/client/register" element={<ClientRegister />} />
      <Route path="/client/dashboard" element={<ClientDashboard />} />
      
      {/* Admin Routes */}
      <Route path="/admin/login" element={<AdminLogin />} />
      
      {/* Landing Page */}
      <Route path="/landing" element={<LandingPage />} />
      
      {/* Legacy Routes */}
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/register" element={<Navigate to="/client/register" replace />} />
      <Route path="/dashboard" element={<Navigate to="/client/dashboard" replace />} />
      
      {/* 404 Route */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default SafeMultiTenantRouter;
