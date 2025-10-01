import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/auth';
import Loading from '../components/common/Loading';

const OAuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { checkAuthStatus } = useAuth();
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Check for error from backend
        const errorParam = searchParams.get('error');
        if (errorParam) {
          let errorMessage = 'OAuth authentication failed';
          
          switch (errorParam) {
            case 'oauth_failed':
              errorMessage = 'OAuth authentication failed. Please try again.';
              break;
            case 'invalid_state':
              errorMessage = 'Invalid OAuth state. Please try again.';
              break;
            case 'access_denied':
              errorMessage = 'Access denied. You need to grant permissions to continue.';
              break;
            default:
              errorMessage = `Authentication error: ${errorParam}`;
          }
          
          setError(errorMessage);
          setTimeout(() => navigate('/login'), 3000);
          return;
        }

        // Get tokens from URL parameters (sent by backend)
        const accessToken = searchParams.get('access_token');
        const refreshToken = searchParams.get('refresh_token');
        const userStr = searchParams.get('user');

        if (!accessToken || !refreshToken || !userStr) {
          throw new Error('Missing authentication data');
        }

        // Parse user data
        const user = JSON.parse(userStr);

        // Store tokens and user data
        authService.setToken(accessToken);
        authService.setRefreshToken(refreshToken);
        authService.setUser(user);

        // Update auth context
        await checkAuthStatus();

        // Clear URL parameters for security
        window.history.replaceState({}, document.title, '/dashboard');
        
        // Redirect to dashboard
        navigate('/dashboard', { replace: true });
      } catch (err) {
        console.error('OAuth callback error:', err);
        setError(err.message || 'An error occurred during authentication');
        setTimeout(() => navigate('/login'), 3000);
      }
    };

    handleCallback();
  }, [searchParams, navigate, checkAuthStatus]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
              <svg
                className="h-6 w-6 text-red-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Authentication Failed
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              {error}
            </p>
            <p className="mt-2 text-center text-sm text-gray-500">
              Redirecting to login page...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <Loading />
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Completing authentication...
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Please wait while we log you in
          </p>
        </div>
      </div>
    </div>
  );
};

export default OAuthCallback;
