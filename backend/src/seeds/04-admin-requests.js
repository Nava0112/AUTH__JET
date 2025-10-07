const bcrypt = require('bcryptjs');

exports.seed = async function(knex) {
  // Deletes ALL existing entries
  await knex('admin_requests').del();

  // Hash passwords
  const saltRounds = 12;
  const request1Password = await bcrypt.hash('request123', saltRounds);
  const request2Password = await bcrypt.hash('request456', saltRounds);
  const request3Password = await bcrypt.hash('request789', saltRounds);

  // Insert admin requests
  await knex('admin_requests').insert([
    {
      id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      email: 'new.admin@company.com',
      password_hash: request1Password,
      name: 'New Admin User',
      justification: 'Need admin access to manage client applications and user roles across the platform.',
      status: 'pending',
      requested_at: new Date('2024-01-15 10:00:00'),
      reviewed_at: null,
      reviewed_by: null, // ← Added this
      created_at: new Date('2024-01-15 10:00:00'),
      updated_at: new Date('2024-01-15 10:00:00')
    },
    {
      id: 'b2c3d4e5-f6g7-8901-bcde-f23456789012',
      email: 'reviewed.admin@org.com',
      password_hash: request2Password,
      name: 'Reviewed Admin',
      justification: 'Required for system monitoring and audit purposes.',
      status: 'approved',
      requested_at: new Date('2024-01-10 14:30:00'),
      reviewed_at: new Date('2024-01-12 09:15:00'),
      reviewed_by: 1, // ← Super admin reviewed this
      created_at: new Date('2024-01-10 14:30:00'),
      updated_at: new Date('2024-01-12 09:15:00')
    },
    {
      id: 'c3d4e5f6-g7h8-9012-cdef-345678901234',
      email: 'rejected.admin@test.com',
      password_hash: request3Password,
      name: 'Rejected Admin',
      justification: 'Want to test admin features for evaluation.',
      status: 'rejected',
      requested_at: new Date('2024-01-05 16:45:00'),
      reviewed_at: new Date('2024-01-08 11:20:00'),
      reviewed_by: 2, // ← Regular admin reviewed this
      created_at: new Date('2024-01-05 16:45:00'),
      updated_at: new Date('2024-01-08 11:20:00')
    }
  ]);
};