import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import SimpleClientLogin from '../../pages/client/SimpleClientLogin';
import SetupStatus from '../../pages/SetupStatus';
import WorkingAdminLogin from '../../pages/admin/WorkingAdminLogin';
import WorkingAdminRegister from '../../pages/admin/WorkingAdminRegister';
import WorkingAdminDashboard from '../../pages/admin/WorkingAdminDashboard';
import WorkingClientRegister from '../../pages/client/WorkingClientRegister';
import WorkingClientDashboard from '../../pages/client/WorkingClientDashboard';
import CreateApplication from '../../pages/client/CreateApplication';

// Import the new user pages we created
import UserLogin from '../../pages/user/UserLogin';
import UserRegister from '../../pages/user/UserRegister';
import VerifyEmail from '../../pages/user/VerifyEmail';
import UserProfile from '../../pages/user/UserProfile';
import RoleManagement from '../../pages/user/RoleManagement';
import ForgotPassword from '../../pages/ForgotPassword';

// Simple fallback components
const ComingSoon = ({ title = "Coming Soon" }) => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">{title}</h2>
      <p className="text-gray-600 mb-4">This feature is coming soon! Backend is operational.</p>
      <div className="space-y-2">
        <button
          onClick={() => window.location.href = '/'}
          className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 mr-2"
        >
          Back to Login
        </button>
        <button
          onClick={() => window.location.href = '/admin/login'}
          className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
        >
          Admin Portal
        </button>
      </div>
    </div>
  </div>
);

const NotFound = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Page Not Found</h2>
      <div className="space-y-3">
        <button
          onClick={() => window.location.href = '/'}
          className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 block w-full"
        >
          Go to Client Login
        </button>
        <button
          onClick={() => window.location.href = '/user/login?client_id=cli_demo1234567890ab&application_id=1'}
          className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 block w-full"
        >
          Test User Login
        </button>
      </div>
    </div>
  </div>
);

const BasicRouter = () => {
  return (
    <Routes>
      {/* Base route - Client Login */}
      <Route path="/" element={<SimpleClientLogin />} />

      {/* Client Routes (Organizations using AuthJet) */}
      <Route path="/client/login" element={<SimpleClientLogin />} />
      <Route path="/client/register" element={<WorkingClientRegister />} />
      <Route path="/client/dashboard" element={<WorkingClientDashboard />} />
      <Route path="/client/create-application" element={<CreateApplication />} />
      <Route path="/client/forgot-password" element={<ForgotPassword />} />

      {/* Admin Routes (AuthJet Platform Admins) */}
      <Route path="/admin/login" element={<WorkingAdminLogin />} />
      <Route path="/admin/register" element={<WorkingAdminRegister />} />
      <Route path="/admin/dashboard" element={<WorkingAdminDashboard />} />
      <Route path="/admin/forgot-password" element={<ForgotPassword />} />

      {/* 👇 NEW: User Routes (End-users of your clients' apps) */}
      <Route path="/user/login" element={<UserLogin />} />
      <Route path="/user/register" element={<UserRegister />} />
      <Route path="/user/verify-email" element={<VerifyEmail />} />
      <Route path="/user/profile" element={<UserProfile />} />
      <Route path="/user/roles" element={<RoleManagement />} />

      {/* Setup and Status Pages */}
      <Route path="/setup" element={<SetupStatus />} />
      <Route path="/status" element={<SetupStatus />} />

      {/* Landing Page */}
      <Route path="/landing" element={<ComingSoon title="Landing Page" />} />

      {/* Legacy Routes */}
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/register" element={<Navigate to="/client/register" replace />} />
      <Route path="/dashboard" element={<Navigate to="/client/dashboard" replace />} />

      {/* 404 Route */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default BasicRouter;