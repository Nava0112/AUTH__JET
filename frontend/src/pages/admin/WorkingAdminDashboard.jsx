import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const WorkingAdminDashboard = () => {
  const [admin, setAdmin] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // Check if admin is logged in
    const adminData = localStorage.getItem('admin');
    if (!adminData) {
      navigate('/admin/login');
      return;
    }
    
    setAdmin(JSON.parse(adminData));
    fetchDashboardStats();
  }, [navigate]);

  const fetchDashboardStats = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/dashboard/admin/stats');
      const data = await response.json();
      
      if (response.ok && data.success) {
        setStats(data.stats);
      } else {
        throw new Error(data.error || 'Failed to fetch stats');
      }
    } catch (err) {
      setError('Failed to load dashboard data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin');
    navigate('/admin/login');
  };

  const testEndpoint = async (endpoint, name) => {
    try {
      const response = await fetch(`http://localhost:5000/api/admin/${endpoint}`);
      const data = await response.json();
      alert(`${name} Response:\n${JSON.stringify(data, null, 2)}`);
    } catch (err) {
      alert(`${name} Error: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-red-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 bg-red-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-sm">A</span>
                </div>
              </div>
              <div className="ml-4">
                <h1 className="text-2xl font-bold text-gray-900">AuthJet Admin Dashboard</h1>
                <p className="text-sm text-gray-500">Platform Management Console</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">Welcome, {admin?.name}</span>
              <button
                onClick={handleLogout}
                className="bg-red-600 text-white px-4 py-2 rounded-md text-sm hover:bg-red-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Main Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {/* Total Applications */}
          <div className="bg-white overflow-hidden shadow rounded-lg border-l-4 border-blue-500">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 bg-blue-500 rounded-full flex items-center justify-center">
                    <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Applications</dt>
                    <dd className="text-2xl font-bold text-gray-900">{stats?.totalApplications || 0}</dd>
                    <dd className="text-xs text-green-600">+{stats?.recentApplications || 0} this week</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          {/* Total Users */}
          <div className="bg-white overflow-hidden shadow rounded-lg border-l-4 border-green-500">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 bg-green-500 rounded-full flex items-center justify-center">
                    <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Users</dt>
                    <dd className="text-2xl font-bold text-gray-900">{stats?.totalUsers || 0}</dd>
                    <dd className="text-xs text-green-600">+{stats?.recentUsers || 0} this week</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          {/* Total Clients */}
          <div className="bg-white overflow-hidden shadow rounded-lg border-l-4 border-purple-500">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 bg-purple-500 rounded-full flex items-center justify-center">
                    <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Clients</dt>
                    <dd className="text-2xl font-bold text-gray-900">{stats?.totalClients || 0}</dd>
                    <dd className="text-xs text-gray-500">Organizations</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          {/* Auth Modes */}
          <div className="bg-white overflow-hidden shadow rounded-lg border-l-4 border-orange-500">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 bg-orange-500 rounded-full flex items-center justify-center">
                    <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Auth Modes</dt>
                    <dd className="text-sm font-medium text-gray-900">
                      Basic: {stats?.authModes?.basic || 0} | Advanced: {stats?.authModes?.advanced || 0}
                    </dd>
                    <dd className="text-xs text-gray-500">Authentication types</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Platform Overview */}
        <div className="bg-white shadow rounded-lg mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Platform Overview</h3>
            <p className="text-sm text-gray-500">Complete statistics across all client applications</p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">{stats?.totalApplications || 0}</div>
                <div className="text-sm text-gray-500">Applications Created</div>
                <div className="text-xs text-green-600 mt-1">+{stats?.recentApplications || 0} this week</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">{stats?.totalUsers || 0}</div>
                <div className="text-sm text-gray-500">End Users Registered</div>
                <div className="text-xs text-green-600 mt-1">+{stats?.recentUsers || 0} this week</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600">{stats?.totalClients || 0}</div>
                <div className="text-sm text-gray-500">Client Organizations</div>
                <div className="text-xs text-gray-500 mt-1">Active accounts</div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Quick Actions</h3>
            <p className="text-sm text-gray-500">Administrative tools and system management</p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <button
                onClick={() => testEndpoint('clients', 'Clients List')}
                className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-4 py-3 rounded-md text-sm font-medium transition-colors"
              >
                📊 View Clients
              </button>
              <button
                onClick={() => testEndpoint('profile', 'Admin Profile')}
                className="bg-green-50 hover:bg-green-100 text-green-700 px-4 py-3 rounded-md text-sm font-medium transition-colors"
              >
                👤 Admin Profile
              </button>
              <button
                onClick={() => testEndpoint('system/health', 'System Health')}
                className="bg-purple-50 hover:bg-purple-100 text-purple-700 px-4 py-3 rounded-md text-sm font-medium transition-colors"
              >
                ⚡ System Health
              </button>
              <button
                onClick={() => testEndpoint('analytics/overview', 'Analytics')}
                className="bg-yellow-50 hover:bg-yellow-100 text-yellow-700 px-4 py-3 rounded-md text-sm font-medium transition-colors"
              >
                📈 Analytics
              </button>
            </div>
          </div>
        </div>
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">System Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-2">Backend Status</h4>
                <div className="flex items-center">
                  <div className="h-2 w-2 bg-green-400 rounded-full mr-2"></div>
                  <span className="text-sm text-gray-900">Connected to http://localhost:5000</span>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-2">Database Status</h4>
                <div className="flex items-center">
                  <div className="h-2 w-2 bg-green-400 rounded-full mr-2"></div>
                  <span className="text-sm text-gray-900">PostgreSQL Connected</span>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-2">Admin Account</h4>
                <p className="text-sm text-gray-900">{admin?.email}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-2">Platform Version</h4>
                <p className="text-sm text-gray-900">AuthJet v1.0.0</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkingAdminDashboard;
