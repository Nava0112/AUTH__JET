import React, { useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import ClientList from '../components/clients/ClientList';
import ClientForm from '../components/clients/ClientForm';
import ApiKeys from '../components/clients/ApiKeys';
import { useClients } from '../hooks/useClients';

const Clients = () => {
  const { createClient, updateClient } = useClients();
  const navigate = useNavigate();
  const [selectedClient, setSelectedClient] = useState(null);

  const handleCreateSuccess = () => {
    navigate('/clients');
  };

  const handleUpdateSuccess = () => {
    navigate('/clients');
  };

  const handleCancel = () => {
    navigate('/clients');
  };

  return (
    <div className="space-y-6">
      <Routes>
        <Route 
          path="/" 
          element={
            <>
              <div className="sm:flex sm:items-center">
                <div className="sm:flex-auto">
                  <h1 className="text-2xl font-semibold text-gray-900">Clients</h1>
                  <p className="mt-2 text-sm text-gray-700">
                    Manage your client applications and their authentication settings.
                  </p>
                </div>
              </div>
              <ClientList />
            </>
          } 
        />
        <Route 
          path="/new" 
          element={
            <>
              <div className="md:flex md:items-center md:justify-between">
                <div className="flex-1 min-w-0">
                  <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl">
                    Create New Client
                  </h2>
                </div>
              </div>
              <div className="mt-6 bg-white shadow sm:rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <ClientForm 
                    onSuccess={handleCreateSuccess}
                    onCancel={handleCancel}
                  />
                </div>
              </div>
            </>
          } 
        />
        <Route 
          path="/:clientId" 
          element={
            <>
              <div className="md:flex md:items-center md:justify-between">
                <div className="flex-1 min-w-0">
                  <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl">
                    Client Details
                  </h2>
                </div>
              </div>
              <div className="mt-6 space-y-6">
                <ApiKeys clientId={selectedClient?.id} />
              </div>
            </>
          } 
        />
        <Route 
          path="/:clientId/edit" 
          element={
            <>
              <div className="md:flex md:items-center md:justify-between">
                <div className="flex-1 min-w-0">
                  <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl">
                    Edit Client
                  </h2>
                </div>
              </div>
              <div className="mt-6 bg-white shadow sm:rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <ClientForm 
                    client={selectedClient}
                    onSuccess={handleUpdateSuccess}
                    onCancel={handleCancel}
                  />
                </div>
              </div>
            </>
          } 
        />
      </Routes>
    </div>
  );
};

export default Clients;