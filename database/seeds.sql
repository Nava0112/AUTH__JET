
-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Insert Admin Requests
INSERT INTO admin_requests (id, email, password_hash, name, justification, status, requested_at, reviewed_at) VALUES
(
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'new.admin@company.com',
    '$2a$12$LQv3c1yqBWVHxkd0g8fK0u7t7JvQW7t7G8bVc6Yf5hT0cA1bC2dE3', -- hashed "request123"
    'New Admin User',
    'Need admin access to manage client applications and user roles across the platform.',
    'pending',
    '2024-01-15 10:00:00',
    NULL
),
(
    'b2c3d4e5-f6g7-8901-bcde-f23456789012',
    'reviewed.admin@org.com',
    '$2a$12$M9v3c1yqBWVHxkd0g8fK0u7t7JvQW7t7G8bVc6Yf5hT0cA1bC2dE3', -- hashed "request456"
    'Reviewed Admin',
    'Required for system monitoring and audit purposes.',
    'approved',
    '2024-01-10 14:30:00',
    '2024-01-12 09:15:00'
),
(
    'c3d4e5f6-g7h8-9012-cdef-345678901234',
    'rejected.admin@test.com',
    '$2a$12$N0w3c1yqBWVHxkd0g8fK0u7t7JvQW7t7G8bVc6Yf5hT0cA1bC2dE3', -- hashed "request789"
    'Rejected Admin',
    'Want to test admin features for evaluation.',
    'rejected',
    '2024-01-05 16:45:00',
    '2024-01-08 11:20:00'
);

-- Insert Admins
INSERT INTO admins (id, email, password_hash, name, role, is_active, last_login) VALUES
(
    1,
    'superadmin@authsystem.com',
    '$2a$12$KQv3c1yqBWVHxkd0g8fK0u7t7JvQW7t7G8bVc6Yf5hT0cA1bC2dE3', -- hashed "superadmin123"
    'Super Administrator',
    'super_admin',
    true,
    '2024-01-20 08:30:00'
),
(
    2,
    'admin@authsystem.com',
    '$2a$12$JQv3c1yqBWVHxkd0g8fK0u7t7JvQW7t7G8bVc6Yf5hT0cA1bC2dE3', -- hashed "admin123"
    'System Administrator',
    'admin',
    true,
    '2024-01-20 09:15:00'
);

-- Insert Clients
INSERT INTO clients (id, name, email, password_hash, organization_name, plan_type, is_active, client_id, client_secret) VALUES
(
    1,
    'Tech Corp Inc',
    'tech@techcorp.com',
    '$2a$12$HQv3c1yqBWVHxkd0g8fK0u7t7JvQW7t7G8bVc6Yf5hT0cA1bC2dE3', -- hashed "client123"
    'Tech Corporation',
    'premium',
    true,
    'tech_corp_001',
    'tech_secret_001'
),
(
    2,
    'Startup XYZ',
    'admin@startupxyz.com',
    '$2a$12$IQv3c1yqBWVHxkd0g8fK0u7t7JvQW7t7G8bVc6Yf5hT0cA1bC2dE3', -- hashed "client456"
    'Startup XYZ LLC',
    'basic',
    true,
    'startup_xyz_002',
    'startup_secret_002'
);

-- Insert Client Applications
INSERT INTO client_applications (id, client_id, name, description, redirect_url, is_active, oauth_application_id, oauth_application_secret, oauth_allowed_scopes, oauth_jwt_claims) VALUES
(
    1,
    1,
    'Tech Corp Web App',
    'Main web application for Tech Corp',
    'https://app.techcorp.com/auth/callback',
    true,
    'authjet_tech_web_001',
    'app_secret_tech_001',
    '["openid", "profile", "email"]'::jsonb,
    '{}'::jsonb
),
(
    2,
    1,
    'Tech Corp Mobile App',
    'Mobile application for Tech Corp',
    'https://mobile.techcorp.com/auth/callback',
    true,
    'authjet_tech_mobile_002',
    'app_secret_tech_002',
    '["openid", "profile", "email"]'::jsonb,
    '{}'::jsonb
),
(
    3,
    2,
    'Startup XYZ Platform',
    'Main platform for Startup XYZ',
    'https://platform.startupxyz.com/callback',
    true,
    'authjet_startup_platform_003',
    'app_secret_startup_003',
    '["openid", "profile", "email"]'::jsonb,
    '{}'::jsonb
);

-- Insert Users
INSERT INTO users (id, client_id, application_id, email, password_hash, name, metadata, is_active, email_verified) VALUES
(
    1,
    1,
    1,
    'john.doe@techcorp.com',
    '$2a$12$AQv3c1yqBWVHxkd0g8fK0u7t7JvQW7t7G8bVc6Yf5hT0cA1bC2dE3', -- hashed "user123"
    'John Doe',
    '{"department": "Engineering", "position": "Lead Developer", "phone": "+1234567890"}'::jsonb,
(
    2,
    1,
    1,
    'jane.smith@techcorp.com',
    '$2a$12$BQv3c1yqBWVHxkd0g8fK0u7t7JvQW7t7G8bVc6Yf5hT0cA1bC2dE3', -- hashed "user456"
    'Jane Smith',
    '{"department": "Marketing", "position": "Content Manager", "phone": "+1234567891"}'::jsonb,
    true,
    true
),
(
    3,
    1,
    1,
    'bob.wilson@techcorp.com',
    '$2a$12$CQv3c1yqBWVHxkd0g8fK0u7t7JvQW7t7G8bVc6Yf5hT0cA1bC2dE3', -- hashed "user789"
    'Bob Wilson',
    '{"department": "Sales", "position": "Sales Representative", "phone": "+1234567892"}'::jsonb,
    true,
    true
),
(
    4,
    1,
    2,
    'alice.brown@techcorp.com',
    '$2a$12$DQv3c1yqBWVHxkd0g8fK0u7t7JvQW7t7G8bVc6Yf5hT0cA1bC2dE3', -- hashed "user012"
    'Alice Brown',
    '{"department": "Product", "position": "Product Manager", "phone": "+1234567893"}'::jsonb,
    true,
    true
),
(
    5,
    2,
    3,
    'charlie.davis@startupxyz.com',
    '$2a$12$EQv3c1yqBWVHxkd0g8fK0u7t7JvQW7t7G8bVc6Yf5hT0cA1bC2dE3', -- hashed "user345"
    'Charlie Davis',
    '{"department": "Community", "position": "Community Manager", "phone": "+1234567894"}'::jsonb,
    true,
    true
),
(
    6,
    2,
    3,
    'eva.garcia@startupxyz.com',
    '$2a$12$FQv3c1yqBWVHxkd0g8fK0u7t7JvQW7t7G8bVc6Yf5hT0cA1bC2dE3', -- hashed "user678"
    'Eva Garcia',
    'contributor',
    'moderator',
    'approved',
    '{"department": "Content", "position": "Content Creator", "phone": "+1234567895"}'::jsonb,
    true,
    true
);

-- Insert Sessions
INSERT INTO sessions (admin_id, client_id, user_id, session_type, refresh_token, expires_at, revoked) VALUES
(
    1,
    NULL,
    NULL,
    'admin',
    'admin_refresh_token_123',
    NOW() + INTERVAL '7 days',
    false
),
(
    NULL,
    1,
    NULL,
    'client',
    'client_refresh_token_456',
    NOW() + INTERVAL '1 day',
    false
),
(
    NULL,
    NULL,
    1,
    'user',
    'user_refresh_token_789',
    NOW() + INTERVAL '30 days',
    false
),
(
    NULL,
    NULL,
    2,
    'user',
    'user_refresh_token_012',
    NOW() - INTERVAL '1 day', -- expired
    false
),
(
    NULL,
    NULL,
    3,
    'user',
    'user_refresh_token_345',
    NOW() + INTERVAL '15 days',
    true
);

-- Insert Audit Logs
INSERT INTO audit_logs (admin_id, client_id, user_id, action, resource_type, resource_id, metadata, ip_address, user_agent, created_at) VALUES
(
    1,
    NULL,
    NULL,
    'login',
    'admin',
    1,
    '{"user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", "location": "New York, US"}'::jsonb,
    '192.168.1.100',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    '2024-01-20 09:00:00'
),
(
    1,
    NULL,
    NULL,
    'create_client',
    'client',
    1,
    '{"client_name": "Tech Corp Inc", "organization": "Tech Corporation"}'::jsonb,
    '192.168.1.100',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    '2024-01-20 09:15:00'
),
(
    NULL,
    1,
    NULL,
    'login',
    'client',
    1,
    '{"user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "location": "San Francisco, US"}'::jsonb,
    '10.0.0.50',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    '2024-01-20 10:30:00'
),
(
    NULL,
    NULL,
    1,
    'register',
    'user',
    1,
    '{"application": "Tech Corp Web App", "role": "admin"}'::jsonb,
    '172.16.1.200',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
    '2024-01-20 11:00:00'
),
(
    2,
    NULL,
    NULL,
    'review_admin_request',
    'admin_request',
    2,
    '{"request_email": "reviewed.admin@org.com", "decision": "approved", "reason": "Valid business need"}'::jsonb,
    '192.168.1.101',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    '2024-01-12 09:15:00'
);

-- Update sequences to avoid conflicts with future inserts
SELECT setval('admins_id_seq', (SELECT MAX(id) FROM admins));
SELECT setval('clients_id_seq', (SELECT MAX(id) FROM clients));
SELECT setval('client_applications_id_seq', (SELECT MAX(id) FROM client_applications));
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));
SELECT setval('sessions_id_seq', (SELECT MAX(id) FROM sessions));
SELECT setval('audit_logs_id_seq', (SELECT MAX(id) FROM audit_logs));