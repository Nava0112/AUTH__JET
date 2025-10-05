import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api';

const ClientProfileModal = ({ client, isOpen, onClose }) => {
  const [clientDetails, setClientDetails] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showClientSecret, setShowClientSecret] = useState(false);

  useEffect(() => {
    if (isOpen && client) {
      fetchClientDetails();
    }
  }, [isOpen, client]);

  const fetchClientDetails = async () => {
    try {
      setIsLoading(true);
      setError('');
      
      // Log the client data to debug
      console.log('Client data received:', client);
      
      // If we already have detailed client data, use it directly
      if (client.api_key || client.client_id) {
        setClientDetails(client);
        setIsLoading(false);
        return;
      }
      
      // Otherwise, fetch from API using client ID
      const clientId = client.id || client.client_id;
      if (!clientId) {
        throw new Error('No client ID found');
      }
      
      console.log('Fetching client details for ID:', clientId);
      console.log('Full API URL will be:', `/api/clients/${clientId}`);
      
      const response = await apiService.clients.get(clientId);
      console.log('API response:', response);
      
      setClientDetails(response.client);
    } catch (err) {
      console.error('Error fetching client details:', err);
      setError(err.message || 'Failed to fetch client details');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async (text, fieldName) => {
    try {
      await navigator.clipboard.writeText(text);
      // You could replace this with a toast notification
      alert(`${fieldName} copied to clipboard!`);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      alert('Failed to copy to clipboard');
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleOverlayClick}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Client Profile</h2>
            <p className="text-sm text-gray-500 mt-1">
              {client?.name} - Authentication Credentials
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Content */}
        <div className="px-6 py-6">
          {/* Debug Information */}
          <div className="mb-4 p-3 bg-gray-100 rounded text-xs">
            <p><strong>Debug Info:</strong></p>
            <p>Client prop: {JSON.stringify(client, null, 2)}</p>
            <p>ClientDetails state: {JSON.stringify(clientDetails, null, 2)}</p>
            <p>Has client_secret: {clientDetails?.client_secret ? 'YES' : 'NO'}</p>
            <p>Has secret_key: {clientDetails?.secret_key ? 'YES' : 'NO'}</p>
            <p>Client secret value: {clientDetails?.client_secret || 'undefined'}</p>
            <p>Error: {error}</p>
            <p>Loading: {isLoading.toString()}</p>
          </div>
          
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
              <p className="text-gray-500 mt-2">Loading client details...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error</h3>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
            </div>
          ) : clientDetails ? (
            <div className="space-y-6">
              {/* Client Information */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Client Information</h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Client Name</label>
                      <p className="mt-1 text-sm text-gray-900">{clientDetails.name}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Plan Type</label>
                      <p className="mt-1 text-sm text-gray-900 capitalize">{clientDetails.plan_type}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Contact Email</label>
                      <p className="mt-1 text-sm text-gray-900">{clientDetails.contact_email}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Status</label>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        clientDetails.status === 'active' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {clientDetails.status}
                      </span>
                    </div>
                  </div>
                  {clientDetails.website && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Website</label>
                      <p className="mt-1 text-sm text-gray-900">{clientDetails.website}</p>
                    </div>
                  )}
                  {clientDetails.description && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Description</label>
                      <p className="mt-1 text-sm text-gray-900">{clientDetails.description}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* API Credentials */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">API Credentials</h3>
                
                {/* Client ID */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Client ID
                  </label>
                  <div className="flex rounded-md shadow-sm">
                    <input
                      type="text"
                      readOnly
                      value={clientDetails.api_key || clientDetails.client_id || clientDetails.id || 'Not available'}
                      className="flex-1 min-w-0 block w-full px-3 py-2 rounded-l-md border border-gray-300 bg-gray-50 text-gray-700 sm:text-sm font-mono"
                    />
                    <button
                      onClick={() => copyToClipboard(clientDetails.api_key || clientDetails.client_id || clientDetails.id || '', 'Client ID')}
                      className="inline-flex items-center px-3 py-2 border border-l-0 border-gray-300 rounded-r-md bg-gray-50 text-gray-500 hover:bg-gray-100 sm:text-sm"
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Public identifier for your client application
                  </p>
                </div>

                {/* Client Secret */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Client Secret
                  </label>
                  <div className="flex rounded-md shadow-sm">
                    <input
                      type={showClientSecret ? "text" : "password"}
                      readOnly
                      value={showClientSecret ? (clientDetails.client_secret || clientDetails.secret_key || 'Not available') : '••••••••••••••••'}
                      className="flex-1 min-w-0 block w-full px-3 py-2 rounded-l-md border border-gray-300 bg-gray-50 text-gray-700 sm:text-sm font-mono"
                    />
                    <button
                      onClick={() => setShowClientSecret(!showClientSecret)}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 bg-gray-50 text-gray-500 hover:bg-gray-100 sm:text-sm"
                    >
                      {showClientSecret ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.05 6.05m3.828 3.828L6.05 6.05m12.9 12.9l-3.828-3.828m3.828 3.828L16.95 16.95m0 0l-3.828-3.828" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                    <button
                      onClick={() => copyToClipboard(clientDetails.client_secret || clientDetails.secret_key || '', 'Client Secret')}
                      disabled={!showClientSecret}
                      className="inline-flex items-center px-3 py-2 border border-l-0 border-gray-300 rounded-r-md bg-gray-50 text-gray-500 hover:bg-gray-100 disabled:opacity-50 sm:text-sm"
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Secret key for server-side authentication - keep this secure!
                  </p>
                </div>

                {/* Security Warning */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
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
                          Never share your client secret publicly or commit it to version control. 
                          Use environment variables to store these credentials securely.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Integration URLs */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Integration URLs</h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  {clientDetails.redirect_urls && clientDetails.redirect_urls.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Redirect URLs</label>
                      <div className="mt-1 space-y-1">
                        {clientDetails.redirect_urls.map((url, index) => (
                          <p key={index} className="text-sm text-gray-900 font-mono bg-white px-2 py-1 rounded border">{url}</p>
                        ))}
                      </div>
                    </div>
                  )}
                  {clientDetails.allowed_origins && clientDetails.allowed_origins.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Allowed Origins</label>
                      <div className="mt-1 space-y-1">
                        {clientDetails.allowed_origins.map((origin, index) => (
                          <p key={index} className="text-sm text-gray-900 font-mono bg-white px-2 py-1 rounded border">{origin}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              No client details available
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClientProfileModal;
