import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

const UserLogin = () => {
  const [searchParams] = useSearchParams();
  const [appData, setAppData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isLogin, setIsLogin] = useState(true);

  const clientId = searchParams.get('client_id');
  const applicationId = searchParams.get('application_id');
  const redirectUri = searchParams.get('redirect_uri');

  // Fetch application data from backend
  useEffect(() => {
    // Replace the fetchAppData function with this:
      const fetchAppData = async () => {
        if (!clientId || !applicationId) {
          setError('Missing client_id or application_id');
          setLoading(false);
          return;
        }

        try {
          const response = await fetch(
            `http://localhost:8000/api/user/applications/${applicationId}?client_id=${clientId}`
          );

          if (response.ok) {
            const data = await response.json();
            setAppData(data.application);
          } else {
            // If API fails, use fallback data
            console.warn('API returned error, using fallback data');
            setAppData({
              name: searchParams.get('app_name') || 'Application',
              description: 'Secure authentication service',
              auth_mode: 'basic'
            });
          }
        } catch (err) {
          // If network error, use fallback data
          console.warn('Network error, using fallback data:', err.message);
          setAppData({
            name: searchParams.get('app_name') || 'Application',
            description: 'Secure authentication service', 
            auth_mode: 'basic'
          });
        } finally {
          setLoading(false);
        }
      };

    fetchAppData();
  }, [clientId, applicationId]);

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading application...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full text-center bg-white p-8 rounded-2xl shadow-lg">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Application Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="space-y-3">
            <a href="/" className="block bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors">
              Return to AuthJet
            </a>
            <p className="text-xs text-gray-500">
              Client ID: {clientId || 'Not provided'} | App ID: {applicationId || 'Not provided'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const application = appData || {
    name: 'Application',
    description: 'Secure authentication service',
    logo_url: null,
    auth_mode: 'basic'
  };

  // In the handleSubmit function, replace the redirect logic:

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      email: formData.get('email'),
      password: formData.get('password'),
      client_id: clientId,
      application_id: applicationId
    };

    if (!isLogin) {
      data.name = formData.get('name');
    }

    try {
      const endpoint = isLogin ? '/api/user/login' : '/api/user/register';
      const response = await fetch(`http://localhost:8000${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // 🆕 ADD THIS for cookies
      body: JSON.stringify(data)
});

      const result = await response.json();

      if (response.ok) {
        // Store tokens
        localStorage.setItem('accessToken', result.access_token);
        localStorage.setItem('refreshToken', result.refresh_token);
        localStorage.setItem('userData', JSON.stringify(result.user));

        // 🎯 FIXED: Always redirect back to client application
        if (redirectUri) {
          // Redirect to client application with tokens as URL parameters
          const tokenParams = new URLSearchParams({
            access_token: result.access_token,
            refresh_token: result.refresh_token,
            token_type: result.token_type,
            expires_in: result.expires_in,
            user_id: result.user.id,
            user_email: result.user.email,
            user_role: result.user.role
          });
          
          // Use the redirect_uri from parameters
          window.location.href = `${redirectUri}?${tokenParams.toString()}`;
        } else {
          // If no redirect_uri provided, use the application's main_page_url
          if (appData && appData.main_page_url) {
            const tokenParams = new URLSearchParams({
              access_token: result.access_token,
              refresh_token: result.refresh_token,
              token_type: result.token_type,
              expires_in: result.expires_in
            });
            window.location.href = `${appData.main_page_url}?${tokenParams.toString()}`;
          } else {
            // Fallback: go to profile page
            window.location.href = '/user/profile';
          }
        }
      } else {
        alert(result.error || `Failed to ${isLogin ? 'login' : 'register'}`);
      }
    } catch (err) {
      alert('Network error: ' + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Application Header */}
        <div className="text-center">
          {application.logo_url && (
            <img
              src={application.logo_url}
              alt={application.name}
              className="mx-auto h-16 w-16 rounded-lg object-cover mb-4 shadow-md border"
            />
          )}
          {!application.logo_url && (
            <div className="mx-auto h-16 w-16 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center mb-4 shadow-md">
              <span className="text-white font-bold text-xl">
                {application.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {application.name}
          </h1>
          
          {application.description && (
            <p className="text-gray-600 text-lg mb-4 max-w-sm mx-auto leading-relaxed">
              {application.description}
            </p>
          )}
          
          <div className="inline-flex items-center bg-white px-3 py-1 rounded-full text-sm text-gray-600 border shadow-sm mb-2">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
            Secure JWT Authentication
          </div>
        </div>

        {/* Login/Register Form */}
        <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
          <div className="flex justify-center mb-6">
            <div className="bg-gray-100 rounded-lg p-1 flex">
              <button
                type="button"
                onClick={() => setIsLogin(true)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  isLogin 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setIsLogin(false)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  !isLogin 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Sign Up
              </button>
            </div>
          </div>

          <h2 className="text-xl font-semibold text-gray-900 mb-6 text-center">
            {isLogin ? 'Sign in to your account' : 'Create your account'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required={!isLogin}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                  placeholder="Enter your full name"
                />
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                placeholder="Enter your email address"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete={isLogin ? "current-password" : "new-password"}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                placeholder={isLogin ? "Enter your password" : "Create a password"}
                minLength="6"
              />
            </div>

            {isLogin && (
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
                    Remember me
                  </label>
                </div>
                <a href="#" className="text-sm text-indigo-600 hover:text-indigo-500 transition-colors">
                  Forgot password?
                </a>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 px-4 rounded-lg hover:from-indigo-700 hover:to-purple-700 focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200 font-medium shadow-md"
            >
              {isLogin ? 'Sign in' : 'Create account'}
            </button>
          </form>

          {/* Toggle between login/register */}
          <div className="mt-6 text-center">
            <p className="text-gray-600">
              {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="font-medium text-indigo-600 hover:text-indigo-500 transition-colors"
              >
                {isLogin ? 'Sign up now' : 'Sign in instead'}
              </button>
            </p>
          </div>
        </div>

        {/* Debug info & Back link */}
        <div className="text-center space-y-3">
          
          <a href="/" className="inline-block text-indigo-600 hover:text-indigo-500 text-sm bg-white px-4 py-2 rounded-lg border transition-colors">
            ← Back to AuthJet Portal
          </a>
        </div>
      </div>
    </div>
  );
};

export default UserLogin;