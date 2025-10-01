import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api';

const ApiKeys = ({ clientId }) => {
  const [client, setClient] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  useEffect(() => {
    fetchClient();
  }, [clientId]);

  const fetchClient = async () => {
    try {
      setIsLoading(true);
      const response = await apiService.clients.get(clientId);
      setClient(response.client);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegenerateKeys = async () => {
    if (!window.confirm('Are you sure you want to regenerate API keys? This will invalidate the current keys and require updating all integrations.')) {
      return;
    }

    try {
      setIsRegenerating(true);
      const response = await apiService.clients.regenerateApiKey(clientId);
      setClient(response.client);
      setShowSecret(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsRegenerating(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      // You could add a toast notification here
      alert('Copied to clipboard!');
    });
  };

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
        <div className="h-8 bg-gray-200 rounded w-full mb-4"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-8 text-gray-500">
        Client not found
      </div>
    );
  }

  return (
    <div className="bg-white shadow sm:rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900">API Credentials</h3>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">
          Use these credentials to integrate AuthJet with your application
        </p>

        {error && (
          <div className="mt-4 rounded-md bg-red-50 p-4">
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
          {/* API Key */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              API Key
            </label>
            <div className="flex rounded-md shadow-sm">
              <input
                type="text"
                readOnly
                value={client.api_key}
                className="flex-1 min-w-0 block w-full px-3 py-2 rounded-l-md border border-gray-300 bg-gray-50 text-gray-500 sm:text-sm"
              />
              <button
                onClick={() => copyToClipboard(client.api_key)}
                className="inline-flex items-center px-3 py-2 border border-l-0 border-gray-300 rounded-r-md bg-gray-50 text-gray-500 hover:bg-gray-100 sm:text-sm"
              >
                Copy
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Public identifier for your client
            </p>
          </div>

          {/* Secret Key */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Secret Key
            </label>
            <div className="flex rounded-md shadow-sm">
              <input
                type={showSecret ? "text" : "password"}
                readOnly
                value={showSecret ? (client.secret_key || '********') : '********'}
                className="flex-1 min-w-0 block w-full px-3 py-2 rounded-l-md border border-gray-300 bg-gray-50 text-gray-500 sm:text-sm"
              />
              <div className="flex -ml-px">
                <button
                  onClick={() => setShowSecret(!showSecret)}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 bg-gray-50 text-gray-500 hover:bg-gray-100 sm:text-sm"
                >
                  {showSecret ? 'Hide' : 'Show'}
                </button>
                <button
                  onClick={() => copyToClipboard(client.secret_key || '')}
                  disabled={!showSecret || !client.secret_key}
                  className="inline-flex items-center px-3 py-2 border border-l-0 border-gray-300 rounded-r-md bg-gray-50 text-gray-500 hover:bg-gray-100 disabled:opacity-50 sm:text-sm"
                >
                  Copy
                </button>
              </div>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Keep this secret and secure
            </p>
          </div>
        </div>

        {/* Security Warning */}
        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                Security Notice
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>
                  Your secret key will only be shown once. Store it securely and never commit it to version control.
                  If you lose your secret key, you'll need to regenerate new API credentials.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Regenerate Button */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={handleRegenerateKeys}
            disabled={isRegenerating}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
          >
            {isRegenerating ? 'Regenerating...' : 'Regenerate API Keys'}
          </button>
        </div>

        {/* Usage Instructions */}
        <div className="mt-8 border-t border-gray-200 pt-6">
          <h4 className="text-sm font-medium text-gray-900 mb-4">Usage Example</h4>
          <div className="bg-gray-900 rounded-lg p-4">
            <pre className="text-sm text-gray-100 overflow-x-auto">
{`// Node.js Example
const authjet = require('authjet-sdk');

const client = new authjet.Client({
  apiKey: '${client.api_key}',
  secretKey: '${client.secret_key ? client.secret_key : 'YOUR_SECRET_KEY'}',
  baseURL: '${process.env.REACT_APP_API_URL || 'https://api.authjet.com'}'
});

// Verify a token
const user = await client.verifyToken(accessToken);`}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiKeys;