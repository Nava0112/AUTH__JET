exports.up = (pgm) => {
  // Create enum types first
  pgm.createType('plan_type', ['free', 'pro', 'enterprise']);
  pgm.createType('client_status', ['active', 'inactive', 'suspended']);

  // Create clients table
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
    status: {
      type: 'client_status',
      notNull: true,
      default: 'active',
    },
    settings: {
      type: 'JSONB',
      notNull: true,
      default: '{}',
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
    updated_at: {
      type: 'TIMESTAMPTZ',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    last_active_at: {
      type: 'TIMESTAMPTZ',
      notNull: false,
    },
  });

  // Create indexes for better performance
  pgm.createIndex('clients', 'api_key', { unique: true });
  pgm.createIndex('clients', 'contact_email');
  pgm.createIndex('clients', 'plan_type');
  pgm.createIndex('clients', 'status');
  pgm.createIndex('clients', 'created_at');
  pgm.createIndex('clients', 'name');
  pgm.createIndex('clients', 'business_type');

  // Create partial index for active clients
  pgm.createIndex('clients', 'last_active_at', {
    where: 'status = \'active\'',
  });

  // Create client_users table for many-to-many relationship
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
    is_active: {
      type: 'BOOLEAN',
      notNull: true,
      default: true,
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

  // Create unique constraint to prevent duplicate user-client relationships
  pgm.addConstraint('client_users', 'client_users_user_client_unique', {
    unique: ['user_id', 'client_id'],
  });

  // Create indexes for client_users table
  pgm.createIndex('client_users', 'user_id');
  pgm.createIndex('client_users', 'client_id');
  pgm.createIndex('client_users', 'is_active');
  pgm.createIndex('client_users', 'created_at');
  pgm.createIndex('client_users', ['client_id', 'is_active']);

  // Create sessions table
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

  // Create indexes for sessions table
  pgm.createIndex('sessions', 'refresh_token_hash', { unique: true });
  pgm.createIndex('sessions', ['user_id', 'client_id']);
  pgm.createIndex('sessions', 'client_id');
  pgm.createIndex('sessions', 'expires_at');
  pgm.createIndex('sessions', 'revoked');
  pgm.createIndex('sessions', 'last_used_at');
  pgm.createIndex('sessions', 'created_at');

  // Create partial index for active sessions
  pgm.createIndex('sessions', 'user_id', {
    where: 'revoked = false AND expires_at > NOW()',
  });

  // Create failed_logins table
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
    user_agent: {
      type: 'TEXT',
      notNull: false,
    },
    created_at: {
      type: 'TIMESTAMPTZ',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  // Create indexes for failed_logins table
  pgm.createIndex('failed_logins', ['email', 'client_id']);
  pgm.createIndex('failed_logins', 'client_id');
  pgm.createIndex('failed_logins', 'ip_address');
  pgm.createIndex('failed_logins', 'created_at');

  // Create audit_logs table
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
    resource_type: {
      type: 'VARCHAR(50)',
      notNull: false,
    },
    resource_id: {
      type: 'UUID',
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

  // Create indexes for audit_logs table
  pgm.createIndex('audit_logs', ['user_id', 'client_id']);
  pgm.createIndex('audit_logs', 'client_id');
  pgm.createIndex('audit_logs', 'action');
  pgm.createIndex('audit_logs', 'created_at');
  pgm.createIndex('audit_logs', 'resource_type');
  pgm.createIndex('audit_logs', ['resource_type', 'resource_id']);
  pgm.createIndex('audit_logs', 'ip_address');

  // Create composite index for common query patterns
  pgm.createIndex('audit_logs', ['client_id', 'action', 'created_at']);

  // Create password_resets table
  pgm.createTable('password_resets', {
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
    token_hash: {
      type: 'TEXT',
      notNull: true,
    },
    expires_at: {
      type: 'TIMESTAMPTZ',
      notNull: true,
    },
    used: {
      type: 'BOOLEAN',
      notNull: true,
      default: false,
    },
    used_at: {
      type: 'TIMESTAMPTZ',
      notNull: false,
    },
    created_at: {
      type: 'TIMESTAMPTZ',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  // Create indexes for password_resets table
  pgm.createIndex('password_resets', 'token_hash', { unique: true });
  pgm.createIndex('password_resets', ['email', 'client_id']);
  pgm.createIndex('password_resets', 'expires_at');
  pgm.createIndex('password_resets', 'used');

  // Create function to update updated_at timestamp
  pgm.createFunction(
    'update_updated_at_column',
    [],
    {
      returns: 'TRIGGER',
      language: 'plpgsql',
    },
    `
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    `
  );

  // Create triggers for updated_at columns
  const tablesWithUpdatedAt = ['clients', 'client_users'];
  
  tablesWithUpdatedAt.forEach(table => {
    pgm.createTrigger(table, 'update_updated_at_trigger', {
      when: 'BEFORE',
      operation: 'UPDATE',
      function: 'update_updated_at_column',
      level: 'ROW',
    });
  });

  // Create function to clean up expired data
  pgm.createFunction(
    'cleanup_expired_data',
    [],
    {
      returns: 'TABLE(deleted_sessions INTEGER, deleted_password_resets INTEGER)',
      language: 'plpgsql',
    },
    `
    DECLARE
      session_count INTEGER;
      reset_count INTEGER;
    BEGIN
      -- Delete expired sessions
      DELETE FROM sessions 
      WHERE expires_at < NOW() OR (revoked = true AND revoked_at < NOW() - INTERVAL '7 days');
      GET DIAGNOSTICS session_count = ROW_COUNT;

      -- Delete expired password reset tokens
      DELETE FROM password_resets 
      WHERE expires_at < NOW() OR (used = true AND used_at < NOW() - INTERVAL '1 day');
      GET DIAGNOSTICS reset_count = ROW_COUNT;

      RETURN QUERY SELECT session_count, reset_count;
    END;
    `
  );

  // Insert initial seed data for development
  if (process.env.NODE_ENV === 'development') {
    pgm.sql(`
      -- Insert a sample client for development
      INSERT INTO clients (
        name, contact_email, website, business_type, 
        api_key, secret_key_hash, allowed_domains, default_roles,
        plan_type, settings
      ) VALUES (
        'Development Client',
        'dev@example.com',
        'https://example.com',
        'saas',
        'cli_dev_123456789012',
        -- Hash of 'dev_secret_123456789012345678901234567890'
        '$2a$12$K9VrK9vL9VrK9vL9VrK9vO9VrK9vL9VrK9vL9VrK9vL9VrK9vL9VrK',
        '["localhost", "127.0.0.1", "*.example.com"]',
        '["user", "admin"]',
        'pro',
        '{"webhook_secret": "dev_webhook_secret", "max_users": 1000}'
      );
    `);
  }
};

exports.down = (pgm) => {
  // Drop triggers first
  const tablesWithUpdatedAt = ['clients', 'client_users'];
  
  tablesWithUpdatedAt.forEach(table => {
    pgm.dropTrigger(table, 'update_updated_at_trigger');
  });

  // Drop functions
  pgm.dropFunction('cleanup_expired_data', []);
  pgm.dropFunction('update_updated_at_column', []);

  // Drop tables in reverse order (to handle foreign key constraints)
  pgm.dropTable('password_resets');
  pgm.dropTable('audit_logs');
  pgm.dropTable('failed_logins');
  pgm.dropTable('sessions');
  pgm.dropTable('client_users');
  pgm.dropTable('clients');

  // Drop enum types
  pgm.dropType('client_status');
  pgm.dropType('plan_type');
};