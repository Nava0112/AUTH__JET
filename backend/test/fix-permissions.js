#!/usr/bin/env node

/**
 * Quick fix script to assign admin roles to users who need access to client management
 */

const { assignAdminRoles } = require('../scripts/assign-admin-roles');

console.log('🚀 JWT Guard - Permission Fix Script');
console.log('=====================================');
console.log('This script will assign admin roles to users who need client management access.\n');

assignAdminRoles()
  .then(() => {
    console.log('\n✅ Permission fix completed successfully!');
    console.log('Users should now be able to access the client management features.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Permission fix failed:', error.message);
    process.exit(1);
  });
