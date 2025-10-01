import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const WorkingClientDashboard = () => {
  const [client, setClient] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // Check if client is logged in
    const clientData = localStorage.getItem('client');
    if (!clientData) {
      navigate('/');
      return;
    }
    
    setClient(JSON.parse(clientData));
    fetchDashboardStats();
  }, [navigate]);

  const fetchDashboardStats = async () => {
    try {
      const response = await fetch('http://localhost:5000/api/client/dashboard/stats');
      const data = await response.json();
      
      if (response.ok) {
        setStats(data.stats || data);
      } else {
        throw new Error('Failed to fetch stats');
      }
    } catch (err) {
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('client');
    navigate('/');
  };

  const testEndpoint = async (endpoint, name) => {
    try {
      const response = await fetch(`http://localhost:5000/api/client/${endpoint}`);
      const data = await response.json();
      alert(`${name} Response:\n${JSON.stringify(data, null, 2)}`);
    } catch (err) {
      alert(`${name} Error: ${err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-500"></div>
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
                <div className="h-8 w-8 bg-indigo-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-sm">
                    {client?.organizationName?.charAt(0) || 'C'}
                  </span>
                </div>
              </div>
              <div className="ml-4">
                <h1 className="text-2xl font-bold text-gray-900">
                  {client?.organizationName || 'Organization'} Dashboard
                </h1>
                <p className="text-sm text-gray-500">Client Organization Portal</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">Welcome, {client?.name}</span>
              <button
                onClick={handleLogout}
                className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm hover:bg-indigo-700"
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

        {/* Welcome Section */}
        <div className="bg-white shadow rounded-lg mb-8 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Welcome to AuthJet
              </h2>
              <p className="text-gray-600 mt-1">
                Manage your applications, users, and authentication settings
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Plan</p>
              <p className="text-lg font-medium text-indigo-600 capitalize">
                {client?.planType || 'Basic'}
              </p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Applications</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats?.totalApplications || 0}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Users</dt>
                    <dd className="text-lg font-medium text-gray-900">{stats?.totalUsers || 0}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Status</dt>
                    <dd className="text-lg font-medium text-green-600">Active</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white shadow rounded-lg mb-8">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <button
                onClick={() => navigate('/client/create-application')}
                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-4 py-2 rounded-md text-sm font-medium"
              >
                Create App
              </button>
              <button
                onClick={() => testEndpoint('applications', 'Applications List')}
                className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-4 py-2 rounded-md text-sm font-medium"
              >
                View Apps
              </button>
              <button
                onClick={() => testEndpoint('profile', 'Client Profile')}
                className="bg-green-50 hover:bg-green-100 text-green-700 px-4 py-2 rounded-md text-sm font-medium"
              >
                View Profile
              </button>
              <button
                onClick={() => alert('Analytics feature coming soon!')}
                className="bg-purple-50 hover:bg-purple-100 text-purple-700 px-4 py-2 rounded-md text-sm font-medium"
              >
                Analytics
              </button>
            </div>
          </div>
        </div>

        {/* Getting Started */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Getting Started</h3>
            <div className="space-y-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-8 w-8 rounded-full bg-indigo-100">
                    <span className="text-sm font-medium text-indigo-600">1</span>
                  </div>
                </div>
                <div className="ml-4">
                  <h4 className="text-sm font-medium text-gray-900">Create Your First Application</h4>
                  <p className="text-sm text-gray-500">Set up an application to start authenticating users</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-8 w-8 rounded-full bg-gray-100">
                    <span className="text-sm font-medium text-gray-600">2</span>
                  </div>
                </div>
                <div className="ml-4">
                  <h4 className="text-sm font-medium text-gray-900">Configure Authentication</h4>
                  <p className="text-sm text-gray-500">Set up login methods and user management</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-8 w-8 rounded-full bg-gray-100">
                    <span className="text-sm font-medium text-gray-600">3</span>
                  </div>
                </div>
                <div className="ml-4">
                  <h4 className="text-sm font-medium text-gray-900">Integrate with Your App</h4>
                  <p className="text-sm text-gray-500">Use our SDKs and APIs to add authentication</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Organization Info */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-center">
            <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">Organization Information</h3>
              <div className="mt-2 text-sm text-blue-700">
                <p><strong>Organization:</strong> {client?.organizationName}</p>
                <p><strong>Contact:</strong> {client?.name} ({client?.email})</p>
                <p><strong>Plan:</strong> {client?.planType || 'Basic'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkingClientDashboard;
