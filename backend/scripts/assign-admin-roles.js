const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'jwt_guard',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

async function assignAdminRoles() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Assigning admin roles to existing users...');
    
    // Get all users who don't have admin or viewer roles
    const usersQuery = `
      SELECT cu.id, cu.user_id, cu.client_id, cu.roles, u.email, c.name as client_name
      FROM client_users cu
      JOIN users u ON cu.user_id = u.id
      JOIN clients c ON cu.client_id = c.id
      WHERE NOT (cu.roles ? 'admin' OR cu.roles ? 'viewer')
    `;
    
    const usersResult = await client.query(usersQuery);
    
    if (usersResult.rows.length === 0) {
      console.log('✅ No users found that need admin roles assigned.');
      return;
    }
    
    console.log(`📋 Found ${usersResult.rows.length} users to update:`);
    
    for (const user of usersResult.rows) {
      console.log(`  - ${user.email} (Client: ${user.client_name})`);
      
      // Add admin role to existing roles
      const currentRoles = user.roles || ['user'];
      const newRoles = [...new Set([...currentRoles, 'admin'])]; // Add admin, remove duplicates
      
      const updateQuery = `
        UPDATE client_users 
        SET roles = $1, updated_at = NOW()
        WHERE id = $2
      `;
      
      await client.query(updateQuery, [JSON.stringify(newRoles), user.id]);
      console.log(`  ✅ Updated ${user.email} roles: ${newRoles.join(', ')}`);
    }
    
    console.log('\n🎉 Successfully assigned admin roles to all users!');
    
  } catch (error) {
    console.error('❌ Error assigning admin roles:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  try {
    await assignAdminRoles();
    process.exit(0);
  } catch (error) {
    console.error('Script failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { assignAdminRoles };
