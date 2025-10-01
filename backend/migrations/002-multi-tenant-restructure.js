/**
 * Multi-Tenant SaaS Restructure Migration
 * Creates separate tables for admins, clients, and users with proper relationships
 */

exports.up = async (pgm) => {
  console.log('🚀 Starting multi-tenant restructure migration...');

  // 1. Create admins table (SaaS platform administrators)
  await pgm.sql(`
    CREATE TABLE IF NOT EXISTS admins (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT 'admin' NOT NULL,
      is_active BOOLEAN DEFAULT true NOT NULL,
      last_login TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    )
  `);

  // 2. Rename current clients table to preserve data and restructure
  const clientsTableExists = await pgm.db.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'clients'
    )
  `);

  if (clientsTableExists.rows[0].exists) {
    await pgm.sql(`ALTER TABLE clients RENAME TO clients_backup`);
  }

  // 3. Create new clients table (Organizations using the SaaS)
  await pgm.sql(`
    CREATE TABLE clients (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      company_name VARCHAR(255),
      website VARCHAR(255),
      phone VARCHAR(50),
      
      -- Subscription and billing
      plan_type VARCHAR(50) DEFAULT 'free' NOT NULL,
      subscription_status VARCHAR(50) DEFAULT 'active' NOT NULL,
      billing_email VARCHAR(255),
      
      -- Application settings
      allowed_domains JSONB DEFAULT '[]',
      webhook_url VARCHAR(500),
      custom_branding JSONB DEFAULT '{}',
      
      -- API credentials
      api_key VARCHAR(100) UNIQUE NOT NULL,
      secret_key_hash TEXT NOT NULL,
      
      -- Status and metadata
      is_active BOOLEAN DEFAULT true NOT NULL,
      email_verified BOOLEAN DEFAULT false NOT NULL,
      email_verified_at TIMESTAMPTZ,
      last_login TIMESTAMPTZ,
      
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    )
  `);

  // 4. Create client_applications table (Each client can have multiple applications)
  await pgm.sql(`
    CREATE TABLE client_applications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      
      -- Application type and settings
      auth_type VARCHAR(50) DEFAULT 'basic' NOT NULL, -- 'basic' or 'advanced'
      allowed_domains JSONB DEFAULT '[]',
      redirect_urls JSONB DEFAULT '[]',
      
      -- API credentials for this specific application
      client_id_key VARCHAR(100) UNIQUE NOT NULL, -- Public client ID
      client_secret_hash TEXT NOT NULL, -- Secret for server-to-server auth
      
      -- Application-specific settings
      settings JSONB DEFAULT '{}',
      default_user_role VARCHAR(50) DEFAULT 'user',
      available_roles JSONB DEFAULT '["user", "admin"]', -- For basic auth
      custom_roles JSONB DEFAULT '[]', -- For advanced auth
      
      -- Status
      is_active BOOLEAN DEFAULT true NOT NULL,
      
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      
      UNIQUE(client_id, name)
    )
  `);

  // 5. Backup current users table and create new structure
  const usersTableExists = await pgm.db.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'users'
    )
  `);

  if (usersTableExists.rows[0].exists) {
    await pgm.sql(`ALTER TABLE users RENAME TO users_backup`);
  }

  // 6. Create new users table (End-users of client applications)
  await pgm.sql(`
    CREATE TABLE users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      application_id UUID NOT NULL REFERENCES client_applications(id) ON DELETE CASCADE,
      
      -- User credentials and info
      email VARCHAR(255) NOT NULL,
      password_hash TEXT NOT NULL,
      name VARCHAR(255),
      
      -- User metadata
      roles JSONB DEFAULT '["user"]',
      custom_data JSONB DEFAULT '{}',
      
      -- Status and verification
      is_active BOOLEAN DEFAULT true NOT NULL,
      email_verified BOOLEAN DEFAULT false NOT NULL,
      email_verified_at TIMESTAMPTZ,
      last_login TIMESTAMPTZ,
      login_count INTEGER DEFAULT 0,
      
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      
      -- Unique email per application (users can have same email across different applications)
      UNIQUE(application_id, email)
    )
  `);

  // 7. Update sessions table to work with new structure
  const sessionsTableExists = await pgm.db.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'sessions'
    )
  `);

  if (sessionsTableExists.rows[0].exists) {
    await pgm.sql(`ALTER TABLE sessions RENAME TO sessions_backup`);
  }

  await pgm.sql(`
    CREATE TABLE sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
      admin_id UUID REFERENCES admins(id) ON DELETE CASCADE,
      application_id UUID REFERENCES client_applications(id) ON DELETE CASCADE,
      
      -- Session data
      session_type VARCHAR(20) NOT NULL, -- 'admin', 'client', 'user'
      token_hash TEXT NOT NULL,
      refresh_token_hash TEXT,
      
      -- Session metadata
      ip_address VARCHAR(45),
      user_agent TEXT,
      
      -- Expiration
      expires_at TIMESTAMPTZ NOT NULL,
      refresh_expires_at TIMESTAMPTZ,
      
      -- Status
      revoked BOOLEAN DEFAULT false NOT NULL,
      revoked_at TIMESTAMPTZ,
      
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
      
      -- Ensure only one type of user_id is set
      CONSTRAINT check_single_user_type CHECK (
        (user_id IS NOT NULL)::int + 
        (client_id IS NOT NULL)::int + 
        (admin_id IS NOT NULL)::int = 1
      )
    )
  `);

  // 8. Create audit_logs table for the new structure
  await pgm.sql(`
    DROP TABLE IF EXISTS audit_logs;
    CREATE TABLE audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
      admin_id UUID REFERENCES admins(id) ON DELETE SET NULL,
      application_id UUID REFERENCES client_applications(id) ON DELETE SET NULL,
      
      -- Action details
      action VARCHAR(100) NOT NULL,
      resource_type VARCHAR(50),
      resource_id UUID,
      
      -- Request metadata
      ip_address VARCHAR(45),
      user_agent TEXT,
      
      -- Additional data
      metadata JSONB DEFAULT '{}',
      
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    )
  `);

  // 9. Create password_resets table for new structure
  await pgm.sql(`
    DROP TABLE IF EXISTS password_resets;
    CREATE TABLE password_resets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) NOT NULL,
      user_type VARCHAR(20) NOT NULL, -- 'admin', 'client', 'user'
      client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
      application_id UUID REFERENCES client_applications(id) ON DELETE CASCADE,
      
      token_hash TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used BOOLEAN DEFAULT false NOT NULL,
      used_at TIMESTAMPTZ,
      
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    )
  `);

  // 10. Create webhook_logs table for new structure
  await pgm.sql(`
    DROP TABLE IF EXISTS webhook_logs;
    CREATE TABLE webhook_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      application_id UUID REFERENCES client_applications(id) ON DELETE CASCADE,
      
      -- Webhook details
      event_type VARCHAR(100) NOT NULL,
      webhook_url VARCHAR(500) NOT NULL,
      
      -- Request/Response data
      payload JSONB NOT NULL,
      response_status INTEGER,
      response_body TEXT,
      
      -- Metadata
      success BOOLEAN DEFAULT false NOT NULL,
      retry_count INTEGER DEFAULT 0,
      
      created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
    )
  `);

  // 11. Create indexes for performance
  await pgm.sql(`
    -- Admin indexes
    CREATE INDEX IF NOT EXISTS admins_email_idx ON admins (email);
    CREATE INDEX IF NOT EXISTS admins_is_active_idx ON admins (is_active);
    
    -- Client indexes
    CREATE INDEX IF NOT EXISTS clients_email_idx ON clients (email);
    CREATE INDEX IF NOT EXISTS clients_api_key_idx ON clients (api_key);
    CREATE INDEX IF NOT EXISTS clients_is_active_idx ON clients (is_active);
    CREATE INDEX IF NOT EXISTS clients_plan_type_idx ON clients (plan_type);
    
    -- Application indexes
    CREATE INDEX IF NOT EXISTS client_applications_client_id_idx ON client_applications (client_id);
    CREATE INDEX IF NOT EXISTS client_applications_client_id_key_idx ON client_applications (client_id_key);
    CREATE INDEX IF NOT EXISTS client_applications_is_active_idx ON client_applications (is_active);
    
    -- User indexes
    CREATE INDEX IF NOT EXISTS users_client_id_idx ON users (client_id);
    CREATE INDEX IF NOT EXISTS users_application_id_idx ON users (application_id);
    CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);
    CREATE INDEX IF NOT EXISTS users_application_email_idx ON users (application_id, email);
    CREATE INDEX IF NOT EXISTS users_is_active_idx ON users (is_active);
    
    -- Session indexes
    CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id);
    CREATE INDEX IF NOT EXISTS sessions_client_id_idx ON sessions (client_id);
    CREATE INDEX IF NOT EXISTS sessions_admin_id_idx ON sessions (admin_id);
    CREATE INDEX IF NOT EXISTS sessions_application_id_idx ON sessions (application_id);
    CREATE INDEX IF NOT EXISTS sessions_session_type_idx ON sessions (session_type);
    CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions (expires_at);
    CREATE INDEX IF NOT EXISTS sessions_revoked_idx ON sessions (revoked);
    
    -- Audit log indexes
    CREATE INDEX IF NOT EXISTS audit_logs_user_id_idx ON audit_logs (user_id);
    CREATE INDEX IF NOT EXISTS audit_logs_client_id_idx ON audit_logs (client_id);
    CREATE INDEX IF NOT EXISTS audit_logs_admin_id_idx ON audit_logs (admin_id);
    CREATE INDEX IF NOT EXISTS audit_logs_application_id_idx ON audit_logs (application_id);
    CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON audit_logs (action);
    CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs (created_at);
  `);

  console.log('✅ Multi-tenant restructure migration completed successfully!');
};

exports.down = async (pgm) => {
  console.log('🔄 Rolling back multi-tenant restructure...');
  
  // Drop new tables
  await pgm.sql(`
    DROP TABLE IF EXISTS webhook_logs;
    DROP TABLE IF EXISTS password_resets;
    DROP TABLE IF EXISTS audit_logs;
    DROP TABLE IF EXISTS sessions;
    DROP TABLE IF EXISTS users;
    DROP TABLE IF EXISTS client_applications;
    DROP TABLE IF EXISTS clients;
    DROP TABLE IF EXISTS admins;
  `);
  
  // Restore backup tables if they exist
  const clientsBackupExists = await pgm.db.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'clients_backup'
    )
  `);
  
  if (clientsBackupExists.rows[0].exists) {
    await pgm.sql(`ALTER TABLE clients_backup RENAME TO clients`);
  }
  
  const usersBackupExists = await pgm.db.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'users_backup'
    )
  `);
  
  if (usersBackupExists.rows[0].exists) {
    await pgm.sql(`ALTER TABLE users_backup RENAME TO users`);
  }
  
  const sessionsBackupExists = await pgm.db.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'sessions_backup'
    )
  `);
  
  if (sessionsBackupExists.rows[0].exists) {
    await pgm.sql(`ALTER TABLE sessions_backup RENAME TO sessions`);
  }
  
  console.log('✅ Rollback completed');
};
