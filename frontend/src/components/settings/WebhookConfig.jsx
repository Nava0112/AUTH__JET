import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api';

const WebhookConfig = ({ clientId }) => {
  const [formData, setFormData] = useState({
    webhook_url: '',
    webhook_secret: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {isLoading ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </form>

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