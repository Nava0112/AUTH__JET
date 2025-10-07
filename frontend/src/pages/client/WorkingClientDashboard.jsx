import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const WorkingClientDashboard = () => {
  const [client, setClient] = useState(null);
  const [stats, setStats] = useState(null);
  const [applications, setApplications] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
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
      const token = localStorage.getItem('clientToken');
      if (!token) {
        throw new Error('No authentication token found. Please login again.');
      }
  
      const headers = {
        'Authorization': `Bearer ${token}`
      };
  
      const [statsResponse, appsResponse] = await Promise.all([
        fetch('http://localhost:8000/api/client/dashboard/stats', { headers }),
        fetch('http://localhost:8000/api/client/applications', { headers })
      ]);
      
      const statsData = await statsResponse.json();
      const appsData = await appsResponse.json();
      
      console.log('=== DASHBOARD DEBUG ===');
      console.log('Stats response:', statsData);
      console.log('Apps response:', appsData);
      console.log('=== END DEBUG ===');
      
      // Handle stats data
      if (statsResponse.ok) {
        // The backend might return stats directly or in a stats property
        setStats(statsData.stats || statsData);
      } else {
        throw new Error(statsData.error || 'Failed to fetch stats');
      }
      
      // Handle applications data - FIX THIS PART
      if (appsResponse.ok) {
        // The backend might return applications as 'clients' or 'applications'
        if (appsData.applications) {
          setApplications(appsData.applications);
        } else if (appsData.clients) {
          setApplications(appsData.clients);
        } else if (Array.isArray(appsData)) {
          setApplications(appsData);
        } else {
          setApplications([]); // Default to empty array
        }
      } else {
        throw new Error(appsData.error || 'Failed to fetch applications');
      }
      
    } catch (err) {
      setError('Failed to load dashboard data: ' + err.message);
      console.error('Dashboard fetch error:', err);
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
      const token = localStorage.getItem('clientToken');
      if (!token) {
        alert('No token found. Please login first.');
        return;
      }
  
      const response = await fetch(`http://localhost:8000/api/client/${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
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

        {/* Navigation Tabs */}
        <div className="bg-white shadow rounded-lg mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('overview')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'overview'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                📊 Overview
              </button>
              <button
                onClick={() => setActiveTab('applications')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'applications'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                🚀 Applications ({applications.length || stats?.totalApplications || 0})
              </button>
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              {/* My Applications */}
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
                        <dt className="text-sm font-medium text-gray-500 truncate">My Applications</dt>
                        <dd className="text-2xl font-bold text-gray-900">{stats?.totalApplications || applications.length || 0}</dd>
                        <dd className="text-xs text-gray-500">Active apps</dd>
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

              {/* Auth Modes */}
              <div className="bg-white overflow-hidden shadow rounded-lg border-l-4 border-purple-500">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="h-8 w-8 bg-purple-500 rounded-full flex items-center justify-center">
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

              {/* Quick Action */}
              <div className="bg-white overflow-hidden shadow rounded-lg border-l-4 border-orange-500">
                <div className="p-5">
                  <div className="flex items-center justify-center h-full">
                    <button
                      onClick={() => navigate('/client/create-application')}
                      className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-md text-sm font-medium transition-colors w-full"
                    >
                      ➕ Create App
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Client Overview */}
            <div className="bg-white shadow rounded-lg mb-8">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Your Applications Overview</h3>
                <p className="text-sm text-gray-500">Statistics for all your applications and users</p>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-600">{stats?.clientApplications || 0}</div>
                    <div className="text-sm text-gray-500">Applications Created</div>
                    <div className="text-xs text-gray-500 mt-1">Active and running</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600">{stats?.totalUsers || 0}</div>
                    <div className="text-sm text-gray-500">Total End Users</div>
                    <div className="text-xs text-green-600 mt-1">+{stats?.recentUsers || 0} this week</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-purple-600">
                      {Math.round((stats?.totalUsers || 0) / Math.max(stats?.clientApplications || 1, 1))}
                    </div>
                    <div className="text-sm text-gray-500">Avg Users per App</div>
                    <div className="text-xs text-gray-500 mt-1">Average engagement</div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'applications' && (
          <>
            {/* Applications Header */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM9 9a1 1 0 0 0 0 2v3a1 1 0 0 0 1 1h1a1 1 0 1 0 0-2v-3a1 1 0 0 0-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">Applications & User Statistics</h3>
                  <div className="mt-2 text-sm text-blue-700">
                    <p>You have <strong>{stats?.clientApplications || 0} applications</strong> with a total of <strong>{stats?.totalUsers || 0} users</strong> across all apps.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Applications List */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-900">Your Applications</h3>
                  <button
                    onClick={() => navigate('/client/create-application')}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                  >
                    Create New App
                  </button>
                </div>
              </div>
              <div className="divide-y divide-gray-200">
                {applications.length === 0 ? (
                  <div className="p-6 text-center">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No applications</h3>
                    <p className="mt-1 text-sm text-gray-500">Get started by creating your first application.</p>
                    <div className="mt-6">
                      <button
                        onClick={() => navigate('/client/create-application')}
                        className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                      >
                        Create Application
                      </button>
                    </div>
                  </div>
                ) : (
                  applications.map((app) => (
                    <div key={app.id} className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="flex-shrink-0">
                            <div className="h-10 w-10 bg-indigo-500 rounded-lg flex items-center justify-center">
                              <span className="text-white font-medium text-sm">
                                {app.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="flex items-center">
                              <h4 className="text-lg font-medium text-gray-900">{app.name}</h4>
                              <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                app.authMode === 'advanced' 
                                  ? 'bg-purple-100 text-purple-800' 
                                  : 'bg-green-100 text-green-800'
                              }`}>
                                {app.authMode}
                              </span>
                            </div>
                            <p className="text-sm text-gray-500">{app.description || 'No description'}</p>
                            <div className="mt-2 flex items-center text-sm text-gray-500">
                              <svg className="flex-shrink-0 mr-1.5 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                              </svg>
                              <span className="font-medium text-indigo-600">{app.userCount} users</span>
                              <span className="mx-2">•</span>
                              <span>Created {new Date(app.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <div className="text-2xl font-bold text-indigo-600">{app.userCount}</div>
                            <div className="text-xs text-gray-500">Total Users</div>
                          </div>
                          <button className="text-indigo-600 hover:text-indigo-900 text-sm font-medium">
                            Manage →
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}

        {/* Quick Actions */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Quick Actions</h3>
            <p className="text-sm text-gray-500">Manage your applications and settings</p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <button
                onClick={() => navigate('/client/create-application')}
                className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-4 py-3 rounded-md text-sm font-medium transition-colors"
              >
                🚀 Create App
              </button>
              <button
                onClick={() => setActiveTab('applications')}
                className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-4 py-3 rounded-md text-sm font-medium transition-colors"
              >
                📱 View Apps
              </button>
              <button
                onClick={() => testEndpoint('profile', 'Client Profile')}
                className="bg-green-50 hover:bg-green-100 text-green-700 px-4 py-3 rounded-md text-sm font-medium transition-colors"
              >
                View Profile
              </button>
              <button
                onClick={() => alert('Analytics feature coming soon!')}
                className="bg-purple-50 hover:bg-purple-100 text-purple-700 px-4 py-3 rounded-md text-sm font-medium transition-colors"
              >
                📊 Analytics
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkingClientDashboard;
