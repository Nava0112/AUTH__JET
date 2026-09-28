import React from 'react';
import { useAuth } from '../../context/AuthContext';

const SecuritySettings = () => {
  const { user } = useAuth();
  return (
    <div className="bg-white shadow sm:rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900">Security Settings</h3>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">
          Manage your account security and password
        </p>

        {/* Current Session Info */}
        <div className="mt-6 border-t border-gray-200 pt-6">
          <h4 className="text-sm font-medium text-gray-900 mb-4">Current Session</h4>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-600">
              <p><strong>Email:</strong> {user?.email}</p>
              <p><strong>Last Login:</strong> {user?.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}</p>
              <p><strong>Login Count:</strong> {user?.login_count || 0}</p>
            </div>
          </div>
        </div>

        {/* Security Recommendations */}
        <div className="mt-8 border-t border-gray-200 pt-6">
          <h4 className="text-sm font-medium text-gray-900 mb-4">Security Recommendations</h4>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <ul className="text-sm text-blue-700 space-y-2">
              <li>• Use a strong, unique password for your AuthJet account</li>
              <li>• Enable two-factor authentication when available</li>
              <li>• Regularly review your active sessions</li>
              <li>• Use API keys with minimal required permissions</li>
              <li>• Keep your webhook secrets secure and rotate them regularly</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecuritySettings;