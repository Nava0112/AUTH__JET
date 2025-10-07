import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const CreateApplication = () => {
  const [client, setClient] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    authMode: 'basic',
    allowedOrigins: '',
    mainPageUrl: '',
    webhookUrl: '',
    roleRequestWebhook: '',
    roles: [
      { id: 1, name: 'user', displayName: 'User', hierarchy: 1, isDefault: true },
      { id: 2, name: 'admin', displayName: 'Admin', hierarchy: 2, isDefault: false }
    ],
    defaultRoleId: 1
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
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
    
    if (name === 'authMode') {
      setShowAdvanced(value === 'advanced');
    }
    
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const addRole = () => {
    const newId = Math.max(...formData.roles.map(r => r.id)) + 1;
    const newHierarchy = Math.max(...formData.roles.map(r => r.hierarchy)) + 1;
    
    setFormData({
      ...formData,
      roles: [
        ...formData.roles,
        { 
          id: newId, 
          name: '', 
          displayName: '', 
          hierarchy: newHierarchy, 
          isDefault: false 
        }
      ]
    });
  };

  const removeRole = (roleId) => {
    const updatedRoles = formData.roles.filter(role => role.id !== roleId);
    
    // If removing the default role, set the first remaining role as default
    let defaultRoleId = formData.defaultRoleId;
    if (formData.defaultRoleId === roleId && updatedRoles.length > 0) {
      defaultRoleId = updatedRoles[0].id;
    }
    
    setFormData({
      ...formData,
      roles: updatedRoles,
      defaultRoleId: defaultRoleId
    });
  };

  const updateRole = (roleId, field, value) => {
    setFormData({
      ...formData,
      roles: formData.roles.map(role => 
        role.id === roleId ? { ...role, [field]: value } : role
      )
    });
  };

  const moveRole = (roleId, direction) => {
    const roleIndex = formData.roles.findIndex(r => r.id === roleId);
    if (roleIndex === -1) return;

    const newRoles = [...formData.roles];
    const targetIndex = direction === 'up' ? roleIndex - 1 : roleIndex + 1;
    
    if (targetIndex >= 0 && targetIndex < newRoles.length) {
      // Swap hierarchy values
      const temp = newRoles[roleIndex].hierarchy;
      newRoles[roleIndex].hierarchy = newRoles[targetIndex].hierarchy;
      newRoles[targetIndex].hierarchy = temp;
      
      // Sort by hierarchy
      newRoles.sort((a, b) => a.hierarchy - b.hierarchy);
      
      setFormData({
        ...formData,
        roles: newRoles
      });
    }
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

      if (!formData.mainPageUrl.trim()) {
        throw new Error('Application URL is required');
      }

      // Prepare data for API
      const applicationData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        authMode: formData.authMode,
        mainPageUrl: formData.mainPageUrl.trim(),
        allowedOrigins: formData.allowedOrigins ? formData.allowedOrigins.split(',').map(url => url.trim()).filter(url => url) : [],
        webhookUrl: formData.webhookUrl.trim() || null,
        roleRequestWebhook: formData.roleRequestWebhook.trim() || null,
        roles: formData.roles,
        defaultRoleId: formData.defaultRoleId
      };

      console.log('Creating application:', applicationData);

      // Call the backend API
      const token = localStorage.getItem('clientToken'); // Get the JWT token
      if (!token) {
        throw new Error('Authentication token missing. Please login again.');
      }

      const response = await fetch('http://localhost:8000/api/client/applications', {
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
        
        // Reset form
        setFormData({
          name: '',
          description: '',
          authMode: 'basic',
          allowedOrigins: '',
          mainPageUrl: '',
          webhookUrl: '',
          roleRequestWebhook: '',
          roles: [
            { id: 1, name: 'user', displayName: 'User', hierarchy: 1, isDefault: true },
            { id: 2, name: 'admin', displayName: 'Admin', hierarchy: 2, isDefault: false }
          ],
          defaultRoleId: 1
        });
        setShowAdvanced(false);
        
        // Redirect to dashboard after delay
        setTimeout(() => {
          navigate('/client/dashboard');
        }, 2000);
        
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

              {/* Authentication Mode */}
              <div>
                <label htmlFor="authMode" className="block text-sm font-medium text-gray-700">
                  Authentication Mode
                </label>
                <select
                  name="authMode"
                  id="authMode"
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  value={formData.authMode}
                  onChange={handleChange}
                >
                  <option value="basic">Basic Authentication</option>
                  <option value="advanced">Advanced (with roles & permissions)</option>
                  <option value="social">Social Login Integration</option>
                </select>
                <p className="mt-2 text-sm text-gray-500">
                  Choose the authentication complexity for your application
                </p>
              </div>

              {/* Main Page URL */}
              <div>
                <label htmlFor="mainPageUrl" className="block text-sm font-medium text-gray-700">
                  Application URL *
                </label>
                <input
                  type="url"
                  name="mainPageUrl"
                  id="mainPageUrl"
                  required
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="https://myapp.com"
                  value={formData.mainPageUrl}
                  onChange={handleChange}
                />
                <p className="mt-2 text-sm text-gray-500">
                  The main URL of your application where users will be redirected after authentication
                </p>
              </div>

              {/* Allowed Origins */}
              <div>
                <label htmlFor="allowedOrigins" className="block text-sm font-medium text-gray-700">
                  Allowed Origins (CORS)
                </label>
                <input
                  type="text"
                  name="allowedOrigins"
                  id="allowedOrigins"
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="https://myapp.com, https://localhost:3000"
                  value={formData.allowedOrigins}
                  onChange={handleChange}
                />
                <p className="mt-2 text-sm text-gray-500">
                  Comma-separated list of allowed origins for CORS
                </p>
              </div>

              {/* Auth Events Webhook */}
              <div>
                <label htmlFor="webhookUrl" className="block text-sm font-medium text-gray-700">
                  Webhook URL (Optional)
                </label>
                <input
                  type="url"
                  name="webhookUrl"
                  id="webhookUrl"
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="https://myapp.com/webhooks/auth-events"
                  value={formData.webhookUrl}
                  onChange={handleChange}
                />
                <p className="mt-2 text-sm text-gray-500">
                  URL to receive notifications for authentication events (login, logout, registration)
                </p>
              </div>

              {/* Advanced Role Management */}
              {showAdvanced && (
                <div className="space-y-6 p-6 bg-gray-50 rounded-lg border">
                  <div className="flex items-center justify-between">
                    <h4 className="text-lg font-medium text-gray-900">Role Management</h4>
                    <button
                      type="button"
                      onClick={addRole}
                      className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      <svg className="-ml-0.5 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Add Role
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    {formData.roles.sort((a, b) => a.hierarchy - b.hierarchy).map((role, index) => (
                      <div key={role.id} className="flex items-center space-x-4 p-4 bg-white rounded-md border">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-gray-500">#{role.hierarchy}</span>
                          <div className="flex flex-col space-y-1">
                            <button
                              type="button"
                              onClick={() => moveRole(role.id, 'up')}
                              disabled={index === 0}
                              className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                            >
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => moveRole(role.id, 'down')}
                              disabled={index === formData.roles.length - 1}
                              className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                            >
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        
                        <div className="flex-1 grid grid-cols-2 gap-4">
                          <div>
                            <input
                              type="text"
                              placeholder="Role name (e.g., admin)"
                              value={role.name}
                              onChange={(e) => updateRole(role.id, 'name', e.target.value)}
                              className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            />
                          </div>
                          <div>
                            <input
                              type="text"
                              placeholder="Display name (e.g., Administrator)"
                              value={role.displayName}
                              onChange={(e) => updateRole(role.id, 'displayName', e.target.value)}
                              className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            />
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <label className="flex items-center">
                            <input
                              type="radio"
                              name="defaultRole"
                              checked={formData.defaultRoleId === role.id}
                              onChange={() => setFormData({ ...formData, defaultRoleId: role.id })}
                              className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300"
                            />
                            <span className="ml-2 text-sm text-gray-700">Default</span>
                          </label>
                          
                          {formData.roles.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeRole(role.id)}
                              className="p-1 text-red-400 hover:text-red-600"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="bg-blue-50 p-4 rounded-md">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM9 9a1 1 0 0 0 0 2v3a1 1 0 0 0 1 1h1a1 1 0 1 0 0-2v-3a1 1 0 0 0-1-1H9z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-blue-800">Role Hierarchy</h3>
                        <div className="mt-2 text-sm text-blue-700">
                          <p>Roles are ordered by hierarchy (1 = lowest, higher numbers = more permissions). Users can request higher roles through your application.</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Role Request Webhook */}
                  <div>
                    <label htmlFor="roleRequestWebhook" className="block text-sm font-medium text-gray-700">
                      Role Request Webhook URL
                    </label>
                    <input
                      type="url"
                      name="roleRequestWebhook"
                      id="roleRequestWebhook"
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                      placeholder="https://myapp.com/webhooks/role-requests"
                      value={formData.roleRequestWebhook}
                      onChange={handleChange}
                    />
                    <p className="mt-2 text-sm text-gray-500">
                      URL to receive POST requests when users request role upgrades
                    </p>
                  </div>
                </div>
              )}

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
                  <li>Users authenticate via AuthJet and return to your application</li>
                  <li>Receive JWT tokens with user data and role information</li>
                  <li>Optional webhooks notify you of authentication events</li>
                  {showAdvanced && <li>Users can request role upgrades through your role hierarchy</li>}
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
                /oauth/authorize?client_id=YOUR_ID&redirect_uri={formData.mainPageUrl || 'YOUR_APP_URL'}
              </code>
            </div>
            <div className="flex items-center space-x-2">
              <span className="font-medium">User returns to:</span>
              <code className="px-2 py-1 bg-gray-100 rounded text-xs">
                {formData.mainPageUrl || 'YOUR_APP_URL'}?access_token=JWT_TOKEN
              </code>
            </div>
            {formData.webhookUrl && (
              <div className="flex items-center space-x-2">
                <span className="font-medium">Webhook events:</span>
                <code className="px-2 py-1 bg-gray-100 rounded text-xs">
                  {formData.webhookUrl}
                </code>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateApplication;
