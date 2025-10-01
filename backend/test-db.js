const { Pool } = require('pg');

const pool = new Pool({
  host: 'aws-1-ap-south-1.pooler.supabase.com',
  port: 6543,
  database: 'postgres',
  user: 'postgres.gkvkuuhuxubhnyrjajwy',
  password: 'Hotspots@050917',
  connectionTimeoutMillis: 10000,
});

async function testConnection() {
  try {
    console.log('Testing Supabase connection...');
    const client = await pool.connect();
    console.log('✅ SUCCESS: Connected to Supabase!');
    
    const result = await client.query('SELECT version();');
    console.log('PostgreSQL Version:', result.rows[0].version);
    
    client.release();
    process.exit(0);
  } catch (error) {
    console.log('❌ FAILED: Could not connect to Supabase');
    console.log('Error details:', error.message);
    console.log('Host:', 'db.jlsdkfajkhaskdfhk.supabase.co');
    process.exit(1);
  }
}

testConnection();