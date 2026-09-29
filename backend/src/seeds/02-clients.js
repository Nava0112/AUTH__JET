// seeds/02-clients.js
const bcrypt = require('bcryptjs');

exports.seed = async function(knex) {
  // Deletes ALL existing entries
  await knex('users').del();
  await knex('client_applications').del();
  await knex('clients').del();

  // Hash passwords
  const saltRounds = 12;
  const client1Password = await bcrypt.hash('client123', saltRounds);
  const client2Password = await bcrypt.hash('client456', saltRounds);

  // Insert clients
  const clients = await knex('clients').insert([
    {
      id: 1,
      name: 'Tech Corp Inc',
      email: 'tech@techcorp.com',
      password_hash: client1Password,
      organization_name: 'Tech Corporation',
      plan_type: 'premium',
      is_active: true,
      client_id: 'tech_corp_001',
      client_secret: 'tech_secret_001',
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: 2,
      name: 'Startup XYZ',
      email: 'admin@startupxyz.com',
      password_hash: client2Password,
      organization_name: 'Startup XYZ LLC',
      plan_type: 'basic',
      is_active: true,
      client_id: 'startup_xyz_002',
      client_secret: 'startup_secret_002',
      created_at: new Date(),
      updated_at: new Date()
    }
  ]).returning('*');

  // Insert client applications
  await knex('client_applications').insert([
    {
      id: 1,
      client_id: 1,
      name: 'Tech Corp Web App',
      description: 'Main web application for Tech Corp',
      redirect_url: 'https://app.techcorp.com/auth/callback',
      oauth_application_id: 'authjet_tech_web_001',
      oauth_application_secret: 'app_secret_tech_001',
      oauth_allowed_scopes: JSON.stringify(['openid', 'profile', 'email']),
      oauth_jwt_claims: JSON.stringify({}),
      is_active: true,
    },
    {
      id: 2,
      client_id: 1,
      name: 'Tech Corp Mobile App',
      description: 'Mobile application for Tech Corp',
      redirect_url: 'https://mobile.techcorp.com/auth/callback',
      oauth_application_id: 'authjet_tech_mobile_002',
      oauth_application_secret: 'app_secret_tech_002',
      oauth_allowed_scopes: JSON.stringify(['openid', 'profile', 'email']),
      oauth_jwt_claims: JSON.stringify({}),
      is_active: true,
    },
    {
      id: 3,
      client_id: 2,
      name: 'Startup XYZ Platform',
      description: 'Main platform for Startup XYZ',
      redirect_url: 'https://platform.startupxyz.com/callback',
      oauth_application_id: 'authjet_startup_platform_003',
      oauth_application_secret: 'app_secret_startup_003',
      oauth_allowed_scopes: JSON.stringify(['openid', 'profile', 'email']),
      oauth_jwt_claims: JSON.stringify({}),
      is_active: true,
    }
  ]);
};