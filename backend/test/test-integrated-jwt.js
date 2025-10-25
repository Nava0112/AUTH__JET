require('dotenv').config();
const jwtService = require('./src/services/jwt.service.');
const database = require('./src/utils/database');

async function testJWTIntegration() {
  console.log('🧪 Testing JWT Integration (from root)...\n');
  
  try {
    await database.connect();
    console.log('✅ Database connected\n');

    const testClientId = 2; // Use existing client
    const testUserId = 'test-user-root';
    
    console.log('1. Testing access token generation...');
    const accessToken = await jwtService.generateAccessToken(
      testUserId,
      'user',
      testClientId,
      { email: 'test@root.com' }
    );
    console.log('✅ Access token generated');
    console.log('   Length:', accessToken.length);
    console.log('   Preview:', accessToken.substring(0, 50) + '...');
    console.log('');

    console.log('2. Testing token verification...');
    const decoded = await jwtService.verifyToken(accessToken, testClientId);
    console.log('✅ Token verified:');
    console.log('   User:', decoded.sub);
    console.log('   Client:', decoded.client_id);
    console.log('   Type:', decoded.user_type);
    console.log('');

    console.log('3. Testing JWKS...');
    const jwks = await jwtService.getPublicJwks(testClientId);
    console.log('✅ JWKS retrieved:');
    console.log('   Key Type:', jwks.keys[0].kty);
    console.log('   Algorithm:', jwks.keys[0].alg);
    console.log('   KID:', jwks.keys[0].kid);
    console.log('');

    console.log('🎉 JWT Integration Test COMPLETED SUCCESSFULLY!');
    console.log('\n📋 Summary:');
    console.log('   ✅ Per-client key system working');
    console.log('   ✅ JWT signing with client keys');
    console.log('   ✅ JWT verification with client keys');
    console.log('   ✅ JWKS endpoints');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
  } finally {
    await database.close();
  }
}

testJWTIntegration();