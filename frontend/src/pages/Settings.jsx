import React, { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import WebhookConfig from '../components/settings/WebhookConfig';
import SecuritySettings from '../components/settings/SecuritySettings';
import { useClients } from '../hooks/useClients';

const Settings = () => {
  const { clients } = useClients();
  const [selectedClient, setSelectedClient] = useState('');

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
          <p className="mt-2 text-sm text-gray-700">
            Configure your application settings and security preferences.
          </p>
        </div>
      </div>

      <Routes>
        <Route 
          path="/" 
          element={
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Security Settings */}
              <div className="lg:col-span-2">
                <SecuritySettings />
              </div>

              {/* Client-specific Settings */}
              {clients.length > 0 && (
                <div className="lg:col-span-2">
                  <div className="bg-white shadow sm:rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                      <h3 className="text-lg leading-6 font-medium text-gray-900">
                        Client Settings
                      </h3>
                      <p className="mt-1 max-w-2xl text-sm text-gray-500">
                        Configure settings for individual clients
                      </p>
                      
                      <div className="mt-4">
                        <label htmlFor="client-select" className="block text-sm font-medium text-gray-700">
                          Select Client
                        </label>
                        <select
                          id="client-select"
                          value={selectedClient}
                          onChange={(e) => setSelectedClient(e.target.value)}
                          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                        >
                          <option value="">Choose a client...</option>
                          {clients.map((client) => (
                            <option key={client.id} value={client.id}>
                              {client.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {selectedClient && (
                        <div className="mt-6 space-y-6">
                          <WebhookConfig clientId={selectedClient} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          } 
        />
        <Route 
          path="/security" 
          element={<SecuritySettings />} 
        />
        <Route 
          path="/webhooks" 
          element={
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Webhook Configuration</h2>
              {clients.length > 0 ? (
                <div className="space-y-6">
                  {clients.map((client) => (
                    <WebhookConfig key={client.id} clientId={client.id} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-500">No clients available to configure webhooks.</p>
                </div>
              )}
            </div>
          } 
        />
      </Routes>
    </div>
  );
};

export default Settings;