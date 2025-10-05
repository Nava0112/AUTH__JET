#!/usr/bin/env node

/**
 * Complete setup script for AuthJet Multi-Tenant Migration
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

console.log('🚀 AuthJet Multi-Tenant Setup');
console.log('==============================');

async function runSetup() {
  try {
    console.log('📋 Step 1: Running database migration...');
    
    // Run the migration
    const migrationCommand = `cd backend && node run-migration.js`;
    execSync(migrationCommand, { stdio: 'inherit' });
    
    console.log('\n✅ Database migration completed!');
    
    console.log('\n📋 Step 2: Installing any missing dependencies...');
    
    // Install backend dependencies
    try {
      execSync('cd backend && npm install node-pg-migrate', { stdio: 'inherit' });
    } catch (error) {
      console.log('Dependencies already installed or error occurred:', error.message);
    }
    
    console.log('\n📋 Step 3: Creating initial admin user...');
    console.log('You can create your first admin user by making a POST request to:');
    console.log('POST http://localhost:8000/api/admin/register');
    console.log('Body: { "email": "admin@yourcompany.com", "password": "your-password", "name": "Your Name" }');
    
    console.log('\n📋 Step 4: Updating environment variables...');
    
    // Check if .env file exists and has required variables
    const envPath = path.join(__dirname, 'backend', '.env');
    if (fs.existsSync(envPath)) {
      console.log('✅ .env file found');
    } else {
      console.log('⚠️  .env file not found. Please create one with the required database settings.');
    }
    
    console.log('\n🎉 Setup completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Start your backend server: cd backend && npm start');
    console.log('2. Start your frontend server: cd frontend && npm start');
    console.log('3. Visit http://localhost:3000 to see the new landing page');
    console.log('4. Create your first admin user at http://localhost:8000/api/admin/register');
    console.log('5. Access admin panel at http://localhost:3000/admin/login');
    console.log('6. Clients can register at http://localhost:3000/client/register');
    
    console.log('\n🔐 Important Security Notes:');
    console.log('- Keep the /admin/login route secret in production');
    console.log('- Only allow admin registration during initial setup');
    console.log('- Use strong passwords for admin accounts');
    console.log('- Configure proper CORS settings for production');
    
    console.log('\n📚 Documentation:');
    console.log('- Read MULTI_TENANT_SETUP.md for detailed instructions');
    console.log('- Check the API endpoints in the setup guide');
    console.log('- Review the new database schema');
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Ensure your database is running and accessible');
    console.log('2. Check your database connection settings in .env');
    console.log('3. Verify you have the required permissions');
    console.log('4. Run the migration manually: cd backend && node run-migration.js');
    process.exit(1);
  }
}

if (require.main === module) {
  runSetup();
}

module.exports = { runSetup };
