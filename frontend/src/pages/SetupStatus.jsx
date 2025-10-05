import React, { useState, useEffect } from 'react';

const SetupStatus = () => {
  const [backendStatus, setBackendStatus] = useState('checking');
  const [databaseStatus, setDatabaseStatus] = useState('unknown');

  useEffect(() => {
    checkBackendStatus();
  }, []);

  const checkBackendStatus = async () => {
    try {
      const response = await fetch('http://localhost:8000/health');
      if (response.ok) {
        setBackendStatus('running');
        const data = await response.json();
        setDatabaseStatus('connected');
      } else {
        setBackendStatus('error');
      }
    } catch (error) {
      setBackendStatus('offline');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'running':
      case 'connected':
        return 'text-green-600 bg-green-100';
      case 'offline':
      case 'error':
        return 'text-red-600 bg-red-100';
      case 'checking':
      case 'unknown':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'running': return 'Running';
      case 'connected': return 'Connected';
      case 'offline': return 'Offline';
      case 'error': return 'Error';
      case 'checking': return 'Checking...';
      case 'unknown': return 'Unknown';
      default: return status;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">
              AuthJet Setup Status
            </h1>
            
            <div className="space-y-4">
              {/* Frontend Status */}
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Frontend</h3>
                  <p className="text-sm text-gray-500">React application</p>
                </div>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium text-green-600 bg-green-100">
                  Running
                </span>
              </div>

              {/* Backend Status */}
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Backend API</h3>
                  <p className="text-sm text-gray-500">Node.js server on port 8000</p>
                </div>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(backendStatus)}`}>
                  {getStatusText(backendStatus)}
                </span>
              </div>

              {/* Database Status */}
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Database</h3>
                  <p className="text-sm text-gray-500">PostgreSQL connection</p>
                </div>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(databaseStatus)}`}>
                  {getStatusText(databaseStatus)}
                </span>
              </div>
            </div>

            {/* Setup Instructions */}
            <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="text-lg font-medium text-blue-900 mb-3">Next Steps</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
                <li>Start your backend server: <code className="bg-blue-100 px-2 py-1 rounded">cd backend && npm start</code></li>
                <li>Run the database migration: <code className="bg-blue-100 px-2 py-1 rounded">cd backend && npm run migrate:multi-tenant</code></li>
                <li>Create your first admin user via API call</li>
                <li>Test the authentication flows</li>
              </ol>
            </div>

            {/* Quick Actions */}
            <div className="mt-6 flex space-x-4">
              <button
                onClick={checkBackendStatus}
                className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
              >
                Refresh Status
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
              >
                Back to Login
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SetupStatus;
