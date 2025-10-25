require('dotenv').config();
const ClientKeyService = require('./src/services/clientKey.service');
const database = require('./src/utils/database');

async function testClientKeysSimple() {
  console.log('🧪 Testing Client Keys (from root)...\n');
  
  try {
    await database.connect();
    console.log('✅ Database connected\n');

    // Find a client without active key
    const result = await database.query(`
      SELECT c.id FROM clients c 
      LEFT JOIN client_keys ck ON c.id = ck.client_id AND ck.is_active = true 
      WHERE ck.id IS NULL 
      ORDER BY c.id 
      LIMIT 1
    `);
    
    const testClientId = result.rows.length > 0 ? result.rows[0].id : 3; // Use next available
    
    console.log('Using client ID:', testClientId);
    console.log('');

    console.log('1. Generating key pair...');
    const keyPair = await ClientKeyService.generateKeyPair(testClientId);
    console.log('✅ Key pair generated:');
    console.log('   Key ID:', keyPair.keyId);
    console.log('   KID:', keyPair.kid);
    console.log('');

    console.log('2. Testing JWT signing...');
    const testPayload = { sub: 'test-user', email: 'test@client.com' };
    const token = await ClientKeyService.signJwt(testClientId, testPayload);
    console.log('✅ JWT signed successfully');
    console.log('   Token length:', token.length);
    console.log('');

    console.log('3. Testing JWT verification...');
    const decoded = await ClientKeyService.verifyJwt(testClientId, token);
    console.log('✅ JWT verified:');
    console.log('   User:', decoded.sub);
    console.log('   Email:', decoded.email);
    console.log('');

    console.log('🎉 Client Keys Test COMPLETED SUCCESSFULLY!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await database.close();
  }
}

testClientKeysSimple();