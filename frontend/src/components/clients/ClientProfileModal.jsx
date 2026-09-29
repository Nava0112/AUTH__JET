import React, { useEffect, useState } from 'react';
import { apiService } from '../../services/api';

const ClientProfileModal = ({ client, isOpen, onClose }) => {
  const [clientDetails, setClientDetails] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !client) return;

    if (client.id) {
      setClientDetails(client);
      return;
    }

    const loadClient = async () => {
      try {
        setIsLoading(true);
        setError('');
        const response = await apiService.clients.get(client.client_id);
        setClientDetails(response.client);
      } catch (loadError) {
        setError(loadError.message || 'Failed to fetch client details');
      } finally {
        setIsLoading(false);
      }
    };

    loadClient();
  }, [isOpen, client]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4" onClick={event => event.target === event.currentTarget && onClose()}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Client Profile</h2>
            <p className="mt-1 text-sm text-gray-500">Account information and integration settings</p>
          </div>
          <button onClick={onClose} className="text-2xl text-gray-400 hover:text-gray-600" aria-label="Close profile">&times;</button>
        </div>

        <div className="px-6 py-6">
          {isLoading && <p className="py-8 text-center text-gray-500">Loading client details...</p>}
          {error && <p className="rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</p>}
          {!isLoading && !error && clientDetails && (
            <div className="space-y-6">
              <section>
                <h3 className="mb-4 text-lg font-medium text-gray-900">Client Information</h3>
                <div className="grid grid-cols-1 gap-4 rounded-lg bg-gray-50 p-4 sm:grid-cols-2">
                  <div><dt className="text-sm font-medium text-gray-500">Name</dt><dd className="mt-1 text-sm text-gray-900">{clientDetails.name}</dd></div>
                  <div><dt className="text-sm font-medium text-gray-500">Plan</dt><dd className="mt-1 text-sm capitalize text-gray-900">{clientDetails.plan_type || clientDetails.planType || 'basic'}</dd></div>
                  <div><dt className="text-sm font-medium text-gray-500">Email</dt><dd className="mt-1 text-sm text-gray-900">{clientDetails.email || clientDetails.contact_email}</dd></div>
                  <div><dt className="text-sm font-medium text-gray-500">Status</dt><dd className="mt-1 text-sm text-gray-900">{clientDetails.is_active === false ? 'Inactive' : 'Active'}</dd></div>
                  <div><dt className="text-sm font-medium text-gray-500">Account ID</dt><dd className="mt-1 font-mono text-sm text-gray-900">{clientDetails.id}</dd></div>
                  {clientDetails.website && <div><dt className="text-sm font-medium text-gray-500">Website</dt><dd className="mt-1 text-sm text-gray-900">{clientDetails.website}</dd></div>}
                </div>
              </section>

              <section>
                <h3 className="mb-4 text-lg font-medium text-gray-900">Integration Settings</h3>
                <div className="space-y-4 rounded-lg bg-gray-50 p-4">
                  {clientDetails.redirect_urls?.length > 0 && <div><dt className="text-sm font-medium text-gray-500">Redirect URLs</dt>{clientDetails.redirect_urls.map(url => <dd key={url} className="mt-1 break-all font-mono text-sm text-gray-900">{url}</dd>)}</div>}
                  {clientDetails.allowed_origins?.length > 0 && <div><dt className="text-sm font-medium text-gray-500">Allowed Origins</dt>{clientDetails.allowed_origins.map(origin => <dd key={origin} className="mt-1 break-all font-mono text-sm text-gray-900">{origin}</dd>)}</div>}
                  <p className="text-sm text-gray-500">OAuth client credentials belong to individual applications and are managed from the Applications area.</p>
                </div>
              </section>
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-gray-200 px-6 py-4">
          <button onClick={onClose} className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Close</button>
        </div>
      </div>
    </div>
  );
};

export default ClientProfileModal;
