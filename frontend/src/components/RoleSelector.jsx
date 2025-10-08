import React, { useState, useEffect } from 'react';

const RoleSelector = ({ userId, clientId, applicationId, currentRole, availableRoles, onRoleRequest }) => {
  const [selectedRole, setSelectedRole] = useState(currentRole);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [requestHistory, setRequestHistory] = useState([]);

  useEffect(() => {
    fetchRequestHistory();
  }, [userId, clientId, applicationId]);

  const fetchRequestHistory = async () => {
    try {
      const token = localStorage.getItem('userAccessToken');
      const response = await fetch(
        `http://localhost:8000/api/user/${userId}/role-requests?client_id=${clientId}&application_id=${applicationId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setRequestHistory(data.requests || []);
      }
    } catch (error) {
      console.error('Failed to fetch request history:', error);
    }
  };

  const handleRoleRequest = async () => {
    if (selectedRole === currentRole) {
      setMessage('You already have this role');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const token = localStorage.getItem('userAccessToken');
      const response = await fetch(
        `http://localhost:8000/api/user/${userId}/request-role?client_id=${clientId}&application_id=${applicationId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            requested_role: selectedRole
          })
        }
      );

      const data = await response.json();

      if (response.ok) {
        setMessage('Role upgrade request submitted! The application admin will review your request within 3 days.');
        await fetchRequestHistory();
        if (onRoleRequest) {
          onRoleRequest(selectedRole);
        }
      } else {
        setMessage(data.error || 'Failed to submit role request');
      }
    } catch (error) {
      setMessage('Network error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getRoleHierarchy = (roles) => {
    // Define role hierarchy (you can customize this)
    const hierarchy = {
      'admin': 4,
      'moderator': 3,
      'user': 2,
      'viewer': 1
    };
    
    return roles.sort((a, b) => (hierarchy[b] || 0) - (hierarchy[a] || 0));
  };

  const canRequestRole = (role) => {
    const hierarchy = {
      'admin': 4,
      'moderator': 3,
      'user': 2,
      'viewer': 1
    };
    
    const currentLevel = hierarchy[currentRole] || 0;
    const requestedLevel = hierarchy[role] || 0;
    
    return requestedLevel > currentLevel;
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      'pending': { color: 'bg-yellow-100 text-yellow-800', text: 'Pending Review' },
      'approved': { color: 'bg-green-100 text-green-800', text: 'Approved' },
      'rejected': { color: 'bg-red-100 text-red-800', text: 'Rejected' },
      'expired': { color: 'bg-gray-100 text-gray-800', text: 'Expired' }
    };
    
    const config = statusConfig[status] || statusConfig.pending;
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        {config.text}
      </span>
    );
  };

  const sortedRoles = getRoleHierarchy(availableRoles || []);

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Role Management</h3>
      
      {/* Current Role */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Current Role
        </label>
        <div className="px-3 py-2 bg-gray-50 rounded-md border">
          <span className="font-medium text-gray-900">{currentRole}</span>
        </div>
      </div>

      {/* Role Selection */}
      <div className="mb-6">
        <label htmlFor="role-select" className="block text-sm font-medium text-gray-700 mb-2">
          Request Role Upgrade
        </label>
        <select
          id="role-select"
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value)}
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
        >
          {sortedRoles.map(role => (
            <option 
              key={role} 
              value={role}
              disabled={!canRequestRole(role)}
            >
              {role} {role === currentRole ? '(Current)' : ''}
              {!canRequestRole(role) ? ' (Lower role)' : ''}
            </option>
          ))}
        </select>
        <p className="mt-2 text-sm text-gray-500">
          Select a higher role to request permission upgrade
        </p>
      </div>

      {/* Request Button */}
      <div className="mb-6">
        <button
          onClick={handleRoleRequest}
          disabled={loading || !canRequestRole(selectedRole) || selectedRole === currentRole}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Submitting Request...
            </>
          ) : (
            'Request Role Upgrade'
          )}
        </button>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-6 p-4 rounded-md ${
          message.includes('success') || message.includes('submitted') 
            ? 'bg-green-50 text-green-700' 
            : 'bg-red-50 text-red-700'
        }`}>
          {message}
        </div>
      )}

      {/* Request History */}
      {requestHistory.length > 0 && (
        <div>
          <h4 className="text-md font-medium text-gray-900 mb-3">Request History</h4>
          <div className="space-y-3">
            {requestHistory.map((request) => (
              <div key={request.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <span className="font-medium">{request.current_role}</span>
                  <span className="mx-2">→</span>
                  <span className="font-medium">{request.requested_role}</span>
                  <p className="text-sm text-gray-500">
                    Requested: {new Date(request.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  {getStatusBadge(request.status)}
                  {request.admin_notes && (
                    <p className="text-sm text-gray-600 mt-1">{request.admin_notes}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default RoleSelector;