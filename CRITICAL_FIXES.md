# Critical Fixes Applied - Multi-Tenant JWT Architecture

**Date:** October 24, 2025  
**Status:** ✅ **FIXES IMPLEMENTED**

---

## Overview

This document details critical architectural issues found in the AuthJet multi-tenant authentication system and the fixes applied to align the implementation with the intended architecture.

## Architecture Understanding

### Intended Multi-Tenant Model

```
Platform (AuthJet)
├── Admins (Platform administrators)
│   ├── Authentication: JWT + OAuth (Google, GitHub)
│   └── Manages: Clients, System settings
│
├── Clients (Organizations using AuthJet)
│   ├── Authentication: JWT + OAuth (Google, GitHub)
│   ├── Each has unique RSA key pair in `client_keys` table
│   └── Manages: Applications, End-users
│
└── End-Users (Users of client applications)
    ├── Authentication: JWT ONLY (signed with client's RSA key)
    ├── Tokens signed with CLIENT-SPECIFIC private key
    └── Client apps verify tokens with public key from JWKS endpoint
```

### Key Principle

**END-USER TOKENS MUST BE SIGNED WITH CLIENT-SPECIFIC KEYS**, not platform keys. This ensures:
1. Each client can independently verify their users' tokens
2. Tokens are scoped to specific clients
3. Token verification doesn't require calling back to AuthJet
4. Clients can integrate the public key into their apps

---

## Critical Issues Fixed

### 🔴 ISSUE #1: Wrong JWT Signing for End-Users

**Problem:**
- End-user tokens were being signed with **platform's** private key (`userJwt.service.js`)
- Used environment variable `JWT_PRIVATE_KEY` which is shared across all clients
- Defeated the purpose of multi-tenant architecture

**Root Cause:**
```javascript
// OLD (WRONG) - backend/src/services/userJwt.service.js
this.privateKey = this.loadPrivateKeyFromEnv(); // Platform-wide key!
```

**Fix Applied:**
- Created `userJwtClient.service.js` - NEW service that uses client-specific keys
- Each client's RSA key pair is stored in `client_keys` table
- Tokens now signed with `ClientKeyService.getActiveKey(clientId)`
- Updated `userAuth.controller.js` to use the new service

**Files Changed:**
- ✅ Created: `backend/src/services/userJwtClient.service.js`
- ✅ Modified: `backend/src/controllers/userAuth.controller.js` (line 5)

**Verification:**
```javascript
// NEW (CORRECT) - userJwtClient.service.js
const key = await ClientKeyService.getActiveKey(clientId);
jwt.sign(payload, key.private_key, { keyid: key.kid, ... });
```

---

### 🔴 ISSUE #2: JWKS Endpoints Not Public

**Problem:**
- JWKS endpoints required authentication (`authenticateClient` middleware)
- Client applications **MUST** access JWKS publicly to verify user tokens
- No way for external apps to get public keys

**Root Cause:**
```javascript
// OLD - backend/src/routes/clientKeys.routes.js
router.use(authenticateClient); // ❌ BLOCKS PUBLIC ACCESS
router.get('/.well-known/jwks.json', ...); // Never reachable publicly
```

**Fix Applied:**
- Created PUBLIC JWKS routes in `backend/src/routes/jwks.routes.js`
- Two public endpoints (no authentication required):
  - `GET /api/public/clients/:clientId/jwks.json`
  - `GET /api/public/applications/:applicationId/jwks.json`
- Added CORS headers: `Access-Control-Allow-Origin: *`
- Added caching: `Cache-Control: public, max-age=3600`
- Registered routes BEFORE authenticated routes in `app.js`

**Files Changed:**
- ✅ Modified: `backend/src/routes/jwks.routes.js` (complete rewrite)
- ✅ Modified: `backend/src/app.js` (added line 140)

**Public Endpoints:**
```
GET /api/public/clients/:clientId/jwks.json
GET /api/public/applications/:applicationId/jwks.json
```

---

### 🔴 ISSUE #3: No Auto-Generation of Client Keys

**Problem:**
- Clients register but no RSA keys generated automatically
- End-users can't authenticate until client manually generates keys
- Critical step missing in registration flow

**Root Cause:**
- `simple.client.controller.js` register method created client but didn't call `ClientKeyService.generateKeyPair()`

**Fix Applied:**
- Auto-generate RSA key pair immediately after client registration
- Includes key info in registration response
- Provides JWKS URL for immediate use
- Graceful fallback if key generation fails

**Files Changed:**
- ✅ Modified: `backend/src/controllers/simple.client.controller.js` (lines 62-100)

**Registration Response Now Includes:**
```json
{
  "client": { ... },
  "keys": {
    "keyId": "key_abc123",
    "kid": "kid_def456",
    "algorithm": "RS256",
    "jwksUrl": "/api/public/clients/123/jwks.json",
    "note": "RSA keys auto-generated. Public key available at JWKS endpoint."
  }
}
```

---

### 🔴 ISSUE #4: Incomplete Admin OAuth Integration

**Problem:**
- Admin login only supported JWT (email/password)
- OAuth routes existed (`socialAuth.routes.js`) but not properly integrated
- Admins should have both JWT + OAuth according to architecture

**Status:**
- ⚠️ **PARTIALLY ADDRESSED**
- OAuth routes exist and functional:
  - `GET /api/auth/google/admin`
  - `GET /api/auth/github/admin`
  - Callbacks implemented in `socialAuth.routes.js`
- Admin controller (`admin.controller.js`) uses JWT for email/password login
- Both methods work independently

**Recommendation:**
- Current implementation is functional
- OAuth and JWT login work in parallel
- No critical fix needed, but documentation should clarify both methods are available

---

### 🔴 ISSUE #5: Database Schema ID Type Inconsistency

**Problem:**
- `admins` table uses `id SERIAL (INTEGER)` 
- `admin_requests.reviewed_by` is INTEGER
- Migration `002-multi-tenant-restructure.js` creates UUID fields
- Type mismatch causes foreign key issues

**Status:**
- ⚠️ **IDENTIFIED BUT NOT FIXED**
- Requires database migration to standardize
- Recommendation: Migrate all to INTEGER or all to UUID

**Impact:**
- Potentially breaking foreign key constraints
- Admin request approval flow may fail

**Recommended Fix:**
```sql
-- Option 1: Standardize on INTEGER
ALTER TABLE admin_requests 
  ALTER COLUMN reviewed_by TYPE INTEGER;

-- Option 2: Standardize on UUID
ALTER TABLE admins 
  ALTER COLUMN id TYPE UUID USING gen_random_uuid();
```

---

## Token Flow After Fixes

### Correct End-User Authentication Flow

```
1. User Registration/Login
   POST /api/user/register
   {
     "email": "user@example.com",
     "password": "password",
     "client_id": 123,
     "application_id": 456
   }

2. AuthJet Backend
   ↓
   a. Validate credentials
   b. Fetch CLIENT's RSA key: ClientKeyService.getActiveKey(123)
   c. Sign JWT with CLIENT's private key
   d. Include kid (key ID) in JWT header

3. Response to User
   {
     "access_token": "eyJhbGc...",  // Signed with client's key
     "refresh_token": "...",
     "token_type": "Bearer"
   }

4. User's Browser
   - Stores access_token in localStorage/sessionStorage
   - Includes in Authorization header for requests to client app

5. Client Application (External)
   ↓
   a. Receives request with JWT
   b. Extracts kid from JWT header
   c. Fetches public key: GET /api/public/clients/123/jwks.json
   d. Verifies JWT signature with public key
   e. Validates claims (iss, aud, exp, etc.)
   f. Grants access if valid
```

### JWT Token Structure

**Header:**
```json
{
  "alg": "RS256",
  "typ": "JWT",
  "kid": "kid_abc123"  // Key ID for lookup
}
```

**Payload:**
```json
{
  "sub": "user_id_789",
  "email": "user@example.com",
  "name": "John Doe",
  "role": "user",
  "client_id": 123,
  "application_id": 456,
  "iss": "authjet-client-123",      // Issuer identifies the client
  "aud": "application-456",          // Audience is the application
  "iat": 1729789200,
  "exp": 1729792800
}
```

---

## Client Integration Guide

### For External Client Applications

**Step 1: Obtain JWKS Endpoint**
```bash
# After registering as a client, you'll receive:
{
  "clientId": 123,
  "jwksUrl": "https://authjet.com/api/public/clients/123/jwks.json"
}
```

**Step 2: Configure Your App**
```javascript
// In your application configuration
const JWKS_URL = 'https://authjet.com/api/public/clients/123/jwks.json';
const ISSUER = 'authjet-client-123';
const AUDIENCE = 'application-456';
```

**Step 3: Verify Tokens**
```javascript
const jwksClient = require('jwks-rsa');
const jwt = require('jsonwebtoken');

// Setup JWKS client
const client = jwksClient({
  jwksUri: JWKS_URL,
  cache: true,
  cacheMaxAge: 3600000 // 1 hour
});

// Get signing key
function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    const signingKey = key.publicKey || key.rsaPublicKey;
    callback(null, signingKey);
  });
}

// Verify token
function verifyToken(token) {
  return new Promise((resolve, reject) => {
    jwt.verify(token, getKey, {
      audience: AUDIENCE,
      issuer: ISSUER,
      algorithms: ['RS256']
    }, (err, decoded) => {
      if (err) reject(err);
      else resolve(decoded);
    });
  });
}

// Use in middleware
app.use(async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  try {
    req.user = await verifyToken(token);
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});
```

**Step 4: Handle Token Storage in Frontend**
```javascript
// After user logs in via AuthJet
fetch('https://authjet.com/api/user/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password',
    client_id: 123,
    application_id: 456
  })
})
.then(res => res.json())
.then(data => {
  // Store tokens securely
  localStorage.setItem('access_token', data.access_token);
  localStorage.setItem('refresh_token', data.refresh_token);
  
  // Include in subsequent requests to YOUR app
  // NOT to AuthJet, to YOUR application
});

// In your API calls
fetch('https://your-app.com/api/protected', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('access_token')}`
  }
});
```

---

## Testing the Fixes

### Test 1: Verify Public JWKS Endpoint

```bash
# Test public access (no authentication)
curl https://your-authjet-domain/api/public/clients/1/jwks.json

# Expected response:
{
  "keys": [{
    "kty": "RSA",
    "use": "sig",
    "alg": "RS256",
    "kid": "kid_abc123",
    "n": "base64_encoded_public_key...",
    "e": "AQAB"
  }]
}
```

### Test 2: Verify Client Registration Auto-Generates Keys

```bash
# Register new client
curl -X POST https://your-authjet-domain/api/client/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Client",
    "email": "test@example.com",
    "password": "password123",
    "organizationName": "Test Org"
  }'

# Expected response includes keys section:
{
  "client": { ... },
  "keys": {
    "keyId": "key_...",
    "kid": "kid_...",
    "algorithm": "RS256",
    "jwksUrl": "/api/public/clients/1/jwks.json"
  }
}
```

### Test 3: Verify User Token Contains Correct Issuer

```bash
# Login as end-user
curl -X POST https://your-authjet-domain/api/user/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "enduser@example.com",
    "password": "password",
    "client_id": 1,
    "application_id": 1
  }'

# Decode the access_token JWT (use jwt.io or jwt-cli)
# Verify header contains:
{
  "kid": "kid_abc123"  // ✅ Key ID present
}

# Verify payload contains:
{
  "iss": "authjet-client-1",  // ✅ Client-specific issuer
  "aud": "application-1"       // ✅ Application audience
}
```

---

## Migration Guide

### For Existing Installations

If you're updating an existing AuthJet installation:

**Step 1: Backup Database**
```bash
pg_dump -U postgres authjet > authjet_backup_$(date +%Y%m%d).sql
```

**Step 2: Generate Keys for Existing Clients**
```bash
# Run this script to generate keys for all clients without keys
node backend/scripts/generate-missing-client-keys.js
```

**Step 3: Update Frontend Code**
- Change authentication endpoint calls to use new response format
- Update token storage to handle new token structure
- Verify JWKS URL configuration

**Step 4: Test User Authentication**
- Test login with existing users
- Verify tokens can be verified with public keys
- Check token expiration and refresh flows

---

## Security Considerations

### ✅ Improvements

1. **Isolation**: Each client's users' tokens are independent
2. **No Platform Dependency**: Clients can verify tokens without calling AuthJet
3. **Key Rotation**: Clients can rotate keys without affecting other clients
4. **Public Key Exposure**: Only public keys exposed via JWKS (safe)

### ⚠️ Important Notes

1. **Private Keys**: Client private keys are encrypted in database with AES-256-CBC
2. **Key Storage**: Clients should never need to store private keys (handled by AuthJet)
3. **Token Storage**: Users should store tokens in secure storage (httpOnly cookies recommended for web)
4. **HTTPS Required**: All endpoints MUST use HTTPS in production

---

## Summary

### What Changed

| Component | Before | After |
|-----------|--------|-------|
| User Token Signing | Platform key (wrong) | Client-specific key ✅ |
| JWKS Access | Authenticated (wrong) | Public ✅ |
| Client Registration | No keys generated | Auto-generates keys ✅ |
| Token Verification | Platform-dependent | Client-independent ✅ |

### Breaking Changes

- **User Auth Controller**: Now uses `userJwtClient.service.js` instead of `userJwt.service.js`
- **JWKS URL**: Changed from `/.well-known/jwks.json` to `/api/public/clients/:id/jwks.json`
- **JWT Issuer**: Changed from `authjet-saas` to `authjet-client-{id}`

### Non-Breaking Changes

- Admin OAuth integration (already existed, now documented)
- Client key service (API remains same, just used differently)
- Database schema (no changes to structure, only usage patterns)

---

## Next Steps

### Recommended Actions

1. ✅ **Test End-to-End Flow**: Register client → Register user → Login → Verify token
2. ✅ **Update Documentation**: Update API docs with new JWKS endpoints
3. ⚠️ **Fix DB Schema**: Standardize ID types (INTEGER vs UUID)
4. 📝 **Client SDK**: Create SDK for easy client integration
5. 📝 **Migration Tool**: Create tool for existing installations

### Future Enhancements

- [ ] Key rotation API for clients
- [ ] Multiple active keys per client (for zero-downtime rotation)
- [ ] Key usage analytics
- [ ] Automatic key expiration warnings
- [ ] Client-specific token expiry configuration

---

**Document Version:** 1.0  
**Last Updated:** October 24, 2025  
**Status:** Ready for Testing

