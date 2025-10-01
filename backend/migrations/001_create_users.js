exports.up = (pgm) => {
  // Create enum types
  pgm.createType('user_status', ['active', 'inactive', 'suspended']);
  pgm.createType('plan_type', ['free', 'pro', 'enterprise']);

  // Users table (end-users of client applications)
  pgm.createTable('users', {
    id: {
      type: 'UUID',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    email: {
      type: 'VARCHAR(255)',
      notNull: true,
      unique: true,
    },
    password_hash: {
      type: 'TEXT',
      notNull: false, // Nullable for social auth
    },
    email_verified: {
      type: 'BOOLEAN',
      notNull: true,
      default: false,
    },
    status: {
      type: 'user_status',
      notNull: true,
      default: 'active',
    },
    last_login: {
      type: 'TIMESTAMPTZ',
      notNull: false,
    },
    login_count: {
      type: 'INTEGER',
      notNull: true,
      default: 0,
    },
    created_at: {
      type: 'TIMESTAMPTZ',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    updated_at: {
      type: 'TIMESTAMPTZ',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  // Clients table (businesses using our SaaS)
  pgm.createTable('clients', {
    id: {
      type: 'UUID',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    name: {
      type: 'VARCHAR(255)',
      notNull: true,
    },
    contact_email: {
      type: 'VARCHAR(255)',
      notNull: true,
    },
    website: {
      type: 'VARCHAR(255)',
      notNull: false,
    },
    business_type: {
      type: 'VARCHAR(100)',
      notNull: false,
    },
    api_key: {
      type: 'VARCHAR(32)',
      notNull: true,
      unique: true,
    },
    secret_key_hash: {
      type: 'TEXT',
      notNull: true,
    },
    webhook_url: {
      type: 'TEXT',
      notNull: false,
    },
    allowed_domains: {
      type: 'JSONB',
      notNull: true,
      default: '[]',
    },
    default_roles: {
      type: 'JSONB',
      notNull: true,
      default: '["user"]',
    },
    plan_type: {
      type: 'plan_type',
      notNull: true,
      default: 'free',
    },
    settings: {
      type: 'JSONB',
      notNull: true,
      default: '{}',
    },
    created_at: {
      type: 'TIMESTAMPTZ',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    updated_at: {
      type: 'TIMESTAMPTZ',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  // Indexes for users table
  pgm.createIndex('users', 'email', { unique: true });
  pgm.createIndex('users', 'status');
  pgm.createIndex('users', 'created_at');

  // Indexes for clients table
  pgm.createIndex('clients', 'api_key', { unique: true });
  pgm.createIndex('clients', 'contact_email');
  pgm.createIndex('clients', 'plan_type');
};

exports.down = (pgm) => {
  pgm.dropTable('clients');
  pgm.dropTable('users');
  pgm.dropType('plan_type');
  pgm.dropType('user_status');
};