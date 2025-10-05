// Utility functions for handling JWT tokens from both OAuth and email login

/**
 * Decode JWT token without verification (client-side)
 * Note: This is for reading token data only, not for security validation
 */
export function decodeJWT(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Error decoding JWT:', error);
    return null;
  }
}

/**
 * Extract user information from JWT token
 */
export function getUserFromToken(token) {
  const decoded = decodeJWT(token);
  if (!decoded) return null;
  
  return {
    id: decoded.sub,
    email: decoded.email,
    name: decoded.name,
    type: decoded.type, // 'admin' or 'client'
    provider: decoded.provider, // 'email', 'google', 'github'
    issuedAt: decoded.iat,
    expiresAt: decoded.exp
  };
}

/**
 * Check if token is expired
 */
export function isTokenExpired(token) {
  const decoded = decodeJWT(token);
  if (!decoded || !decoded.exp) return true;
  
  const currentTime = Math.floor(Date.now() / 1000);
  return decoded.exp < currentTime;
}

/**
 * Get login method display name
 */
export function getLoginMethodDisplay(provider) {
  const methods = {
    email: '📧 Email & Password',
    google: '🔗 Google OAuth',
    github: '🔗 GitHub OAuth'
  };
  return methods[provider] || '🔐 Unknown Method';
}

/**
 * Format token for API requests
 */
export function formatAuthHeader(token) {
  return `Bearer ${token}`;
}

/**
 * Validate token structure (basic check)
 */
export function isValidTokenStructure(token) {
  if (!token || typeof token !== 'string') return false;
  
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  
  const decoded = decodeJWT(token);
  return decoded && decoded.sub && decoded.type;
}
