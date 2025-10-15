import React from 'react';

const UserProfile = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white p-8 rounded-lg shadow">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">User Profile</h1>
          
          <div className="space-y-6">
            <div className="border-b pb-4">
              <h3 className="text-lg font-medium text-gray-900">Account Information</h3>
              <p className="text-gray-600 mt-2">Manage your account settings and preferences</p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <p className="mt-1 text-gray-900">John Doe</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <p className="mt-1 text-gray-900">user@example.com</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700">Role</label>
                <p className="mt-1 text-gray-900">User</p>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <p className="text-sm text-yellow-800">
                🔧 User Profile Page - Ready for backend integration
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 text-center">
          <a href="/user/login" className="text-indigo-600 hover:text-indigo-500 text-sm">
            ← Back to Login
          </a>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;