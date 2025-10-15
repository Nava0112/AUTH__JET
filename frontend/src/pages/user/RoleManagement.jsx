import React from 'react';

const RoleManagement = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white p-8 rounded-lg shadow">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Role Management</h1>
          
          <div className="space-y-6">
            <div className="border-b pb-4">
              <h3 className="text-lg font-medium text-gray-900">Current Role</h3>
              <div className="mt-2 bg-blue-50 border border-blue-200 rounded-md p-3">
                <span className="text-blue-800 font-medium">User</span>
                <p className="text-blue-600 text-sm mt-1">Basic access level</p>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Available Roles</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 border rounded-md">
                  <div>
                    <span className="font-medium text-gray-900">Admin</span>
                    <p className="text-gray-600 text-sm">Full system access</p>
                  </div>
                  <button className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm hover:bg-indigo-700">
                    Request
                  </button>
                </div>
                
                <div className="flex items-center justify-between p-3 border rounded-md">
                  <div>
                    <span className="font-medium text-gray-900">Moderator</span>
                    <p className="text-gray-600 text-sm">Content moderation access</p>
                  </div>
                  <button className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm hover:bg-indigo-700">
                    Request
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <p className="text-sm text-blue-800">
                🔧 Role Management Page - Ready for backend integration
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 text-center">
          <a href="/user/profile" className="text-indigo-600 hover:text-indigo-500 text-sm">
            ← Back to Profile
          </a>
        </div>
      </div>
    </div>
  );
};

export default RoleManagement;