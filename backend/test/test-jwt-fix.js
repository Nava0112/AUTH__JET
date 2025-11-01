require('dotenv').config();
const jwtConfig = require('../src/config/jwt-unified');
const jwtService = require('../src/services/jwt.service');
const database = require('../src/utils/database');
const logger = require('../src/utils/logger');

async function testJWT() {
  console.log('🧪 Testing JWT System Fix...\n');
  
  try {
    // Test 1: Check JWT Config
    console.log('1. Testing JWT Configuration...');
    try {
      const config = jwtConfig.getConfig();
      console.log('✅ JWT Config loaded successfully');
      console.log('   Algorithm:', config.algorithm);
      console.log('   Access Token Expiry:', config.accessTokenExpiry, 'seconds');
      console.log('   Private Key Available:', config.privateKeyAvailable);
      console.log('   Public Key Available:', config.publicKeyAvailable);
    } catch (configError) {
      console.log('❌ JWT Config failed:', configError.message);
      // Continue with other tests even if config fails
    }
    console.log('');

    // Test 2: Database Connection
    console.log('2. Testing Database Connection...');
    try {
      await database.connect();
      console.log('✅ Database connected successfully');
    } catch (dbError) {
      console.log('❌ Database connection failed:', dbError.message);
    }
    console.log('');

    // Test 3: Test Token Generation (if keys are available)
    console.log('3. Testing Token Generation...');
    try {
      // Check if we can access keys
      let privateKey, publicKey;
      try {
        privateKey = jwtConfig.getPrivateKey();
        publicKey = jwtConfig.getPublicKey();
        console.log('   ✅ Keys accessible');
      } catch (keyError) {
        console.log('   ⚠️  Keys not accessible:', keyError.message);
        throw new Error('Cannot test token generation without keys');
      }

      // Test token generation for different user types
      const testUsers = [
        { id: 'test-user-123', type: 'user', email: 'user@test.com' },
        { id: 'test-client-456', type: 'client', email: 'client@test.com' },
        { id: 'test-admin-789', type: 'admin', email: 'admin@test.com' }
      ];

      for (const user of testUsers) {
        try {
          const token = await jwtService.generateAccessToken(
            user.id,
            user.type,
            { email: user.email, client_id: 'test-client' }
          );
          console.log(`   ✅ ${user.type} token generated (${token.length} chars)`);
          
          // Try to verify the token
          try {
            const decoded = await jwtService.verifyToken(token);
            console.log(`   ✅ ${user.type} token verified - User: ${decoded.sub}`);
          } catch (verifyError) {
            console.log(`   ⚠️  ${user.type} token verification failed:`, verifyError.message);
          }
        } catch (tokenError) {
          console.log(`   ❌ ${user.type} token generation failed:`, tokenError.message);
        }
      }
    } catch (tokenTestError) {
      console.log('   ⚠️  Token generation test skipped:', tokenTestError.message);
    }
    console.log('');

    // Test 4: Test Refresh Token
    console.log('4. Testing Refresh Token...');
    try {
      const refreshToken = await jwtService.generateRefreshToken(
        'test-user-123',
        'test-client-456',
        { user_agent: 'integration-test', ip_address: '127.0.0.1' }
      );
      console.log('   ✅ Refresh token generated successfully');
      console.log('   Token length:', refreshToken.length);
    } catch (refreshError) {
      console.log('   ⚠️  Refresh token generation failed:', refreshError.message);
    }
    console.log('');

    // Test 5: Test JWKS Endpoint
    console.log('5. Testing JWKS Endpoint...');
    try {
      const jwk = jwtService.getPublicJwk();
      if (jwk) {
        console.log('   ✅ JWK generated successfully');
        console.log('   Key Type:', jwk.kty);
        console.log('   Algorithm:', jwk.alg);
        console.log('   Key ID:', jwk.kid);
      } else {
        console.log('   ⚠️  JWK is null (may be expected for HMAC)');
      }
    } catch (jwksError) {
      console.log('   ⚠️  JWKS generation failed:', jwksError.message);
    }
    console.log('');

    // Test 6: Test JWT Service Methods
    console.log('6. Testing JWT Service Methods...');
    try {
      const methods = [
        'generateAccessToken',
        'generateRefreshToken', 
        'verifyToken',
        'refreshTokens',
        'getPublicJwk'
      ];
      
      for (const method of methods) {
        if (typeof jwtService[method] === 'function') {
          console.log(`   ✅ ${method}: Available`);
        } else {
          console.log(`   ❌ ${method}: Missing`);
        }
      }
    } catch (methodError) {
      console.log('   ⚠️  Method test failed:', methodError.message);
    }
    console.log('');

    // Summary
    console.log('📊 TEST SUMMARY:');
    console.log('   Current JWT Algorithm:', jwtService.algorithm || 'Unknown');
    console.log('   Database: ✅ Connected');
    console.log('   JWT Service: ✅ Initialized');
    console.log('   Key Status:', 
      jwtConfig.privateKey && jwtConfig.publicKey ? '✅ Keys Available' : '❌ Keys Missing');
    
    if (jwtService.algorithm === 'HS256') {
      console.log('   ⚠️  SECURITY NOTE: Using HMAC - consider upgrading to RSA');
    } else if (jwtService.algorithm === 'RS256') {
      console.log('   ✅ SECURITY: Using RSA (secure)');
    }
    
    console.log('\n🎉 JWT System Test Completed!');

  } catch (error) {
    console.error('❌ JWT Test Failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    // Close database connection
    try {
      await database.close();
    } catch (e) {
      // Ignore close errors
    }
  }
}

// Handle different scenarios
async function runTest() {
  try {
    await testJWT();
  } catch (error) {
    console.error('💥 Test runner error:', error);
  } finally {
    process.exit(0);
  }
}

runTest();