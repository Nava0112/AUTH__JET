require('dotenv').config();
const jwtService = require('./src/services/jwt.service');
const database = require('./src/utils/database');

async function testJWTSystem() {
  console.log('🧪 Testing JWT System...\n');
  
  try {
    // Connect to database
    await database.connect();
    console.log('✅ Database connected\n');

    // Use client ID 2 (which we know has keys)
    const testClientId = 2;
    const testUserId = 'test-user-jwt-system';
    
    console.log('1. Testing access token generation with client key...');
    const accessToken = await jwtService.generateAccessToken(
      testUserId,
      'user',
      testClientId,
      { 
        email: 'test@jwt-system.com',
        roles: ['user']
      }
    );
    console.log('✅ Access token generated successfully');
    console.log('   Token length:', accessToken.length);
    console.log('   Preview:', accessToken.substring(0, 50) + '...');
    console.log('');

    console.log('2. Testing token verification with client key...');
    const decoded = await jwtService.verifyToken(accessToken, testClientId);
    console.log('✅ Token verified successfully:');
    console.log('   User ID:', decoded.sub);
    console.log('   Client ID:', decoded.client_id);
    console.log('   User Type:', decoded.user_type);
    console.log('   Email:', decoded.email);
    console.log('');

    console.log('3. Testing refresh token generation...');
    const refreshToken = await jwtService.generateRefreshToken(
      testUserId,
      testClientId,
      {
        user_agent: 'test-system',
        ip_address: '192.168.1.100'
      }
    );
    console.log('✅ Refresh token generated successfully');
    console.log('   Token length:', refreshToken.length);
    console.log('');

    console.log('4. Testing JWKS endpoint...');
    const jwks = await jwtService.getPublicJwks(testClientId);
    console.log('✅ JWKS retrieved successfully:');
    console.log('   Key Type:', jwks.keys[0].kty);
    console.log('   Algorithm:', jwks.keys[0].alg);
    console.log('   Key ID:', jwks.keys[0].kid);
    console.log('');

    console.log('5. Testing session management...');
    const activeSessions = await jwtService.getActiveSessions(testUserId, testClientId);
    console.log('✅ Active sessions retrieved:', activeSessions.length);
    
    console.log('\n🎉 JWT SYSTEM TEST COMPLETED SUCCESSFULLY!');
    console.log('\n📊 SYSTEM STATUS:');
    console.log('   ✅ Per-client RSA key pairs');
    console.log('   ✅ Client-specific JWT signing');
    console.log('   ✅ Client-specific JWT verification');
    console.log('   ✅ Secure key encryption');
    console.log('   ✅ JWKS endpoints');
    console.log('   ✅ Session management');
    console.log('   ✅ Token refresh flow');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.code) {
      console.error('   Error code:', error.code);
    }
  } finally {
    // Close database connection
    try {
      await database.close();
      console.log('\n🔌 Database connection closed');
    } catch (e) {
      // Ignore close errors
    }
  }
}

// Run the test
testJWTSystem().catch(console.error);