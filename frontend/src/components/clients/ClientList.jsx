import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiService } from '../../services/api';
import Loading from '../common/Loading';
import ClientProfileModal from './ClientProfileModal';

const ClientList = () => {
  const [clients, setClients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [selectedClient, setSelectedClient] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const fetchClients = async (page = 1, search = '') => {
    try {
      setIsLoading(true);
      const response = await apiService.clients.list({
        page,
        limit: 10,
        search: search || undefined
      });
      setClients(response.clients);
      setPagination(response.pagination);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchClients(1, searchTerm);
  };

  const handleDelete = async (clientId) => {
    if (!window.confirm('Are you sure you want to delete this client? This action cannot be undone.')) {
      return;
    }

    try {
      await apiService.clients.delete(clientId);
      fetchClients(currentPage, searchTerm);
    } catch (err) {
      setError(err.message);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getPlanBadge = (plan) => {
    const plans = {
      free: 'bg-gray-100 text-gray-800',
      pro: 'bg-blue-100 text-blue-800',
      enterprise: 'bg-purple-100 text-purple-800'
    };
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${plans[plan]}`}>
        {plan.charAt(0).toUpperCase() + plan.slice(1)}
      </span>
    );
  };

  const handleViewProfile = (client) => {
    setSelectedClient(client);
    setShowProfileModal(true);
  };

  const closeProfileModal = () => {
    setShowProfileModal(false);
    setSelectedClient(null);
  };

  if (isLoading && clients.length === 0) {
    return <Loading text="Loading clients..." />;
  }

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-md">
      <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg leading-6 font-medium text-gray-900">Clients</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Manage your client applications and their settings
            </p>
          </div>
          <Link
            to="/clients/new"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Add Client
          </Link>
        </div>

        {/* Search and Filters */}
        <div className="mt-4">
          <form onSubmit={handleSearch} className="flex space-x-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search clients by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Search
            </button>
          </form>
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-4 rounded-md bg-red-50 p-4">
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}

      {clients.length === 0 ? (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No clients</h3>
          <p className="mt-1 text-sm text-gray-500">Get started by creating a new client.</p>
          <div className="mt-6">
            <Link
              to="/clients/new"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Add Client
            </Link>
          </div>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-gray-200">
            {clients.map((client) => (
              <li key={client.id}>
                <div className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0">
                        <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                          <span className="text-indigo-600 font-medium text-sm">
                            {client.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="flex items-center">
                          <h4 className="text-sm font-medium text-gray-900">
                            {client.name}
                          </h4>
                          {getPlanBadge(client.plan_type)}
                        </div>
                        <div className="mt-1 text-sm text-gray-500">
                          <p>{client.contact_email}</p>
                          {client.website && (
                            <p className="mt-1">{client.website}</p>
                          )}
                        </div>
                        <div className="mt-1 text-xs text-gray-400">
                          Created {formatDate(client.created_at)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleViewProfile(client)}
                        className="text-green-600 hover:text-green-900 text-sm font-medium"
                      >
                        View Profile
                      </button>
                      <Link
                        to={`/clients/${client.id}`}
                        className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                      >
                        View
                      </Link>
                      <Link
                        to={`/clients/${client.id}/edit`}
                        className="text-gray-600 hover:text-gray-900 text-sm font-medium"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => handleDelete(client.id)}
                        className="text-red-600 hover:text-red-900 text-sm font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
              <div className="flex-1 flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-700">
                    Showing <span className="font-medium">{(currentPage - 1) * 10 + 1}</span> to{' '}
                    <span className="font-medium">
                      {Math.min(currentPage * 10, pagination.total)}
                    </span>{' '}
                    of <span className="font-medium">{pagination.total}</span> results
                  </p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      setCurrentPage(currentPage - 1);
                      fetchClients(currentPage - 1, searchTerm);
                    }}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => {
                      setCurrentPage(currentPage + 1);
                      fetchClients(currentPage + 1, searchTerm);
                    }}
                    disabled={currentPage === pagination.pages}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
      {showProfileModal && selectedClient && (
        <ClientProfileModal
          client={selectedClient}
          isOpen={showProfileModal}
          onClose={closeProfileModal}
        />
      )}
    </div>
  );
};

export default ClientList;