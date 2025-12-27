import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const WorkingClientDashboard = () => {
  const [client, setClient] = useState(null);
  const [stats, setStats] = useState(null);
  const [applications, setApplications] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // JWKS Modal state
  const [selectedApp, setSelectedApp] = useState(null);
  const [jwks, setJwks] = useState(null);
  const [jwksLoading, setJwksLoading] = useState(false);

  const navigate = useNavigate();

  const fetchJwks = async (appId) => {
    setJwksLoading(true);
    setJwks(null);
    try {
      const token = localStorage.getItem('clientToken');
      const response = await fetch(`http://localhost:8000/api/client/applications/${appId}/jwks`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      setJwks(data.keys || data);
    } catch (err) {
      console.error('Failed to fetch JWKS:', err);
      setJwks({ error: 'Failed to load JWKS' });
    } finally {
      setJwksLoading(false);
    }
  };

  const handleGenerateKeys = async (appId) => {
    setJwksLoading(true);
    try {
      const token = localStorage.getItem('clientToken');
      const response = await fetch(`http://localhost:8000/api/client/applications/${appId}/keys/rotate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to generate keys');
      }

      // Refresh JWKS after generation
      await fetchJwks(appId);
      alert('RSA Keys generated successfully for ' + selectedApp.name);
    } catch (err) {
      console.error('Failed to generate keys:', err);
      alert('Error generating keys: ' + err.message);
    } finally {
      setJwksLoading(false);
    }
  };

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
                className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'overview'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                📊 Overview
              </button>
              <button
                onClick={() => setActiveTab('applications')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'applications'
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
                              <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${app.authMode === 'advanced'
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
                          <div className="flex flex-col space-y-2">
                            <button
                              onClick={() => navigate(`/client/applications/${app.id}`)}
                              className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                            >
                              Manage →
                            </button>
                            <button
                              onClick={() => {
                                setSelectedApp(app);
                                fetchJwks(app.id);
                              }}
                              className="text-gray-600 hover:text-gray-900 text-sm font-medium bg-gray-100 px-2 py-1 rounded"
                            >
                              🔑 JWKS
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* JWKS Modal */}
            {selectedApp && (
              <div className="fixed inset-0 z-10 overflow-y-auto">
                <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                  <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                    <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={() => setSelectedApp(null)}></div>
                  </div>
                  <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                  <div className="inline-block align-middle bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
                    <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                      <div className="sm:flex sm:items-start">
                        <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                          <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                            JWKS for {selectedApp.name}
                          </h3>
                          <div className="mt-4">
                            <p className="text-sm text-gray-500 mb-4">
                              Use this JSON Web Key Set to verify JWTs signed by this application.
                            </p>
                            <div className="bg-gray-900 rounded-md p-4 overflow-x-auto relative">
                              <pre className="text-green-400 text-xs font-mono">
                                {jwksLoading ? '// Loading JWKS...' : (
                                  (!jwks || (Array.isArray(jwks) && jwks.length === 0))
                                    ? '// No keys found. Click "Generate Keys" below.'
                                    : JSON.stringify(jwks, null, 2)
                                )}
                              </pre>
                            </div>

                            {(!jwks || (Array.isArray(jwks) && jwks.length === 0)) && !jwksLoading && (
                              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
                                <div className="flex">
                                  <div className="flex-shrink-0">
                                    <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                  </div>
                                  <div className="ml-3">
                                    <h3 className="text-sm font-medium text-yellow-800">No RSA Keys Active</h3>
                                    <div className="mt-2 text-sm text-yellow-700">
                                      <p>This application does not have any active RSA keys. Secure JWT signing will not work until keys are generated.</p>
                                    </div>
                                    <div className="mt-4">
                                      <button
                                        onClick={() => handleGenerateKeys(selectedApp.id)}
                                        className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-yellow-900 bg-yellow-100 hover:bg-yellow-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                                      >
                                        ✨ Generate RSA Keys Now
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                            <div className="mt-4 flex flex-col space-y-2">
                              <label className="text-sm font-medium text-gray-700">JWKS Endpoint URL</label>
                              <div className="flex">
                                <input
                                  type="text"
                                  readOnly
                                  value={`http://localhost:8000/.well-known/jwks/${selectedApp.id}.json`}
                                  className="flex-1 bg-gray-50 border border-gray-300 rounded-l-md px-3 py-2 text-sm font-mono"
                                />
                                <button
                                  onClick={() => navigator.clipboard.writeText(`http://localhost:8000/.well-known/jwks/${selectedApp.id}.json`)}
                                  className="bg-indigo-600 text-white px-4 py-2 rounded-r-md text-sm hover:bg-indigo-700"
                                >
                                  Copy
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                      <button
                        onClick={() => setSelectedApp(null)}
                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
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
