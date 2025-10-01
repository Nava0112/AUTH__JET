import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api';

const ClientForm = ({ client, onSuccess, onCancel }) => {
  const [formData, setFormData] = useState({
    name: '',
    contact_email: '',
    website: '',
    business_type: '',
    allowed_domains: [],
    default_roles: ['user']
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (client) {
      setFormData({
        name: client.name || '',
        contact_email: client.contact_email || '',
        website: client.website || '',
        business_type: client.business_type || '',
        allowed_domains: client.allowed_domains || [],
        default_roles: client.default_roles || ['user']
      });
    }
  }, [client]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleArrayChange = (field, value) => {
    const items = value.split(',').map(item => item.trim()).filter(item => item);
    setFormData(prev => ({
      ...prev,
      [field]: items
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      if (client) {
        // Update existing client
        await apiService.clients.update(client.id, formData);
      } else {
        // Create new client
        await apiService.clients.create(formData);
      }
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Client Name *
          </label>
          <input
            type="text"
            name="name"
            id="name"
            required
            value={formData.name}
            onChange={handleChange}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            placeholder="Enter client name"
          />
        </div>

        <div>
          <label htmlFor="contact_email" className="block text-sm font-medium text-gray-700">
            Contact Email *
          </label>
          <input
            type="email"
            name="contact_email"
            id="contact_email"
            required
            value={formData.contact_email}
            onChange={handleChange}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            placeholder="contact@example.com"
          />
        </div>

        <div>
          <label htmlFor="website" className="block text-sm font-medium text-gray-700">
            Website
          </label>
          <input
            type="url"
            name="website"
            id="website"
            value={formData.website}
            onChange={handleChange}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            placeholder="https://example.com"
          />
        </div>

        <div>
          <label htmlFor="business_type" className="block text-sm font-medium text-gray-700">
            Business Type
          </label>
          <select
            name="business_type"
            id="business_type"
            value={formData.business_type}
            onChange={handleChange}
            className="mt-1 block w-full bg-white border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          >
            <option value="">Select business type</option>
            <option value="ecommerce">E-commerce</option>
            <option value="saas">SaaS</option>
            <option value="education">Education</option>
            <option value="healthcare">Healthcare</option>
            <option value="finance">Finance</option>
            <option value="entertainment">Entertainment</option>
            <option value="technology">Technology</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="allowed_domains" className="block text-sm font-medium text-gray-700">
            Allowed Domains
          </label>
          <input
            type="text"
            name="allowed_domains"
            id="allowed_domains"
            value={formData.allowed_domains.join(', ')}
            onChange={(e) => handleArrayChange('allowed_domains', e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            placeholder="example.com, *.example.com, localhost"
          />
          <p className="mt-1 text-sm text-gray-500">
            Comma-separated list of domains allowed to use this client. Use *.example.com for subdomains.
          </p>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="default_roles" className="block text-sm font-medium text-gray-700">
            Default Roles
          </label>
          <input
            type="text"
            name="default_roles"
            id="default_roles"
            value={formData.default_roles.join(', ')}
            onChange={(e) => handleArrayChange('default_roles', e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            placeholder="user, admin, viewer"
          />
          <p className="mt-1 text-sm text-gray-500">
            Comma-separated list of default roles for new users.
          </p>
        </div>
      </div>

      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={onCancel}
          className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {isLoading ? 'Saving...' : (client ? 'Update Client' : 'Create Client')}
        </button>
      </div>
    </form>
  );
};

export default ClientForm;