import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/common/Layout';
import Loading from './components/common/Loading';

// Lazy load pages for better performance
const Login = React.lazy(() => import('./pages/Login'));
const SignUp = React.lazy(() => import('./pages/SignUp'));
const OAuthCallback = React.lazy(() => import('./pages/OAuthCallback'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Clients = React.lazy(() => import('./pages/Clients'));
const Users = React.lazy(() => import('./pages/Users'));
const Settings = React.lazy(() => import('./pages/Settings'));

// Protected route component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return <Loading />;
  }
  
  return isAuthenticated ? children : <Navigate to="/login" />;
};

// Public route component (redirect if already authenticated)
const PublicRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return <Loading />;
  }
  
  return !isAuthenticated ? children : <Navigate to="/dashboard" />;
};

function AppContent() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        {/* Public routes */}
        <Route 
          path="/login" 
          element={
            <PublicRoute>
              <React.Suspense fallback={<Loading />}>
                <Login />
              </React.Suspense>
            </PublicRoute>
          } 
        />
        
        <Route 
          path="/signup" 
          element={
            <PublicRoute>
              <React.Suspense fallback={<Loading />}>
                <SignUp />
              </React.Suspense>
            </PublicRoute>
          } 
        />
        
        {/* OAuth callback route - not protected to allow authentication flow */}
        <Route 
          path="/oauth/callback" 
          element={
            <React.Suspense fallback={<Loading />}>
              <OAuthCallback />
            </React.Suspense>
          } 
        />
        
        {/* Protected routes */}
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <Layout>
                <React.Suspense fallback={<Loading />}>
                  <Dashboard />
                </React.Suspense>
              </Layout>
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/clients/*" 
          element={
            <ProtectedRoute>
              <Layout>
                <React.Suspense fallback={<Loading />}>
                  <Clients />
                </React.Suspense>
              </Layout>
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/users" 
          element={
            <ProtectedRoute>
              <Layout>
                <React.Suspense fallback={<Loading />}>
                  <Users />
                </React.Suspense>
              </Layout>
            </ProtectedRoute>
          } 
        />
        
        <Route 
          path="/settings/*" 
          element={
            <ProtectedRoute>
              <Layout>
                <React.Suspense fallback={<Loading />}>
                  <Settings />
                </React.Suspense>
              </Layout>
            </ProtectedRoute>
          } 
        />
        
        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/dashboard" />} />
        
        {/* 404 route */}
        <Route path="*" element={<div>404 - Page Not Found</div>} />
      </Routes>
    </Router>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      cacheTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;