'use strict';

exports.up = async (pgm) => {
  // Ensure required extensions
  await pgm.sql(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
  // Create users table if it doesn't exist
  const usersTableExists = await pgm.db.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'users'
    )
  `);
  
  if (!usersTableExists.rows[0].exists) {
    await pgm.sql(`
      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT,
        name VARCHAR(255),
        email_verified BOOLEAN DEFAULT false NOT NULL,
        last_login TIMESTAMPTZ,
        login_count INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);
    console.log('Created users table');
  }

  // Add OAuth columns to users table if they don't exist
  const checkProviderColumn = await pgm.db.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_name='users' AND column_name='provider'
    )
  `);
  
  if (!checkProviderColumn.rows[0].exists) {
    await pgm.sql(`ALTER TABLE users ADD COLUMN provider VARCHAR(50) DEFAULT 'local'`);
    console.log('Added provider column to users table');
  }

  const checkProviderIdColumn = await pgm.db.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_name='users' AND column_name='provider_id'
    )
  `);
  
  if (!checkProviderIdColumn.rows[0].exists) {
    await pgm.sql(`ALTER TABLE users ADD COLUMN provider_id VARCHAR(255)`);
    console.log('Added provider_id column to users table');
  }

  const checkAvatarColumn = await pgm.db.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_name='users' AND column_name='avatar'
    )
  `);
  
  if (!checkAvatarColumn.rows[0].exists) {
    await pgm.sql(`ALTER TABLE users ADD COLUMN avatar TEXT`);
    console.log('Added avatar column to users table');
  }

  // Create other tables if they don't exist
  const clientsTableExists = await pgm.db.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'clients'
    )
  `);
  
  if (!clientsTableExists.rows[0].exists) {
    await pgm.sql(`
      CREATE TABLE clients (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        contact_email VARCHAR(255),
        website TEXT,
        business_type VARCHAR(100),
        api_key VARCHAR(255) UNIQUE NOT NULL,
        secret_key_hash TEXT NOT NULL,
        allowed_domains JSONB,
        allowed_redirect_uris JSONB,
        default_roles JSONB DEFAULT '["user"]',
        plan_type VARCHAR(50) DEFAULT 'free',
        webhook_url TEXT,
        settings JSONB,
        is_active BOOLEAN DEFAULT true NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);
    console.log('Created clients table');
  }

  // Create client_users table if it doesn't exist
  const clientUsersTableExists = await pgm.db.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'client_users'
    )
  `);
  
  if (!clientUsersTableExists.rows[0].exists) {
    await pgm.sql(`
      CREATE TABLE client_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        roles JSONB DEFAULT '["user"]',
        custom_data JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        UNIQUE(user_id, client_id)
      )
    `);
    console.log('Created client_users table');
  }

  // Create sessions table if it doesn't exist
  const sessionsTableExists = await pgm.db.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'sessions'
    )
  `);
  
  if (!sessionsTableExists.rows[0].exists) {
    await pgm.sql(`
      CREATE TABLE sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
        refresh_token_hash TEXT NOT NULL UNIQUE,
        device_info JSONB,
        ip_address VARCHAR(45),
        user_agent TEXT,
        expires_at TIMESTAMPTZ NOT NULL,
        revoked BOOLEAN DEFAULT false NOT NULL,
        revoked_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);
    console.log('Created sessions table');
  }

  // Create indexes if they don't exist
  await pgm.sql(`
    CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);
    CREATE INDEX IF NOT EXISTS users_provider_provider_id_idx ON users (provider, provider_id);
    CREATE INDEX IF NOT EXISTS users_created_at_idx ON users (created_at);
    
    CREATE INDEX IF NOT EXISTS clients_api_key_idx ON clients (api_key);
    CREATE INDEX IF NOT EXISTS clients_is_active_idx ON clients (is_active);
    CREATE INDEX IF NOT EXISTS clients_created_at_idx ON clients (created_at);
    
    CREATE INDEX IF NOT EXISTS client_users_user_id_idx ON client_users (user_id);
    CREATE INDEX IF NOT EXISTS client_users_client_id_idx ON client_users (client_id);
    CREATE INDEX IF NOT EXISTS client_users_user_client_idx ON client_users (user_id, client_id);
    
    CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id);
    CREATE INDEX IF NOT EXISTS sessions_client_id_idx ON sessions (client_id);
    CREATE INDEX IF NOT EXISTS sessions_refresh_token_hash_idx ON sessions (refresh_token_hash);
    CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions (expires_at);
    CREATE INDEX IF NOT EXISTS sessions_revoked_idx ON sessions (revoked);
  `);

  // Ensure supporting tables used by auth flow exist
  const failedLoginsTableExists = await pgm.db.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'failed_logins'
    )
  `);

  if (!failedLoginsTableExists.rows[0].exists) {
    await pgm.sql(`
      CREATE TABLE failed_logins (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL,
        client_id UUID NOT NULL,
        ip_address VARCHAR(45),
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);
  }

  const auditLogsTableExists = await pgm.db.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'audit_logs'
    )
  `);
  
  if (!auditLogsTableExists.rows[0].exists) {
    await pgm.sql(`
      CREATE TABLE audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID,
        client_id UUID,
        action VARCHAR(50) NOT NULL,
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);
  }

  const passwordResetsTableExists = await pgm.db.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'password_resets'
    )
  `);

  if (!passwordResetsTableExists.rows[0].exists) {
    await pgm.sql(`
      CREATE TABLE password_resets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL,
        client_id UUID NOT NULL,
        token_hash TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        used BOOLEAN DEFAULT false NOT NULL,
        used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);
  }

  const webhookLogsTableExists = await pgm.db.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'webhook_logs'
    )
  `);
  
  if (!webhookLogsTableExists.rows[0].exists) {
    await pgm.sql(`
      CREATE TABLE webhook_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id UUID NOT NULL,
        event VARCHAR(100),
        url TEXT,
        payload JSONB,
        response_status INTEGER,
        response_body TEXT,
        success BOOLEAN,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      )
    `);
  }

  // Insert default client if it doesn't exist
  const defaultClientExists = await pgm.db.query(`
    SELECT EXISTS (
      SELECT 1 FROM clients WHERE id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
    )
  `);
  
  if (!defaultClientExists.rows[0].exists) {
    await pgm.sql(`
      INSERT INTO clients (
        id, name, contact_email, website, business_type, api_key, secret_key_hash, allowed_domains, 
        allowed_redirect_uris, default_roles, plan_type, created_at, updated_at
      ) VALUES (
        'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        'AuthJet Development Client',
        'dev@authjet.local',
        'http://localhost:3000',
        'development',
        'cli_dev_' || substr(md5(random()::text), 1, 24),
        substr(md5(random()::text), 1, 32),
        '["localhost", "127.0.0.1"]',
        '["http://localhost:3000/oauth/callback"]',
        '["user"]',
        'free',
        NOW(),
        NOW()
      )
    `);
    console.log('Inserted default client');
  }
};

exports.down = async (pgm) => {
  // We'll only drop indexes in the down migration to avoid data loss
  await pgm.sql(`
    DROP INDEX IF EXISTS users_email_idx;
    DROP INDEX IF EXISTS users_provider_provider_id_idx;
    DROP INDEX IF EXISTS users_created_at_idx;
    
    DROP INDEX IF EXISTS clients_api_key_idx;
    DROP INDEX IF EXISTS clients_is_active_idx;
    DROP INDEX IF EXISTS clients_created_at_idx;
    
    DROP INDEX IF EXISTS client_users_user_id_idx;
    DROP INDEX IF EXISTS client_users_client_id_idx;
    DROP INDEX IF EXISTS client_users_user_client_idx;
    
    DROP INDEX IF EXISTS sessions_user_id_idx;
    DROP INDEX IF EXISTS sessions_client_id_idx;
    DROP INDEX IF EXISTS sessions_refresh_token_hash_idx;
    DROP INDEX IF EXISTS sessions_expires_at_idx;
    DROP INDEX IF EXISTS sessions_revoked_idx;
  `);
};