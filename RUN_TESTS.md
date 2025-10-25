# Running Authentication Flow Tests

## Prerequisites

1. **PostgreSQL Database** must be running with the `authjet` database created
2. **Environment variables** must be configured in `backend/.env`
3. **Dependencies** must be installed

## Step-by-Step Instructions

### 1. Ensure Database is Running

```powershell
# Check if PostgreSQL is running
Get-Service -Name postgresql* | Select-Object Name,Status

# If not running, start it
# Start-Service postgresql-x64-<version>
```

### 2. Start the Backend Server

**Option A: In a separate terminal window**
```powershell
cd D:\Auth__Jet\AUTH__JET\backend
npm start
```

**Option B: In background (PowerShell)**
```powershell
cd D:\Auth__Jet\AUTH__JET\backend
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm start"
```

Wait for the server to start (you should see "AuthJet backend started successfully" or similar message).

### 3. Run the Tests

In a **NEW terminal window**:

```powershell
cd D:\Auth__Jet\AUTH__JET\backend
node test-authentication-flow.js
```

## Expected Test Flow

The test will execute 9 tests in sequence:

1. ✅ **Client Registration** - Register a new client organization
2. ✅ **Client Login** - Login as the client
3. ✅ **Public JWKS Endpoint** - Verify public key endpoint is accessible
4. ✅ **Create Application** - Client creates an application
5. ✅ **Get Application Info** - Retrieve application details (public)
6. ✅ **User Registration** - Register an end-user
7. ✅ **User Login** - Login as end-user
8. ✅ **Get User Profile** - Retrieve authenticated user profile
9. ✅ **Token Refresh** - Attempt to refresh user token

## What the Tests Verify

### Critical Architecture Checks

- ✅ **Client-Specific JWT Signing**: User tokens are signed with the client's RSA private key (not platform key)
- ✅ **Public JWKS Access**: Public keys are accessible without authentication
- ✅ **Auto-Generated Keys**: RSA keys are created automatically when client registers
- ✅ **JWT Token Structure**: Tokens contain correct `iss` (issuer) and `aud` (audience) claims
- ✅ **Multi-Tenant Isolation**: Each client has independent keys and users

## Troubleshooting

### Issue: "Client registration failed"

**Cause:** Server not running or database not accessible

**Solution:**
```powershell
# Check if server is running
Test-NetConnection -ComputerName localhost -Port 8000

# If not, start the server
cd D:\Auth__Jet\AUTH__JET\backend
npm start
```

### Issue: Database connection errors

**Solution:**
```powershell
# Verify .env configuration
cat D:\Auth__Jet\AUTH__JET\backend\.env | Select-String "DB_"

# Test database connection
psql -U postgres -d authjet -c "SELECT 1;"
```

### Issue: "JWKS endpoint test failed"

**Cause:** Public JWKS routes not registered or client keys not generated

**Solution:** Ensure the fixes were applied correctly:
- Check `backend/src/routes/jwks.routes.js` exists and is updated
- Check `backend/src/app.js` line 140 registers public routes
- Verify `client_keys` table exists in database

### Issue: "User registration failed"

**Cause:** Client doesn't have RSA keys

**Solution:**
```powershell
# Manually generate keys for the client (if auto-generation failed)
# After client login, call the key generation endpoint
# This should not be needed if fixes were applied correctly
```

## Manual Testing

If automated tests fail, you can manually test each endpoint:

### 1. Register Client
```powershell
$body = @{
    name = "Test Client"
    email = "test@example.com"
    password = "password123"
    organizationName = "Test Org"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8000/api/client/register" `
    -Method Post `
    -ContentType "application/json" `
    -Body $body
```

### 2. Check Public JWKS (replace {id} with client ID)
```powershell
Invoke-RestMethod -Uri "http://localhost:8000/api/public/clients/{id}/jwks.json"
```

### 3. Register User (replace IDs with actual values)
```powershell
$body = @{
    email = "user@example.com"
    password = "password123"
    name = "Test User"
    client_id = 1
    application_id = 1
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8000/api/user/register" `
    -Method Post `
    -ContentType "application/json" `
    -Body $body
```

## Success Indicators

When all tests pass, you should see:

```
============================================================
TEST SUMMARY
============================================================
Total Tests: 9
Passed: 9
Failed: 0
============================================================

🎉 All tests passed!

✅ VERIFICATION: Multi-tenant architecture working correctly!
✅ Client-specific JWT signing confirmed
✅ Public JWKS endpoint accessible
✅ End-to-end authentication flow successful
```

## Next Steps After Successful Tests

1. **Review Token Structure**: Check the JWT payload to see client-specific issuer
2. **Test with Real Client App**: Integrate a real application using the JWKS endpoint
3. **Load Testing**: Test with multiple concurrent users
4. **Security Audit**: Review token expiration, refresh flow, and key rotation

## Support

If tests continue to fail after following these steps:

1. Check `backend/logs/` for detailed error messages
2. Review `CRITICAL_FIXES.md` to ensure all fixes were applied
3. Verify database schema matches expected structure (see your database schema dump)
4. Check that all dependencies are installed: `npm install` in backend directory

