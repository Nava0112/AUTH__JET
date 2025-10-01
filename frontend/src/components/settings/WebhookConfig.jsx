import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api';

const WebhookConfig = ({ clientId }) => {
  const [formData, setFormData] = useState({
    webhook_url: '',
    webhook_secret: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    fetchClient();
  }, [clientId]);

  const fetchClient = async () => {
    try {
      const response = await apiService.clients.get(clientId);
      setFormData({
        webhook_url: response.client.webhook_url || '',
        webhook_secret: response.client.settings?.webhook_secret || ''
      });
    } catch (err) {
      setError('Failed to load client settings');
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError('');
    setSuccess('');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      await apiService.clients.update(clientId, {
        webhook_url: formData.webhook_url,
        settings: {
          webhook_secret: formData.webhook_secret
        }
      });
      setSuccess('Webhook configuration saved successfully');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    setError('');

    try {
      const result = await apiService.webhooks.test(clientId, {
        event_type: 'test',
        payload: {
          message: 'Test webhook from AuthJet dashboard',
          timestamp: new Date().toISOString()
        }
      });
      setTestResult(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="bg-white shadow sm:rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900">Webhook Configuration</h3>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">
          Configure webhooks to receive real-time events from AuthJet
        </p>

        {error && (
          <div className="mt-4 rounded-md bg-red-50 p-4">
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}

        {success && (
          <div className="mt-4 rounded-md bg-green-50 p-4">
            <div className="text-sm text-green-700">{success}</div>
          </div>
        )}

        <form onSubmit={handleSave} className="mt-6 space-y-6">
          <div>
            <label htmlFor="webhook_url" className="block text-sm font-medium text-gray-700">
              Webhook URL
            </label>
            <input
              type="url"
              name="webhook_url"
              id="webhook_url"
              value={formData.webhook_url}
              onChange={handleChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="https://your-api.com/auth/webhook"
            />
            <p className="mt-1 text-sm text-gray-500">
              The URL where AuthJet will send webhook events
            </p>
          </div>

          <div>
            <label htmlFor="webhook_secret" className="block text-sm font-medium text-gray-700">
              Webhook Secret
            </label>
            <input
              type="password"
              name="webhook_secret"
              id="webhook_secret"
              value={formData.webhook_secret}
              onChange={handleChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="Enter your webhook secret"
            />
            <p className="mt-1 text-sm text-gray-500">
              Used to verify webhook requests from AuthJet
            </p>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={handleTest}
              disabled={!formData.webhook_url || isTesting}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {isTesting ? 'Testing...' : 'Test Webhook'}
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {isLoading ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </form>

        {/* Test Results */}
        {testResult && (
          <div className="mt-6 border-t border-gray-200 pt-6">
            <h4 className="text-sm font-medium text-gray-900 mb-4">Test Results</h4>
            <div className={`p-4 rounded-md ${
              testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
            }`}>
              <div className="flex items-center">
                <div className={`flex-shrink-0 h-5 w-5 ${
                  testResult.success ? 'text-green-400' : 'text-red-400'
                }`}>
                  {testResult.success ? (
                    <svg fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <div className="ml-3">
                  <h5 className={`text-sm font-medium ${
                    testResult.success ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {testResult.success ? 'Webhook test successful' : 'Webhook test failed'}
                  </h5>
                  <div className={`mt-1 text-sm ${
                    testResult.success ? 'text-green-700' : 'text-red-700'
                  }`}>
                    <p>Status: {testResult.response?.status}</p>
                    <p>Duration: {testResult.response?.duration}ms</p>
                    {testResult.message && <p>Message: {testResult.message}</p>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Webhook Documentation */}
        <div className="mt-8 border-t border-gray-200 pt-6">
          <h4 className="text-sm font-medium text-gray-900 mb-4">Webhook Events</h4>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-600 space-y-2">
              <p><strong>user.register</strong> - When a new user registers</p>
              <p><strong>user.login</strong> - When a user logs in</p>
              <p><strong>user.update</strong> - When user data is updated</p>
              <p><strong>user.delete</strong> - When a user is deleted</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WebhookConfig;