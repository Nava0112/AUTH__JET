// seeds/01-admins.js
const bcrypt = require('bcryptjs');

exports.seed = async function(knex) {
  // Deletes ALL existing entries
  await knex('audit_logs').del();
  await knex('sessions').del();
  await knex('admin_requests').del();
  await knex('admins').del();
  
  // Hash passwords
  const saltRounds = 12;
  const superAdminPassword = await bcrypt.hash('superadmin123', saltRounds);
  const adminPassword = await bcrypt.hash('admin123', saltRounds);

  // Inserts seed entries
  await knex('admins').insert([
    {
      id: 1,
      email: 'superadmin@authsystem.com',
      password_hash: superAdminPassword,
      name: 'Super Administrator',
      role: 'super_admin',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: 2,
      email: 'admin@authsystem.com',
      password_hash: adminPassword,
      name: 'System Administrator',
      role: 'admin',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    }
  ]);
};