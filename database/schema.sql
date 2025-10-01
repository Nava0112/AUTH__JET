-- AuthJet SaaS - Complete Database Schema
-- This schema creates all tables, indexes, and relationships for the JWT Authentication SaaS

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended');
CREATE TYPE plan_type AS ENUM ('free', 'pro', 'enterprise');
CREATE TYPE client_status AS ENUM ('active', 'inactive', 'suspended');

-- Create users table (end-users of client applications)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT,
    email_verified BOOLEAN NOT NULL DEFAULT false,
    status user_status NOT NULL DEFAULT 'active',
    last_login TIMESTAMPTZ,
    login_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create clients table (businesses using our SaaS)
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    contact_email VARCHAR(255) NOT NULL,
    website VARCHAR(255),
    business_type VARCHAR(100),
    api_key VARCHAR(32) NOT NULL UNIQUE,
    secret_key_hash TEXT NOT NULL,
    webhook_url TEXT,
    allowed_domains JSONB NOT NULL DEFAULT '[]',
    default_roles JSONB NOT NULL DEFAULT '["user"]',
    plan_type plan_type NOT NULL DEFAULT 'free',
    status client_status NOT NULL DEFAULT 'active',
    settings JSONB NOT NULL DEFAULT '{}',
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active_at TIMESTAMPTZ
);

-- Create client_users table (many-to-many relationship)
CREATE TABLE client_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    roles JSONB NOT NULL DEFAULT '[]',
    custom_data JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, client_id)
);

-- Create sessions table
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    refresh_token_hash TEXT NOT NULL UNIQUE,
    device_info JSONB NOT NULL DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT false,
    revoked_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create failed_logins table
CREATE TABLE failed_logins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create audit_logs table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    resource_type VARCHAR(50),
    resource_id UUID,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create webhook_logs table
CREATE TABLE webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(100) NOT NULL,
    url TEXT NOT NULL,
    request_payload JSONB NOT NULL,
    request_headers JSONB NOT NULL DEFAULT '{}',
    response_status INTEGER,
    response_body TEXT,
    response_headers JSONB,
    retry_count INTEGER NOT NULL DEFAULT 0,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    duration_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create password_resets table
CREATE TABLE password_resets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN NOT NULL DEFAULT false,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for optimal performance

-- Users indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_users_last_login ON users(last_login);

-- Clients indexes
CREATE INDEX idx_clients_api_key ON clients(api_key);
CREATE INDEX idx_clients_contact_email ON clients(contact_email);
CREATE INDEX idx_clients_plan_type ON clients(plan_type);
CREATE INDEX idx_clients_status ON clients(status);
CREATE INDEX idx_clients_created_at ON clients(created_at);
CREATE INDEX idx_clients_name ON clients(name);
CREATE INDEX idx_clients_business_type ON clients(business_type);
CREATE INDEX idx_clients_last_active ON clients(last_active_at) WHERE status = 'active';

-- Client_users indexes
CREATE INDEX idx_client_users_user_id ON client_users(user_id);
CREATE INDEX idx_client_users_client_id ON client_users(client_id);
CREATE INDEX idx_client_users_is_active ON client_users(is_active);
CREATE INDEX idx_client_users_created_at ON client_users(created_at);
CREATE INDEX idx_client_users_client_active ON client_users(client_id, is_active);

-- Sessions indexes
CREATE INDEX idx_sessions_user_client ON sessions(user_id, client_id);
CREATE INDEX idx_sessions_client_id ON sessions(client_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX idx_sessions_revoked ON sessions(revoked);
CREATE INDEX idx_sessions_last_used_at ON sessions(last_used_at);
CREATE INDEX idx_sessions_created_at ON sessions(created_at);
CREATE INDEX idx_sessions_active_user ON sessions(user_id) WHERE revoked = false AND expires_at > NOW();

-- Failed_logins indexes
CREATE INDEX idx_failed_logins_email_client ON failed_logins(email, client_id);
CREATE INDEX idx_failed_logins_client_id ON failed_logins(client_id);
CREATE INDEX idx_failed_logins_ip_address ON failed_logins(ip_address);
CREATE INDEX idx_failed_logins_created_at ON failed_logins(created_at);

-- Audit_logs indexes
CREATE INDEX idx_audit_logs_user_client ON audit_logs(user_id, client_id);
CREATE INDEX idx_audit_logs_client_id ON audit_logs(client_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX idx_audit_logs_resource_type_id ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_ip_address ON audit_logs(ip_address);
CREATE INDEX idx_audit_logs_client_action_date ON audit_logs(client_id, action, created_at);

-- Webhook_logs indexes
CREATE INDEX idx_webhook_logs_client_id ON webhook_logs(client_id);
CREATE INDEX idx_webhook_logs_client_event ON webhook_logs(client_id, event_type);
CREATE INDEX idx_webhook_logs_created_at ON webhook_logs(created_at);
CREATE INDEX idx_webhook_logs_success ON webhook_logs(success);
CREATE INDEX idx_webhook_logs_client_success_date ON webhook_logs(client_id, success, created_at);
CREATE INDEX idx_webhook_logs_event_type ON webhook_logs(event_type);

-- Password_resets indexes
CREATE INDEX idx_password_resets_token_hash ON password_resets(token_hash);
CREATE INDEX idx_password_resets_email_client ON password_resets(email, client_id);
CREATE INDEX idx_password_resets_expires_at ON password_resets(expires_at);
CREATE INDEX idx_password_resets_used ON password_resets(used);

-- Create functions

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to cleanup expired data
CREATE OR REPLACE FUNCTION cleanup_expired_data()
RETURNS TABLE(deleted_sessions INTEGER, deleted_password_resets INTEGER) AS $$
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
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at columns
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clients_updated_at 
    BEFORE UPDATE ON clients 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_client_users_updated_at 
    BEFORE UPDATE ON client_users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create views for analytics

-- View for client dashboard statistics
CREATE VIEW client_dashboard_stats AS
SELECT 
    c.id as client_id,
    c.name as client_name,
    c.plan_type,
    COUNT(DISTINCT cu.user_id) as total_users,
    COUNT(DISTINCT CASE WHEN s.expires_at > NOW() AND s.revoked = false THEN s.user_id END) as active_users,
    COUNT(DISTINCT al.user_id) as users_with_logins,
    COUNT(*) as total_sessions,
    COUNT(CASE WHEN s.expires_at > NOW() AND s.revoked = false THEN 1 END) as active_sessions,
    COUNT(DISTINCT al.id) as total_logins,
    COUNT(DISTINCT fl.id) as failed_logins,
    COUNT(DISTINCT wl.id) as webhook_calls,
    COUNT(DISTINCT CASE WHEN wl.success = true THEN wl.id END) as successful_webhooks,
    MAX(al.created_at) as last_activity
FROM clients c
LEFT JOIN client_users cu ON c.id = cu.client_id AND cu.is_active = true
LEFT JOIN sessions s ON c.id = s.client_id
LEFT JOIN audit_logs al ON c.id = al.client_id AND al.action = 'login'
LEFT JOIN failed_logins fl ON c.id = fl.client_id AND fl.created_at > NOW() - INTERVAL '24 hours'
LEFT JOIN webhook_logs wl ON c.id = wl.client_id AND wl.created_at > NOW() - INTERVAL '24 hours'
GROUP BY c.id, c.name, c.plan_type;

-- View for user activity summary
CREATE VIEW user_activity_summary AS
SELECT 
    u.id as user_id,
    u.email,
    u.status as user_status,
    u.last_login,
    u.login_count,
    COUNT(DISTINCT cu.client_id) as linked_clients,
    COUNT(DISTINCT s.id) as total_sessions,
    COUNT(DISTINCT CASE WHEN s.expires_at > NOW() AND s.revoked = false THEN s.id END) as active_sessions,
    MAX(s.last_used_at) as last_session_activity
FROM users u
LEFT JOIN client_users cu ON u.id = cu.user_id AND cu.is_active = true
LEFT JOIN sessions s ON u.id = s.user_id
GROUP BY u.id, u.email, u.status, u.last_login, u.login_count;

-- View for webhook performance
CREATE VIEW webhook_performance AS
SELECT 
    client_id,
    event_type,
    COUNT(*) as total_calls,
    COUNT(CASE WHEN success = true THEN 1 END) as successful_calls,
    COUNT(CASE WHEN success = false THEN 1 END) as failed_calls,
    AVG(duration_ms) as avg_duration_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95_duration_ms,
    MAX(duration_ms) as max_duration_ms,
    AVG(retry_count) as avg_retries,
    MAX(retry_count) as max_retries
FROM webhook_logs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY client_id, event_type;

-- Comments for documentation
COMMENT ON TABLE users IS 'End-users of client applications who authenticate through AuthJet';
COMMENT ON TABLE clients IS 'Business clients who use AuthJet for their authentication needs';
COMMENT ON TABLE client_users IS 'Many-to-many relationship between users and clients with role information';
COMMENT ON TABLE sessions IS 'User sessions and refresh token management';
COMMENT ON TABLE failed_logins IS 'Track failed login attempts for security monitoring';
COMMENT ON TABLE audit_logs IS 'Audit trail for all authentication and authorization events';
COMMENT ON TABLE webhook_logs IS 'Log of all webhook calls to client applications';
COMMENT ON TABLE password_resets IS 'Password reset token management';

COMMENT ON COLUMN users.password_hash IS 'BCrypt hashed password, nullable for social auth';
COMMENT ON COLUMN clients.allowed_domains IS 'JSON array of domains allowed to use this client';
COMMENT ON COLUMN clients.default_roles IS 'JSON array of default roles for new users';
COMMENT ON COLUMN sessions.refresh_token_hash IS 'SHA256 hashed refresh token for security';
COMMENT ON COLUMN webhook_logs.request_payload IS 'Original payload sent to webhook';
COMMENT ON COLUMN webhook_logs.response_body IS 'Raw response body from webhook call';