require('dotenv').config();
const ClientKeyService = require('../src/services/clientKey.service');
const database = require('../src/utils/database');

async function testClientKeys() {
  console.log('🧪 Testing Client Key System...\n');
  
  try {
    // Connect to database
    await database.connect();
    console.log('✅ Database connected\n');

    // Get a client that doesn't have a key yet, or use client ID 2
    const testClientId = await getTestClientId();
    console.log('Using client ID for testing:', testClientId);
    console.log('');

    // Check if client already has an active key
    console.log('1. Checking for existing active key...');
    const existingKey = await ClientKeyService.getActiveKey(testClientId);
    
    if (existingKey) {
      console.log('✅ Client already has active key:');
      console.log('   Key ID:', existingKey.key_id);
      console.log('   KID:', existingKey.kid);
      console.log('   Created:', existingKey.created_at);
      console.log('');
    } else {
      console.log('2. Generating key pair for client:', testClientId);
      const keyPair = await ClientKeyService.generateKeyPair(testClientId);
      console.log('✅ Key pair generated:');
      console.log('   Key ID:', keyPair.keyId);
      console.log('   KID:', keyPair.kid);
      console.log('   Public Key Length:', keyPair.publicKey.length);
      console.log('   Private Key Length:', keyPair.privateKey.length, '(store this securely!)');
      console.log('');
    }

    // Get the active key (should work now)
    console.log('3. Getting active key for client...');
    const activeKey = await ClientKeyService.getActiveKey(testClientId);
    if (activeKey) {
      console.log('✅ Active key retrieved:');
      console.log('   Key ID:', activeKey.key_id);
      console.log('   KID:', activeKey.kid);
      console.log('   Is Active:', activeKey.is_active);
      console.log('   Private Key Available:', !!activeKey.private_key);
      console.log('');
    } else {
      console.log('❌ No active key found');
      return;
    }

    console.log('4. Generating JWK for client...');
    const jwk = await ClientKeyService.getPublicJwk(testClientId);
    console.log('✅ JWK generated:');
    console.log('   Key Type:', jwk.kty);
    console.log('   Algorithm:', jwk.alg);
    console.log('   KID:', jwk.kid);
    console.log('');

    // Only test signing if we have a private key
    if (activeKey.private_key) {
      console.log('5. Testing JWT signing...');
      const testPayload = {
        sub: 'test-user-123',
        email: 'test@example.com',
        user_type: 'user'
      };
      
      const token = await ClientKeyService.signJwt(testClientId, testPayload);
      console.log('✅ JWT signed successfully:');
      console.log('   Token Length:', token.length);
      console.log('   Token Preview:', token.substring(0, 50) + '...');
      console.log('');

      console.log('6. Testing JWT verification...');
      const decoded = await ClientKeyService.verifyJwt(testClientId, token);
      console.log('✅ JWT verified successfully:');
      console.log('   User ID:', decoded.sub);
      console.log('   Email:', decoded.email);
      console.log('   Client ID:', decoded.iss);
      console.log('');
    } else {
      console.log('⚠️  Skipping JWT tests - private key not available');
      console.log('');
    }

    console.log('7. Getting all client keys...');
    const clientKeys = await ClientKeyService.getClientKeys(testClientId);
    console.log('✅ Client keys retrieved:', clientKeys.length);
    clientKeys.forEach(key => {
      console.log(`   - ${key.key_id} (${key.is_active ? 'active' : 'inactive'}) - ${key.kid}`);
    });

    console.log('\n🎉 Client Key System Test COMPLETED SUCCESSFULLY!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.code === '23505') {
      console.log('💡 Tip: Client already has an active key. Use a different client ID or revoke existing key.');
    }
  } finally {
    await database.close();
  }
}

/**
 * Find a suitable client ID for testing
 */
async function getTestClientId() {
  try {
    // Try to find a client that doesn't have an active key
    const result = await database.query(`
      SELECT c.id 
      FROM clients c 
      LEFT JOIN client_keys ck ON c.id = ck.client_id AND ck.is_active = true
      WHERE ck.id IS NULL 
      ORDER BY c.id 
      LIMIT 1
    `);
    
    if (result.rows.length > 0) {
      return result.rows[0].id;
    }
    
    // If all clients have keys, use the first one
    const firstClient = await database.query('SELECT id FROM clients ORDER BY id LIMIT 1');
    return firstClient.rows[0].id;
    
  } catch (error) {
    // Fallback to client ID 1
    return 1;
  }
}

testClientKeys();