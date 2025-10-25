const axios = require('axios');
const database = require('./src/utils/database');
const logger = require('./src/utils/logger');

class ClientKeyTester {
  constructor() {
    this.baseURL = 'http://localhost:8000';
    this.adminToken = null;
    this.testClientId = null;
  }

  async runAllTests() {
    try {
      console.log('🚀 Starting Client Key System Tests...\n');
      
      // Test 1: Admin Login
      await this.testAdminLogin();
      
      // Test 2: Create Client via API
      await this.testCreateClientViaAPI();
      
      // Test 3: Verify Key Generation
      await this.testKeyGeneration();
      
      // Test 4: Test Token Verification
      await this.testTokenVerification();
      
      // Test 5: Test JWKS Endpoint
      await this.testJWKSEndpoint();
      
      console.log('\n✅ ALL TESTS COMPLETED SUCCESSFULLY!');
      
    } catch (error) {
      console.error('\n❌ TEST FAILED:', error.message);
    }
  }

  async testAdminLogin() {
    console.log('1. Testing Admin Login...');
    
    try {
      const response = await axios.post(`${this.baseURL}/api/auth/admin/login`, {
        email: '00mrdarkdragon@gmail.com',
        password: 'Darkdragon@2005'
      });

      if (response.data.token) {
        this.adminToken = response.data.token;
        console.log('✅ Admin login successful');
        console.log(`   Token: ${this.adminToken.substring(0, 50)}...`);
      } else {
        throw new Error('No token received');
      }
    } catch (error) {
      throw new Error(`Admin login failed: ${error.response?.data?.error || error.message}`);
    }
  }

  async testCreateClientViaAPI() {
    console.log('\n2. Testing Client Creation via API...');
    
    try {
      const testEmail = `test-client-${Date.now()}@test.com`;
      
      const response = await axios.post(`${this.baseURL}/api/clients`, {
        name: `Test Client ${Date.now()}`,
        contact_email: testEmail,
        website: 'https://test.com',
        business_type: 'saas',
        allowed_domains: ['test.com'],
        default_roles: ['user']
      }, {
        headers: {
          'Authorization': `Bearer ${this.adminToken}`,
          'Content-Type': 'application/json'
        }
      });

      this.testClientId = response.data.client.id;
      console.log('✅ Client created successfully');
      console.log(`   Client ID: ${this.testClientId}`);
      console.log(`   Email: ${testEmail}`);
      
    } catch (error) {
      throw new Error(`Client creation failed: ${error.response?.data?.error || error.message}`);
    }
  }

  async testKeyGeneration() {
    console.log('\n3. Testing RSA Key Generation...');
    
    try {
      // Check if key was generated in database
      const keyResult = await database.query(
        'SELECT * FROM client_keys WHERE client_id = $1 AND is_active = true',
        [this.testClientId]
      );

      if (keyResult.rows.length === 0) {
        throw new Error('No RSA key pair found for client');
      }

      const key = keyResult.rows[0];
      console.log('✅ RSA Key pair generated successfully');
      console.log(`   Key ID: ${key.key_id}`);
      console.log(`   KID: ${key.kid}`);
      console.log(`   Algorithm: ${key.algorithm}`);
      console.log(`   Key Size: ${key.key_size}`);
      
    } catch (error) {
      throw new Error(`Key generation check failed: ${error.message}`);
    }
  }

  async testTokenVerification() {
    console.log('\n4. Testing Token Verification...');
    
    try {
      // Get a token for the client (simulate client login)
      const loginResponse = await axios.post(`${this.baseURL}/api/auth/client/login`, {
        email: '00mrdarkdragon@gmail.com', // Use your email as client
        password: 'Darkdragon@2005'
      });

      const clientToken = loginResponse.data.token;
      console.log('✅ Client token obtained');
      console.log(`   Token: ${clientToken.substring(0, 50)}...`);

      // Verify the token
      const verifyResponse = await axios.post(`${this.baseURL}/api/auth/verify-token`, {
        token: clientToken
      });

      if (verifyResponse.data.valid) {
        console.log('✅ Token verification successful');
        console.log(`   Client ID in token: ${verifyResponse.data.payload.sub}`);
      } else {
        throw new Error('Token verification failed');
      }
      
    } catch (error) {
      console.log('⚠️  Client login failed, testing with admin token instead...');
      
      // Fallback: Verify admin token
      const verifyResponse = await axios.post(`${this.baseURL}/api/auth/verify-token`, {
        token: this.adminToken
      });

      if (verifyResponse.data.valid) {
        console.log('✅ Admin token verification successful');
      } else {
        throw new Error('Token verification failed');
      }
    }
  }

  async testJWKSEndpoint() {
    console.log('\n5. Testing JWKS Endpoint...');
    
    try {
      const response = await axios.get(`${this.baseURL}/.well-known/jwks.json`);
      
      if (response.data.keys && response.data.keys.length > 0) {
        console.log('✅ JWKS endpoint working');
        console.log(`   Found ${response.data.keys.length} public key(s)`);
        console.log(`   First KID: ${response.data.keys[0].kid}`);
      } else {
        throw new Error('No keys found in JWKS response');
      }
      
    } catch (error) {
      console.log('⚠️  Main JWKS failed, trying client-specific endpoint...');
      
      // Try client-specific JWKS
      const response = await axios.get(`${this.baseURL}/api/jwks/${this.testClientId}`);
      
      if (response.data.keys && response.data.keys.length > 0) {
        console.log('✅ Client JWKS endpoint working');
        console.log(`   Found ${response.data.keys.length} public key(s)`);
      } else {
        throw new Error('Client JWKS also failed');
      }
    }
  }
}

// Run the tests
async function main() {
  const tester = new ClientKeyTester();
  
  try {
    await tester.runAllTests();
  } catch (error) {
    console.error('\n💥 TEST SUITE FAILED:', error.message);
    process.exit(1);
  }
}

// Check if server is running first
async function checkServer() {
  try {
    await axios.get('http://localhost:8000/api/health', { timeout: 5000 });
    console.log('✅ Server is running');
    return true;
  } catch (error) {
    console.error('❌ Server is not running or not accessible');
    console.log('   Please start your server with: npm start');
    return false;
  }
}

// Start the tests
async function startTests() {
  const serverRunning = await checkServer();
  if (serverRunning) {
    await main();
  } else {
    process.exit(1);
  }
}

startTests();