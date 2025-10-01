require('dotenv').config();
const { Pool } = require('pg');

console.log('\n=== Database Connection Test ===\n');

// Show what we're trying to connect to (hide password)
console.log('Connection details:');
if (process.env.DATABASE_URL) {
  const url = process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@');
  console.log(`DATABASE_URL: ${url}`);
} else {
  console.log(`Host: ${process.env.DB_HOST || 'localhost'}`);
  console.log(`Port: ${process.env.DB_PORT || '5432'}`);
  console.log(`Database: ${process.env.DB_NAME || 'authjet'}`);
  console.log(`User: ${process.env.DB_USER || 'postgres'}`);
  console.log(`Password: ${process.env.DB_PASSWORD ? '****' : 'NOT SET'}`);
}

console.log('\nAttempting connection...\n');

const config = process.env.DATABASE_URL ? {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('supabase') ? {
    rejectUnauthorized: false
  } : undefined
} : {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'authjet',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  ssl: process.env.DB_HOST?.includes('supabase') ? {
    rejectUnauthorized: false
  } : undefined
};

const pool = new Pool(config);

pool.connect()
  .then(client => {
    console.log('✅ Connection successful!\n');
    return client.query('SELECT version(), current_database(), current_user');
  })
  .then(result => {
    console.log('Database Info:');
    console.log(`Version: ${result.rows[0].version}`);
    console.log(`Database: ${result.rows[0].current_database}`);
    console.log(`User: ${result.rows[0].current_user}`);
    console.log('\n✅ Database is ready to use!\n');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Connection failed!\n');
    console.error('Error:', err.message);
    console.error('\nCommon fixes:');
    console.error('1. Check your Supabase credentials in .env file');
    console.error('2. Ensure DATABASE_URL or DB_* variables are set correctly');
    console.error('3. Verify your Supabase project is active');
    console.error('4. Check if you need to whitelist your IP in Supabase settings');
    console.error('\nFull error:');
    console.error(err);
    process.exit(1);
  });
