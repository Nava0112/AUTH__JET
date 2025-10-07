// seeds/03-users.js
const bcrypt = require('bcryptjs');

exports.seed = async function(knex) {
  // Deletes ALL existing entries
  await knex('users').del();

  // Hash passwords
  const saltRounds = 12;
  const userPasswords = await Promise.all([
    bcrypt.hash('user123', saltRounds),
    bcrypt.hash('user456', saltRounds),
    bcrypt.hash('user789', saltRounds),
    bcrypt.hash('user012', saltRounds),
    bcrypt.hash('user345', saltRounds)
  ]);

  // Insert users
  await knex('users').insert([
    {
      id: 1,
      client_id: 1,
      application_id: 1,
      email: 'john.doe@techcorp.com',
      password_hash: userPasswords[0],
      name: 'John Doe',
      role: 'admin',
      metadata: JSON.stringify({
        department: 'Engineering',
        position: 'Lead Developer',
        phone: '+1234567890'
      }),
      is_active: true,
      email_verified: true,
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: 2,
      client_id: 1,
      application_id: 1,
      email: 'jane.smith@techcorp.com',
      password_hash: userPasswords[1],
      name: 'Jane Smith',
      role: 'editor',
      metadata: JSON.stringify({
        department: 'Marketing',
        position: 'Content Manager',
        phone: '+1234567891'
      }),
      is_active: true,
      email_verified: true,
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: 3,
      client_id: 1,
      application_id: 1,
      email: 'bob.wilson@techcorp.com',
      password_hash: userPasswords[2],
      name: 'Bob Wilson',
      role: 'user',
      requested_role: 'editor',
      role_request_status: 'pending',
      metadata: JSON.stringify({
        department: 'Sales',
        position: 'Sales Representative',
        phone: '+1234567892'
      }),
      is_active: true,
      email_verified: true,
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: 4,
      client_id: 1,
      application_id: 2,
      email: 'alice.brown@techcorp.com',
      password_hash: userPasswords[3],
      name: 'Alice Brown',
      role: 'premium',
      metadata: JSON.stringify({
        department: 'Product',
        position: 'Product Manager',
        phone: '+1234567893'
      }),
      is_active: true,
      email_verified: true,
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: 5,
      client_id: 2,
      application_id: 3,
      email: 'charlie.davis@startupxyz.com',
      password_hash: userPasswords[4],
      name: 'Charlie Davis',
      role: 'moderator',
      metadata: JSON.stringify({
        department: 'Community',
        position: 'Community Manager',
        phone: '+1234567894'
      }),
      is_active: true,
      email_verified: true,
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: 6,
      client_id: 2,
      application_id: 3,
      email: 'eva.garcia@startupxyz.com',
      password_hash: userPasswords[4],
      name: 'Eva Garcia',
      role: 'contributor',
      requested_role: 'moderator',
      role_request_status: 'approved',
      metadata: JSON.stringify({
        department: 'Content',
        position: 'Content Creator',
        phone: '+1234567895'
      }),
      is_active: true,
      email_verified: true,
      created_at: new Date(),
      updated_at: new Date()
    }
  ]);
};