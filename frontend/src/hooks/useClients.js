import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/api';
import axios from 'axios';

export const useClients = () => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({});

  const fetchClients = useCallback(async (page = 1, search = '') => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiService.clients.list({
        page,
        limit: 10,
        search: search || undefined
      });
      
      setClients(response.clients);
      setPagination(response.pagination);
      
      return response;
    } catch (err) {
      if (!axios.isCancel(err)) {
        setError(err.message);
      }
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const createClient = useCallback(async (clientData) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiService.clients.create(clientData);
      
      // Refresh the clients list
      await fetchClients();
      
      return response;
    } catch (err) {
      if (!axios.isCancel(err)) {
        setError(err.message);
      }
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchClients]);

  const updateClient = useCallback(async (clientId, clientData) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiService.clients.update(clientId, clientData);
      
      // Update the client in the local state
      setClients(prev => prev.map(client => 
        client.id === clientId ? { ...client, ...response.client } : client
      ));
      
      return response;
    } catch (err) {
      if (!axios.isCancel(err)) {
        setError(err.message);
      }
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteClient = useCallback(async (clientId) => {
    try {
      setLoading(true);
      setError(null);
      
      await apiService.clients.delete(clientId);
      
      // Remove the client from the local state
      setClients(prev => prev.filter(client => client.id !== clientId));
      
      // Refresh pagination if needed
      if (clients.length === 1 && pagination.page > 1) {
        await fetchClients(pagination.page - 1);
      } else {
        await fetchClients(pagination.page);
      }
    } catch (err) {
      if (!axios.isCancel(err)) {
        setError(err.message);
      }
      throw err;
    } finally {
      setLoading(false);
    }
  }, [clients.length, pagination.page, fetchClients]);

  const regenerateApiKey = useCallback(async (clientId) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await apiService.clients.regenerateApiKey(clientId);
      
      // Update the client in the local state
      setClients(prev => prev.map(client => 
        client.id === clientId ? { ...client, ...response.client } : client
      ));
      
      return response;
    } catch (err) {
      if (!axios.isCancel(err)) {
        setError(err.message);
      }
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Load clients on mount
  useEffect(() => {
    fetchClients().catch(err => {
      // Ignore cancelled requests on mount
      if (!axios.isCancel(err)) {
        console.error('Failed to fetch clients on mount:', err);
      }
    });
  }, [fetchClients]);

  return {
    clients,
    loading,
    error,
    pagination,
    fetchClients,
    createClient,
    updateClient,
    deleteClient,
    regenerateApiKey,
    clearError,
  };
};