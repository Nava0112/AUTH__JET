-- AuthJet Unified Database Schema
-- Single source of truth - consolidates all conflicting schema definitions
-- Generated: 2025-12-24

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- CORE IDENTITY TABLES
-- ============================================================================

-- Admin Requests Table
CREATE TABLE IF NOT EXISTS admin_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    justification TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    requested_at TIMESTAMP DEFAULT NOW(),
    reviewed_at TIMESTAMP,
    reviewed_by INTEGER REFERENCES admins(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Admins Table
CREATE TABLE IF NOT EXISTS admins (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255),
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'admin',
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    google_id VARCHAR(255),
    github_id VARCHAR(255)
);

-- Clients Table (DUAL ID PATTERN - This is the fix!)
CREATE TABLE IF NOT EXISTS clients (
    id SERIAL PRIMARY KEY,                          -- Database internal ID (integer)
    client_id VARCHAR(255) UNIQUE NOT NULL,         -- Custom API identifier (string)
    client_secret VARCHAR(255) NOT NULL,            -- For client API authentication
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    organization_name VARCHAR(255) NOT NULL,
    plan_type VARCHAR(50) DEFAULT 'basic',
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Client Applications Table
CREATE TABLE IF NOT EXISTS client_applications (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,  -- FK to clients.id (integer)
    application_secret VARCHAR(255) NOT NULL,       -- NEW: Per-application authentication
    name VARCHAR(255) NOT NULL,
    description TEXT,
    auth_mode VARCHAR(50) DEFAULT 'basic',
    main_page_url VARCHAR(500) NOT NULL,
    redirect_url VARCHAR(500) NOT NULL,
    allowed_origins TEXT[],
    webhook_url VARCHAR(500),
    role_request_webhook VARCHAR(500),
    default_role VARCHAR(50) DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    roles_config JSONB DEFAULT '[]'::jsonb
);

-- NEW: Application Keys Table (replaces client_keys)
-- Keys are now per APPLICATION, not per client
CREATE TABLE IF NOT EXISTS application_keys (
    id SERIAL PRIMARY KEY,
    application_id INTEGER NOT NULL REFERENCES client_applications(id) ON DELETE CASCADE,
    key_id VARCHAR(50) UNIQUE NOT NULL,
    public_key TEXT NOT NULL,
    private_key_encrypted TEXT NOT NULL,
    algorithm VARCHAR(20) DEFAULT 'RS256',
    kid VARCHAR(100) UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    revoked_at TIMESTAMP
);

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    application_id INTEGER NOT NULL REFERENCES client_applications(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user',
    requested_role VARCHAR(50),
    role_request_status VARCHAR(50) DEFAULT 'none',
    metadata JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    last_login TIMESTAMP,
    jwt_refresh_token VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- FIXED: Polymorphic Sessions Table
-- No more nullable foreign keys!
CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    session_type VARCHAR(50) NOT NULL,              -- 'admin', 'client', or 'user'
    entity_id INTEGER NOT NULL,                     -- ID of the admin/client/user
    refresh_token VARCHAR(500) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    revoked BOOLEAN DEFAULT false,
    revoked_at TIMESTAMP,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    admin_id INTEGER REFERENCES admins(id) ON DELETE SET NULL,
    client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(255) NOT NULL,
    resource_type VARCHAR(100),
    resource_id INTEGER,
    metadata JSONB DEFAULT '{}'::jsonb,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Admin Requests Indexes
CREATE INDEX IF NOT EXISTS idx_admin_requests_status ON admin_requests(status);
CREATE INDEX IF NOT EXISTS idx_admin_requests_email ON admin_requests(email);
CREATE INDEX IF NOT EXISTS idx_admin_requests_requested_at ON admin_requests(requested_at);

-- Admins Indexes
CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);
CREATE INDEX IF NOT EXISTS idx_admins_is_active ON admins(is_active);
CREATE INDEX IF NOT EXISTS idx_admins_google_id ON admins(google_id);
CREATE INDEX IF NOT EXISTS idx_admins_github_id ON admins(github_id);

-- Clients Indexes
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);
CREATE INDEX IF NOT EXISTS idx_clients_is_active ON clients(is_active);
CREATE INDEX IF NOT EXISTS idx_clients_client_id ON clients(client_id);

-- Client Applications Indexes
CREATE INDEX IF NOT EXISTS idx_client_applications_client_id ON client_applications(client_id);
CREATE INDEX IF NOT EXISTS idx_client_applications_is_active ON client_applications(is_active);

-- Application Keys Indexes (NEW)
CREATE INDEX IF NOT EXISTS idx_application_keys_app_id ON application_keys(application_id);
CREATE INDEX IF NOT EXISTS idx_application_keys_kid ON application_keys(kid);
CREATE INDEX IF NOT EXISTS idx_application_keys_is_active ON application_keys(is_active);

-- Users Indexes
CREATE INDEX IF NOT EXISTS idx_users_client_id ON users(client_id);
CREATE INDEX IF NOT EXISTS idx_users_application_id ON users(application_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_role_request_status ON users(role_request_status);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_client_application_email ON users(client_id, application_id, email);

-- Sessions Indexes (UPDATED for polymorphic design)
CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token ON sessions(refresh_token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_entity_lookup ON sessions(entity_id, session_type, revoked);
CREATE INDEX IF NOT EXISTS idx_sessions_revoked ON sessions(revoked);

-- Audit Logs Indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id ON audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_client_id ON audit_logs(client_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Updated At Trigger Function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
CREATE TRIGGER update_admin_requests_updated_at 
    BEFORE UPDATE ON admin_requests 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_admins_updated_at 
    BEFORE UPDATE ON admins 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clients_updated_at 
    BEFORE UPDATE ON clients 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_client_applications_updated_at 
    BEFORE UPDATE ON client_applications 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Active Sessions View
CREATE OR REPLACE VIEW active_sessions AS
SELECT 
    s.*,
    s.session_type as user_type
FROM sessions s
WHERE s.revoked = false 
AND s.expires_at > NOW();

-- User Statistics View
CREATE OR REPLACE VIEW user_statistics AS
SELECT 
    c.id as client_id,
    c.name as client_name,
    ca.id as application_id,
    ca.name as application_name,
    COUNT(u.id) as total_users,
    COUNT(CASE WHEN u.is_active THEN 1 END) as active_users,
    COUNT(CASE WHEN u.email_verified THEN 1 END) as verified_users,
    COUNT(CASE WHEN u.role_request_status = 'pending' THEN 1 END) as pending_role_requests
FROM clients c
LEFT JOIN client_applications ca ON c.id = ca.client_id
LEFT JOIN users u ON ca.id = u.application_id
GROUP BY c.id, c.name, ca.id, ca.name;

-- ============================================================================
-- COMMENTS (Documentation)
-- ============================================================================

COMMENT ON TABLE admin_requests IS 'Stores requests from users wanting to become admins';
COMMENT ON TABLE admins IS 'Stores system administrators with different roles';
COMMENT ON TABLE clients IS 'Stores client organizations using the auth service (dual ID: id + client_id)';
COMMENT ON TABLE client_applications IS 'Stores applications registered by clients';
COMMENT ON TABLE application_keys IS 'Stores RSA key pairs per application (not per client)';
COMMENT ON TABLE users IS 'Stores end users of client applications';
COMMENT ON TABLE sessions IS 'Polymorphic session storage for admin/client/user';
COMMENT ON TABLE audit_logs IS 'Stores audit trail for all significant actions';

COMMENT ON COLUMN clients.id IS 'Database internal ID (SERIAL)';
COMMENT ON COLUMN clients.client_id IS 'Custom API identifier (string like cli_xxx)';
COMMENT ON COLUMN client_applications.application_secret IS 'Secret for application API authentication';
COMMENT ON COLUMN sessions.session_type IS 'Type of entity: admin, client, or user';
COMMENT ON COLUMN sessions.entity_id IS 'Foreign key to admin/client/user ID based on session_type';
