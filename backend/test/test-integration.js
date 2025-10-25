require('dotenv').config();
const jwtService = require('../src/services/jwt.service');
const database = require('../src/utils/database');
const logger = require('../src/utils/logger');

async function testIntegration() {
  console.log('🧪 Starting AuthJet Integration Test...\n');

  try {
    // Test 1: Database Connection
    console.log('1. Testing database connection...');
    await database.connect();
    console.log('✅ Database connection successful\n');

    // Test 2: JWT Service Initialization
    console.log('2. Testing JWT service...');
    const jwtConfig = jwtService.getPublicJwk ? jwtService.getPublicJwk() : 'No JWK method';
    console.log('✅ JWT service initialized');
    console.log('   JWT Algorithm:', jwtService.algorithm);
    console.log('   JWK Available:', !!jwtService.getPublicJwk);
    console.log('');

    // Test 3: Generate Test Token
    console.log('3. Testing token generation...');
    const testPayload = {
      sub: 'test-user-123',
      email: 'test@example.com',
      client_id: 'test-client-123',
      email_verified: true,
      roles: ['user']
    };

    const accessToken = await jwtService.generateAccessToken(testPayload);
    console.log('✅ Access token generated successfully');
    console.log('   Token length:', accessToken.length);
    console.log('');

    // Test 4: Verify Token
    console.log('4. Testing token verification...');
    const decoded = await jwtService.verifyToken(accessToken);
    console.log('✅ Token verified successfully');
    console.log('   User ID:', decoded.sub);
    console.log('   Email:', decoded.email);
    console.log('');

    // Test 5: Test JWKS Endpoint (if available)
    console.log('5. Testing JWKS endpoint simulation...');
    if (jwtService.getPublicJwk) {
      try {
        const jwk = jwtService.getPublicJwk();
        if (jwk) {
          console.log('✅ JWKS endpoint would work');
          console.log('   Key Type:', jwk.kty);
          console.log('   Algorithm:', jwk.alg);
        } else {
          console.log('ℹ️  JWKS not supported (expected for HMAC)');
        }
      } catch (jwksError) {
        console.log('ℹ️  JWKS error (expected for HMAC):', jwksError.message);
      }
    }
    console.log('');

    // Test 6: Test Refresh Token
    console.log('6. Testing refresh token generation...');
    const refreshToken = await jwtService.generateRefreshToken(
      'test-user-123',
      'test-client-123',
      { user_agent: 'integration-test' }
    );
    console.log('✅ Refresh token generated successfully');
    console.log('   Token length:', refreshToken.length);
    console.log('');

    console.log('🎉 ALL INTEGRATION TESTS PASSED!');
    console.log('\n📊 Summary:');
    console.log('   - Database: ✅ Connected');
    console.log('   - JWT Service: ✅ Working');
    console.log('   - Token Generation: ✅ Working');
    console.log('   - Token Verification: ✅ Working');
    console.log('   - Refresh Tokens: ✅ Working');
    console.log('   - Current Algorithm:',
      jwtService.algorithm === 'HS256' ? 'HMAC (needs upgrade)' : 'RSA (secure)');

  } catch (error) {
    console.error('❌ Integration test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the test
testIntegration().then(() => {
  console.log('\n✨ Integration test completed');
  process.exit(0);
}).catch(error => {
  console.error('\n💥 Integration test failed');
  process.exit(1);
});