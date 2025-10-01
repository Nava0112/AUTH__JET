exports.up = (pgm) => {
  // Client-Users relationship table (many-to-many)
  pgm.createTable('client_users', {
    id: {
      type: 'UUID',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    user_id: {
      type: 'UUID',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
    client_id: {
      type: 'UUID',
      notNull: true,
      references: 'clients(id)',
      onDelete: 'CASCADE',
    },
    roles: {
      type: 'JSONB',
      notNull: true,
      default: '[]',
    },
    custom_data: {
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

  // Sessions table
  pgm.createTable('sessions', {
    id: {
      type: 'UUID',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    user_id: {
      type: 'UUID',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
    client_id: {
      type: 'UUID',
      notNull: true,
      references: 'clients(id)',
      onDelete: 'CASCADE',
    },
    refresh_token_hash: {
      type: 'TEXT',
      notNull: true,
    },
    device_info: {
      type: 'JSONB',
      notNull: true,
      default: '{}',
    },
    ip_address: {
      type: 'INET',
      notNull: false,
    },
    user_agent: {
      type: 'TEXT',
      notNull: false,
    },
    expires_at: {
      type: 'TIMESTAMPTZ',
      notNull: true,
    },
    revoked: {
      type: 'BOOLEAN',
      notNull: true,
      default: false,
    },
    revoked_at: {
      type: 'TIMESTAMPTZ',
      notNull: false,
    },
    last_used_at: {
      type: 'TIMESTAMPTZ',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    created_at: {
      type: 'TIMESTAMPTZ',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  // Failed login attempts table
  pgm.createTable('failed_logins', {
    id: {
      type: 'UUID',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    email: {
      type: 'VARCHAR(255)',
      notNull: true,
    },
    client_id: {
      type: 'UUID',
      notNull: true,
      references: 'clients(id)',
      onDelete: 'CASCADE',
    },
    ip_address: {
      type: 'INET',
      notNull: false,
    },
    created_at: {
      type: 'TIMESTAMPTZ',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  // Audit logs table
  pgm.createTable('audit_logs', {
    id: {
      type: 'UUID',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    user_id: {
      type: 'UUID',
      notNull: false,
      references: 'users(id)',
      onDelete: 'SET NULL',
    },
    client_id: {
      type: 'UUID',
      notNull: false,
      references: 'clients(id)',
      onDelete: 'SET NULL',
    },
    action: {
      type: 'VARCHAR(100)',
      notNull: true,
    },
    ip_address: {
      type: 'INET',
      notNull: false,
    },
    user_agent: {
      type: 'TEXT',
      notNull: false,
    },
    metadata: {
      type: 'JSONB',
      notNull: true,
      default: '{}',
    },
    created_at: {
      type: 'TIMESTAMPTZ',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  // Indexes
  pgm.createIndex('client_users', ['user_id', 'client_id'], { unique: true });
  pgm.createIndex('client_users', 'client_id');
  pgm.createIndex('sessions', 'refresh_token_hash', { unique: true });
  pgm.createIndex('sessions', ['user_id', 'client_id']);
  pgm.createIndex('sessions', 'expires_at');
  pgm.createIndex('sessions', 'revoked');
  pgm.createIndex('failed_logins', ['email', 'client_id']);
  pgm.createIndex('failed_logins', 'created_at');
  pgm.createIndex('audit_logs', ['user_id', 'client_id']);
  pgm.createIndex('audit_logs', 'action');
  pgm.createIndex('audit_logs', 'created_at');
};

exports.down = (pgm) => {
  pgm.dropTable('audit_logs');
  pgm.dropTable('failed_logins');
  pgm.dropTable('sessions');
  pgm.dropTable('client_users');
};