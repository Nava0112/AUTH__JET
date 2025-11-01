const { Pool } = require('pg');
const logger = require('../src/utils/logger');

async function testSupabaseConnection() {
  console.log('\n=== Supabase Database Connection Test ===\n');

  // Load environment variables
  require('dotenv').config();

  // Configuration options
  const configs = [
    {
      name: 'Using DATABASE_URL',
      config: process.env.DATABASE_URL ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 15000,
        query_timeout: 10000,
        statement_timeout: 10000
      } : null
    },
    {
      name: 'Using Individual DB Variables',
      config: (process.env.DB_HOST && process.env.DB_USER && process.env.DB_PASSWORD) ? {
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT) || 5432,
        database: process.env.DB_NAME || 'postgres',
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 15000,
        query_timeout: 10000,
        statement_timeout: 10000
      } : null
    }
  ];

  let success = false;

  for (const { name, config } of configs) {
    if (!config) {
      console.log(`⏩ Skipping ${name} - configuration not found`);
      continue;
    }

    console.log(`🔧 Testing: ${name}`);
    console.log('Connection details:');
    
    if (config.connectionString) {
      const maskedUrl = config.connectionString.replace(/:([^:@]+)@/, ':****@');
      console.log(`   URL: ${maskedUrl}`);
    } else {
      console.log(`   Host: ${config.host}`);
      console.log(`   Port: ${config.port}`);
      console.log(`   Database: ${config.database}`);
      console.log(`   User: ${config.user}`);
    }

    const pool = new Pool(config);

    try {
      console.log('\n🔄 Attempting connection...');
      
      const client = await pool.connect();
      
      // Test basic connection
      const basicResult = await client.query('SELECT NOW() as current_time');
      console.log('✅ Basic connection test passed');
      console.log(`   Server time: ${basicResult.rows[0].current_time}`);

      // Test Supabase-specific queries
      const versionResult = await client.query('SELECT version()');
      console.log('✅ Database version check passed');
      console.log(`   PostgreSQL: ${versionResult.rows[0].version.split(',')[0]}`);

      // Check current user and database
      const infoResult = await client.query(`
        SELECT 
          current_database() as database,
          current_user as user,
          inet_server_addr() as server_ip,
          inet_server_port() as server_port
      `);
      
      console.log('✅ Connection details:');
      console.log(`   Database: ${infoResult.rows[0].database}`);
      console.log(`   User: ${infoResult.rows[0].user}`);
      console.log(`   Server: ${infoResult.rows[0].server_ip}:${infoResult.rows[0].server_port}`);

      // Test SSL connection
      const sslResult = await client.query('SELECT ssl_is_used() as ssl_used');
      console.log(`✅ SSL: ${sslResult.rows[0].ssl_used ? 'Enabled' : 'Disabled'}`);

      client.release();
      
      console.log(`\n🎉 SUCCESS: ${name} - All tests passed!`);
      success = true;
      break;

    } catch (error) {
      console.log(`❌ FAILED: ${name}`);
      console.log(`   Error: ${error.message}`);
      
      // Provide specific troubleshooting tips
      provideTroubleshootingTips(error, config);
      
      await pool.end();
    }
  }

  if (!success) {
    console.log('\n🔍 Troubleshooting Steps:');
    console.log('1. Check your Supabase project is active at https://supabase.com/dashboard');
    console.log('2. Verify your credentials in Settings > Database');
    console.log('3. Ensure your IP is whitelisted in Supabase (Settings > Database > Allowed IPs)');
    console.log('4. Use the Connection Pooling URI (port 6543) not direct connection (port 5432)');
    console.log('5. Check network connectivity: ping aws-1-ap-south-1.pooler.supabase.com');
  }

  console.log('\n=== Test Complete ===\n');
}

function provideTroubleshootingTips(error, config) {
  const errorMsg = error.message.toLowerCase();
  
  if (errorMsg.includes('timeout') || errorMsg.includes('timed out')) {
    console.log('   💡 Tip: Connection timeout - check your network/firewall');
    console.log('   💡 Tip: Try increasing connectionTimeoutMillis to 30000');
  } else if (errorMsg.includes('ssl') || errorMsg.includes('tls')) {
    console.log('   💡 Tip: SSL connection required - ensure ssl: { rejectUnauthorized: false }');
  } else if (errorMsg.includes('password') || errorMsg.includes('authentication')) {
    console.log('   💡 Tip: Check your password in Supabase dashboard > Settings > Database');
    if (config.user && config.user.includes('postgres.')) {
      console.log('   💡 Tip: Make sure to use the correct username format: postgres.[project_ref]');
    }
  } else if (errorMsg.includes('does not exist') || errorMsg.includes('database')) {
    console.log('   💡 Tip: Database name should be "postgres" for Supabase');
  } else if (errorMsg.includes('connection refused') || errorMsg.includes('econnrefused')) {
    console.log('   💡 Tip: Check port number - use 6543 for connection pooling');
    console.log('   💡 Tip: Verify host: aws-1-ap-south-1.pooler.supabase.com');
  } else if (errorMsg.includes('getaddrinfo') || errorMsg.includes('enotfound')) {
    console.log('   💡 Tip: DNS resolution failed - check internet connection');
    console.log('   💡 Tip: Try pinging the host to verify connectivity');
  }
}

// Network connectivity test
async function testNetworkConnectivity() {
  console.log('\n🌐 Testing network connectivity...');
  
  const { exec } = require('child_process');
  const util = require('util');
  const execPromise = util.promisify(exec);
  
  try {
    // Test ping to Supabase
    const { stdout } = await execPromise('ping -n 1 aws-1-ap-south-1.pooler.supabase.com');
    console.log('✅ Network connectivity: OK');
  } catch (error) {
    console.log('❌ Network connectivity: Failed - check your internet connection');
  }
}

// Run the tests
async function runAllTests() {
  await testNetworkConnectivity();
  await testSupabaseConnection();
}

runAllTests().catch(console.error);