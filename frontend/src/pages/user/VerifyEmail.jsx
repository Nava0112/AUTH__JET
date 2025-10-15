import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('verifying');
  const [message, setMessage] = useState('');

  useEffect(() => {
    verifyEmail();
  }, []);

  const verifyEmail = async () => {
    const token = searchParams.get('token');
    
    if (!token) {
      setStatus('error');
      setMessage('Invalid verification link');
      return;
    }

    try {
      const response = await fetch('http://localhost:8000/api/user/verify-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token })
      });

      const data = await response.json();

      if (response.ok) {
        setStatus('success');
        setMessage('Email verified successfully! You can now log in to your account.');
        
        // Update local user data if user is logged in
        const userData = localStorage.getItem('userData');
        if (userData) {
          const user = JSON.parse(userData);
          user.email_verified = true;
          localStorage.setItem('userData', JSON.stringify(user));
        }
      } else {
        setStatus('error');
        setMessage(data.error || 'Email verification failed');
      }
    } catch (error) {
      setStatus('error');
      setMessage('Network error: ' + error.message);
    }
  };

  const resendVerification = async () => {
    try {
      const userData = localStorage.getItem('userData');
      if (!userData) {
        setMessage('Please log in to resend verification email');
        return;
      }

      const user = JSON.parse(userData);
      const response = await fetch('http://localhost:8000/api/user/resend-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: user.id,
          email: user.email
        })
      });

      if (response.ok) {
        setMessage('Verification email sent! Check your inbox.');
      } else {
        const data = await response.json();
        setMessage(data.error || 'Failed to resend verification email');
      }
    } catch (error) {
      setMessage('Network error: ' + error.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          {/* Status Icon */}
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full">
            {status === 'verifying' && (
              <svg className="animate-spin h-12 w-12 text-indigo-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {status === 'success' && (
              <svg className="h-12 w-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            {status === 'error' && (
              <svg className="h-12 w-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </div>

          {/* Title */}
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            {status === 'verifying' && 'Verifying Email...'}
            {status === 'success' && 'Email Verified!'}
            {status === 'error' && 'Verification Failed'}
          </h2>

          {/* Message */}
          <div className="mt-4">
            <p className="text-sm text-gray-600">
              {status === 'verifying' && 'Please wait while we verify your email address...'}
              {status === 'success' && message}
              {status === 'error' && message}
            </p>
          </div>

          {/* Actions */}
          <div className="mt-6 space-y-4">
            {status === 'success' && (
              <Link
                to="/user/login"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Continue to Login
              </Link>
            )}
            
            {status === 'error' && (
              <div className="space-y-3">
                <button
                  onClick={resendVerification}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Resend Verification Email
                </button>
                <Link
                  to="/user/login"
                  className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Back to Login
                </Link>
              </div>
            )}
          </div>

          {/* Additional Help */}
          {status === 'error' && (
            <div className="mt-6 p-4 bg-yellow-50 rounded-md">
              <div className="text-sm text-yellow-700">
                <p className="font-medium">Need help?</p>
                <p className="mt-1">
                  If you continue having issues, please contact the application administrator or check your spam folder.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;