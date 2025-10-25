require('dotenv').config();
const database = require('../src/utils/database');
const { Pool } = require('pg');

async function createClientKeysTable() {
  console.log('🚀 Creating client_keys table...\n');
  
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const client = await pool.connect();
    
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS client_keys (
        id SERIAL PRIMARY KEY,
        client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        key_id VARCHAR(50) UNIQUE NOT NULL,
        public_key TEXT NOT NULL,
        private_key_encrypted TEXT NOT NULL,
        algorithm VARCHAR(20) DEFAULT 'RS256',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        revoked_at TIMESTAMP WITH TIME ZONE,
        key_usage VARCHAR(20) DEFAULT 'signing',
        key_type VARCHAR(20) DEFAULT 'RSA',
        key_size INTEGER DEFAULT 2048,
        kid VARCHAR(100) UNIQUE
      );

      CREATE INDEX IF NOT EXISTS idx_client_keys_client_id ON client_keys(client_id);
      CREATE INDEX IF NOT EXISTS idx_client_keys_key_id ON client_keys(key_id);
      CREATE INDEX IF NOT EXISTS idx_client_keys_kid ON client_keys(kid);
    `;

    await client.query(createTableSQL);
    console.log('✅ client_keys table created successfully!');
    
    // Verify the table was created
    const checkTable = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'client_keys'
    `);
    
    if (checkTable.rows.length > 0) {
      console.log('✅ Table verification: client_keys exists');
    } else {
      console.log('❌ Table verification failed');
    }
    
    client.release();
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await pool.end();
  }
}

createClientKeysTable();