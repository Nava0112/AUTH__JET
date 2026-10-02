import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const CreateApplication = () => {
  const [client, setClient] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    redirectUri: '',
    jwtClaims: [{ key: '', value: '' }]
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [credentials, setCredentials] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if client is logged in
    const clientData = localStorage.getItem('client');
    if (!clientData) {
      navigate('/');
      return;
    }
    
    setClient(JSON.parse(clientData));
  }, [navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const updateClaim = (index, field, value) => {
    const claims = [...formData.jwtClaims];
    claims[index] = { ...claims[index], [field]: value };
    setFormData({ ...formData, jwtClaims: claims });
  };

  const addClaim = () => {
    setFormData({ ...formData, jwtClaims: [...formData.jwtClaims, { key: '', value: '' }] });
  };

  const removeClaim = (index) => {
    const claims = formData.jwtClaims.filter((_, claimIndex) => claimIndex !== index);
    setFormData({ ...formData, jwtClaims: claims.length ? claims : [{ key: '', value: '' }] });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Validation
      if (!formData.name.trim()) {
        throw new Error('Application name is required');
      }

      if (!formData.redirectUri.trim()) {
        throw new Error('Redirect URI is required');
      }

      // Prepare data for API
      const applicationData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        redirect_url: formData.redirectUri.trim(),
        redirect_uris: [formData.redirectUri.trim()],
        oauth_jwt_claims: formData.jwtClaims
          .filter(claim => claim.key.trim())
          .map(claim => ({ key: claim.key.trim(), value: claim.value }))
      };

      console.log('Creating application:', applicationData);

      // Call the backend API
      const token = localStorage.getItem('clientToken'); // Get the JWT token
      if (!token) {
        throw new Error('Authentication token missing. Please login again.');
      }

      const response = await fetch('http://127.0.0.1:8000/api/client/applications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`, // Add Authorization header
        },
        body: JSON.stringify(applicationData)
      });

      
      const data = await response.json();
      console.log('Response:', data);

      if (response.ok && data.success) {
        setSuccess(`Application "${data.application.name}" created successfully!`);
        setCredentials({
          clientId: data.application.client_id,
          clientSecret: data.application.client_secret,
          redirectUri: data.application.redirect_uris?.[0]
        });
        
        // Reset form
        setFormData({
          name: '',
          description: '',
          redirectUri: '',
          jwtClaims: [{ key: '', value: '' }]
        });
        
      } else {
        throw new Error(data.error || 'Failed to create application');
      }
      
    } catch (err) {
      console.error('Create application error:', err);
      setError(err.message || 'Failed to create application. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!client) {
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
              <button
                onClick={() => navigate('/client/dashboard')}
                className="mr-4 text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Create New Application</h1>
                <p className="text-sm text-gray-500">Set up authentication for your application</p>
              </div>
            </div>
            <div className="text-sm text-gray-600">
              {client.organizationName}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="rounded-md bg-red-50 p-4">
                  <div className="text-sm text-red-700">{error}</div>
                </div>
              )}
              
              {success && (
                <div className="rounded-md bg-green-50 p-4">
                  <div className="text-sm text-green-700">{success}</div>
                </div>
              )}

              {credentials && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-slate-800">
                  <p className="font-semibold">Save these OAuth credentials now. The secret will not be shown again.</p>
                  <p className="mt-2 break-all"><strong>Client ID:</strong> {credentials.clientId}</p>
                  <p className="mt-1 break-all"><strong>Client Secret:</strong> {credentials.clientSecret}</p>
                  <p className="mt-1 break-all"><strong>Redirect URI:</strong> {credentials.redirectUri}</p>
                  <button type="button" onClick={() => navigate('/client/dashboard')} className="mt-4 rounded bg-slate-800 px-3 py-2 text-white">Back to dashboard</button>
                </div>
              )}

              {/* Application Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  Application Name *
                </label>
                <input
                  type="text"
                  name="name"
                  id="name"
                  required
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="My Web App"
                  value={formData.name}
                  onChange={handleChange}
                />
                <p className="mt-2 text-sm text-gray-500">
                  A descriptive name for your application
                </p>
              </div>

              {/* Description */}
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  name="description"
                  id="description"
                  rows={3}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="A brief description of your application..."
                  value={formData.description}
                  onChange={handleChange}
                />
              </div>

              {/* Redirect URI */}
              <div>
                <label htmlFor="redirectUri" className="block text-sm font-medium text-gray-700">
                  Redirect URI *
                </label>
                <input
                  type="url"
                  name="redirectUri"
                  id="redirectUri"
                  required
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="https://myapp.com/auth/callback"
                  value={formData.redirectUri}
                  onChange={handleChange}
                />
                <p className="mt-2 text-sm text-gray-500">
                  AuthJet will return the authorization code to this exact URL.
                </p>
              </div>

              {/* JWT Claims */}
              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700">JWT Claims (Optional)</label>
                  <button type="button" onClick={addClaim} className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-xl text-white" aria-label="Add JWT claim">+</button>
                </div>
                <div className="mt-2 space-y-3">
                  {formData.jwtClaims.map((claim, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        aria-label={`JWT claim ${index + 1} key`}
                        placeholder="Key, e.g. plan"
                        value={claim.key}
                        onChange={event => updateClaim(index, 'key', event.target.value)}
                        className="block w-1/2 rounded-md border-gray-300 shadow-sm sm:text-sm"
                      />
                      <input
                        type="text"
                        aria-label={`JWT claim ${index + 1} value`}
                        placeholder="Value, e.g. pro"
                        value={claim.value}
                        onChange={event => updateClaim(index, 'value', event.target.value)}
                        className="block w-1/2 rounded-md border-gray-300 shadow-sm sm:text-sm"
                      />
                      {formData.jwtClaims.length > 1 && <button type="button" onClick={() => removeClaim(index)} className="text-lg text-gray-500" aria-label="Remove JWT claim">×</button>}
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-sm text-gray-500">Add claim key/value pairs to include in the ID token.</p>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => navigate('/client/dashboard')}
                  className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Creating...
                    </>
                  ) : (
                    'Create Application'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Info Panel */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM9 9a1 1 0 0 0 0 2v3a1 1 0 0 0 1 1h1a1 1 0 1 0 0-2v-3a1 1 0 0 0-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">What happens after creation?</h3>
              <div className="mt-2 text-sm text-blue-700">
                <ul className="list-disc list-inside space-y-1">
                  <li>Get unique Client ID and Secret for API integration</li>
                  <li>Users authenticate via AuthJet and return with a one-time authorization code</li>
                  <li>Your backend exchanges the code for access, ID, and refresh tokens</li>
                  <li>The ID token contains only the JWT claims you selected</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Integration Preview */}
        <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-6">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Integration Preview</h3>
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex items-center space-x-2">
              <span className="font-medium">OAuth URL:</span>
              <code className="px-2 py-1 bg-gray-100 rounded text-xs">
                /oauth/authorize?client_id=YOUR_ID&redirect_uri={formData.redirectUri || 'YOUR_CALLBACK_URL'}&response_type=code&scope=openid%20profile%20email&code_challenge=PKCE_CHALLENGE&code_challenge_method=S256
              </code>
            </div>
            <div className="flex items-center space-x-2">
              <span className="font-medium">User returns to:</span>
              <code className="px-2 py-1 bg-gray-100 rounded text-xs">
                {formData.redirectUri || 'YOUR_CALLBACK_URL'}?code=AUTHORIZATION_CODE&state=STATE
              </code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateApplication;
