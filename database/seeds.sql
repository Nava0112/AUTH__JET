-- AuthJet SaaS - Seed Data
-- This file populates the database with initial data for development and testing

-- Insert sample clients
INSERT INTO clients (
    id, name, contact_email, website, business_type, 
    api_key, secret_key_hash, allowed_domains, default_roles,
    plan_type, settings, created_at
) VALUES 
(
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::UUID,
    'AuthJet Development',
    'dev@authjet.com',
    'https://dev.authjet.com',
    'saas',
    'cli_dev_123456789012',
    -- Hash for 'dev_secret_123456789012345678901234567890'
    '$2a$12$K9VrK9vL9VrK9vL9VrK9vO9VrK9vL9VrK9vL9VrK9vL9VrK9vL9VrK',
    '["localhost", "127.0.0.1", "*.authjet.com", "*.example.com"]'::JSONB,
    '["user", "admin"]'::JSONB,
    'pro',
    '{
        "webhook_secret": "dev_webhook_secret_123456",
        "max_users": 10000,
        "session_timeout": 3600,
        "require_email_verification": false,
        "password_policy": {
            "min_length": 8,
            "require_uppercase": true,
            "require_lowercase": true,
            "require_numbers": true,
            "require_special": true
        }
    }'::JSONB,
    NOW() - INTERVAL '30 days'
),
(
    'b1ffc99-9c0b-4ef8-bb6d-6bb9bd380a12'::UUID,
    'Example E-Commerce',
    'tech@example-store.com',
    'https://example-store.com',
    'ecommerce',
    'cli_eco_987654321098',
    -- Hash for 'eco_secret_987654321098765432109876543210'
    '$2a$12$L8WwW8L8WwW8L8WwW8L8W.O8WwW8L8WwW8L8WwW8L8WwW8L8WwW8L8W',
    '["example-store.com", "api.example-store.com", "admin.example-store.com"]'::JSONB,
    '["customer", "vendor", "admin"]'::JSONB,
    'pro',
    '{
        "webhook_url": "https://api.example-store.com/auth/webhook",
        "webhook_secret": "eco_webhook_secret_654321",
        "max_users": 50000,
        "session_timeout": 7200,
        "branding": {
            "logo": "https://example-store.com/logo.png",
            "primary_color": "#4F46E5"
        }
    }'::JSONB,
    NOW() - INTERVAL '15 days'
),
(
    'c2eecc99-9c0b-4ef8-bb6d-6bb9bd380a13'::UUID,
    'Startup Free Tier',
    'founder@startup.io',
    'https://startup.io',
    'technology',
    'cli_sta_555555555555',
    -- Hash for 'sta_secret_555555555555555555555555555555'
    '$2a$12$M5N5M5N5M5N5M5N5M5N5M.Q5N5M5N5M5N5M5N5M5N5M5N5M5N5M5N5',
    '["startup.io", "app.startup.io"]'::JSONB,
    '["user", "premium_user"]'::JSONB,
    'free',
    '{
        "max_users": 1000,
        "session_timeout": 1800,
        "features": {
            "social_login": true,
            "multi_factor": false,
            "custom_roles": false
        }
    }'::JSONB,
    NOW() - INTERVAL '7 days'
);

-- Insert sample users (passwords are 'Password123!' for all demo users)
INSERT INTO users (
    id, email, password_hash, email_verified, status, created_at
) VALUES 
(
    'd3ffc99-9c0b-4ef8-bb6d-6bb9bd380a14'::UUID,
    'admin@authjet.com',
    -- Hash for 'Password123!'
    '$2a$12$8B2JaB2J8B2J.B2J8B2J8uB2J8B2J8B2J8B2J8B2J8B2J8B2J8B2J8B',
    true,
    'active',
    NOW() - INTERVAL '25 days'
),
(
    'e4ffc99-9c0b-4ef8-bb6d-6bb9bd380a15'::UUID,
    'john.customer@example.com',
    -- Hash for 'Password123!'
    '$2a$12$8B2JaB2J8B2J.B2J8B2J8uB2J8B2J8B2J8B2J8B2J8B2J8B2J8B2J8B',
    true,
    'active',
    NOW() - INTERVAL '20 days'
),
(
    'f5ffc99-9c0b-4ef8-bb6d-6bb9bd380a16'::UUID,
    'sarah.vendor@example.com',
    -- Hash for 'Password123!'
    '$2a$12$8B2JaB2J8B2J.B2J8B2J8uB2J8B2J8B2J8B2J8B2J8B2J8B2J8B2J8B',
    true,
    'active',
    NOW() - INTERVAL '18 days'
),
(
    'g6ffc99-9c0b-4ef8-bb6d-6bb9bd380a17'::UUID,
    'mike@startup.io',
    -- Hash for 'Password123!'
    '$2a$12$8B2JaB2J8B2J.B2J8B2J8uB2J8B2J8B2J8B2J8B2J8B2J8B2J8B2J8B',
    false,
    'active',
    NOW() - INTERVAL '5 days'
),
(
    'h7ffc99-9c0b-4ef8-bb6d-6bb9bd380a18'::UUID,
    'demo@authjet.com',
    -- Hash for 'Password123!'
    '$2a$12$8B2JaB2J8B2J.B2J8B2J8uB2J8B2J8B2J8B2J8B2J8B2J8B2J8B2J8B',
    true,
    'active',
    NOW() - INTERVAL '2 days'
);

-- Link users to clients with roles
INSERT INTO client_users (
    user_id, client_id, roles, custom_data, created_at
) VALUES 
-- AuthJet Development client users
(
    'd3ffc99-9c0b-4ef8-bb6d-6bb9bd380a14'::UUID,
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::UUID,
    '["admin", "user"]'::JSONB,
    '{"department": "engineering", "permissions": ["all"]}'::JSONB,
    NOW() - INTERVAL '25 days'
),
(
    'h7ffc99-9c0b-4ef8-bb6d-6bb9bd380a18'::UUID,
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::UUID,
    '["user"]'::JSONB,
    '{"department": "demo", "tier": "basic"}'::JSONB,
    NOW() - INTERVAL '2 days'
),
-- Example E-Commerce client users
(
    'e4ffc99-9c0b-4ef8-bb6d-6bb9bd380a15'::UUID,
    'b1ffc99-9c0b-4ef8-bb6d-6bb9bd380a12'::UUID,
    '["customer"]'::JSONB,
    '{
        "shipping_address": {
            "street": "123 Main St",
            "city": "New York",
            "state": "NY",
            "zipcode": "10001"
        },
        "loyalty_points": 1500
    }'::JSONB,
    NOW() - INTERVAL '20 days'
),
(
    'f5ffc99-9c0b-4ef8-bb6d-6bb9bd380a16'::UUID,
    'b1ffc99-9c0b-4ef8-bb6d-6bb9bd380a12'::UUID,
    '["vendor", "admin"]'::JSONB,
    '{
        "store_name": "Sarah''s Crafts",
        "vendor_since": "2023-01-15",
        "rating": 4.8
    }'::JSONB,
    NOW() - INTERVAL '18 days'
),
-- Startup Free Tier client users
(
    'g6ffc99-9c0b-4ef8-bb6d-6bb9bd380a17'::UUID,
    'c2eecc99-9c0b-4ef8-bb6d-6bb9bd380a13'::UUID,
    '["premium_user"]'::JSONB,
    '{
        "subscription_tier": "premium",
        "trial_ends": "2024-03-01",
        "features": ["unlimited_projects", "advanced_analytics"]
    }'::JSONB,
    NOW() - INTERVAL '5 days'
);

-- Insert sample sessions
INSERT INTO sessions (
    user_id, client_id, refresh_token_hash, device_info, ip_address, user_agent, expires_at, created_at
) VALUES 
(
    'd3ffc99-9c0b-4ef8-bb6d-6bb9bd380a14'::UUID,
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::UUID,
    -- Hash of 'refresh_token_admin_123'
    'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
    '{
        "device_type": "desktop",
        "browser": "Chrome",
        "browser_version": "119.0",
        "os": "Windows 11",
        "screen_resolution": "1920x1080"
    }'::JSONB,
    '192.168.1.100'::INET,
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    NOW() + INTERVAL '7 days',
    NOW() - INTERVAL '2 hours'
),
(
    'e4ffc99-9c0b-4ef8-bb6d-6bb9bd380a15'::UUID,
    'b1ffc99-9c0b-4ef8-bb6d-6bb9bd380a12'::UUID,
    -- Hash of 'refresh_token_john_456'
    'b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3',
    '{
        "device_type": "mobile",
        "browser": "Safari",
        "browser_version": "17.0",
        "os": "iOS 17.1",
        "screen_resolution": "390x844"
    }'::JSONB,
    '10.0.0.50'::INET,
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15',
    NOW() + INTERVAL '7 days',
    NOW() - INTERVAL '1 hour'
),
(
    'h7ffc99-9c0b-4ef8-bb6d-6bb9bd380a18'::UUID,
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::UUID,
    -- Hash of 'refresh_token_demo_789'
    'c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
    '{
        "device_type": "tablet",
        "browser": "Firefox",
        "browser_version": "120.0",
        "os": "Android 13",
        "screen_resolution": "1200x1920"
    }'::JSONB,
    '172.16.1.200'::INET,
    'Mozilla/5.0 (Android 13; Tablet; rv:120.0) Gecko/120.0 Firefox/120.0',
    NOW() + INTERVAL '7 days',
    NOW() - INTERVAL '30 minutes'
);

-- Insert sample audit logs
INSERT INTO audit_logs (
    user_id, client_id, action, ip_address, user_agent, resource_type, resource_id, metadata, created_at
) VALUES 
-- Login events
(
    'd3ffc99-9c0b-4ef8-bb6d-6bb9bd380a14'::UUID,
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::UUID,
    'login',
    '192.168.1.100'::INET,
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'user',
    'd3ffc99-9c0b-4ef8-bb6d-6bb9bd380a14'::UUID,
    '{"method": "password", "success": true}'::JSONB,
    NOW() - INTERVAL '2 hours'
),
(
    'e4ffc99-9c0b-4ef8-bb6d-6bb9bd380a15'::UUID,
    'b1ffc99-9c0b-4ef8-bb6d-6bb9bd380a12'::UUID,
    'login',
    '10.0.0.50'::INET,
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15',
    'user',
    'e4ffc99-9c0b-4ef8-bb6d-6bb9bd380a15'::UUID,
    '{"method": "password", "success": true}'::JSONB,
    NOW() - INTERVAL '1 hour'
),
-- Registration events
(
    'g6ffc99-9c0b-4ef8-bb6d-6bb9bd380a17'::UUID,
    'c2eecc99-9c0b-4ef8-bb6d-6bb9bd380a13'::UUID,
    'register',
    '203.0.113.10'::INET,
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'user',
    'g6ffc99-9c0b-4ef8-bb6d-6bb9bd380a17'::UUID,
    '{"source": "web", "newsletter_optin": true}'::JSONB,
    NOW() - INTERVAL '5 days'
),
-- Profile update events
(
    'f5ffc99-9c0b-4ef8-bb6d-6bb9bd380a16'::UUID,
    'b1ffc99-9c0b-4ef8-bb6d-6bb9bd380a12'::UUID,
    'profile_update',
    '198.51.100.25'::INET,
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
    'user',
    'f5ffc99-9c0b-4ef8-bb6d-6bb9bd380a16'::UUID,
    '{"fields_updated": ["store_name", "vendor_info"]}'::JSONB,
    NOW() - INTERVAL '3 days'
);

-- Insert sample failed login attempts
INSERT INTO failed_logins (
    email, client_id, ip_address, user_agent, created_at
) VALUES 
(
    'hacker@example.com',
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'::UUID,
    '203.0.113.99'::INET,
    'Mozilla/5.0 (compatible; BadBot/1.0)',
    NOW() - INTERVAL '30 minutes'
),
(
    'john.customer@example.com',
    'b1ffc99-9c0b-4ef8-bb6d-6bb9bd380a12'::UUID,
    '10.0.0.50'::INET,
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15',
    NOW() - INTERVAL '2 hours'
);

-- Insert sample webhook logs
INSERT INTO webhook_logs (
    client_id, user_id, event_type, url, request_payload, response_status, response_body, 
    retry_count, success, error_message, duration_ms, created_at
) VALUES 
(
    'b1ffc99-9c0b-4ef8-bb6d-6bb9bd380a12'::UUID,
    'e4ffc99-9c0b-4ef8-bb6d-6bb9bd380a15'::UUID,
    'user.register',
    'https://api.example-store.com/auth/webhook',
    '{
        "event": "user.register",
        "user_id": "e4ffc99-9c0b-4ef8-bb6d-6bb9bd380a15",
        "email": "john.customer@example.com",
        "timestamp": "2024-01-15T10:30:00Z"
    }'::JSONB,
    200,
    '{"roles": ["customer"], "custom_claims": {"loyalty_tier": "bronze"}}',
    0,
    true,
    NULL,
    150,
    NOW() - INTERVAL '20 days'
),
(
    'b1ffc99-9c0b-4ef8-bb6d-6bb9bd380a12'::UUID,
    'f5ffc99-9c0b-4ef8-bb6d-6bb9bd380a16'::UUID,
    'user.login',
    'https://api.example-store.com/auth/webhook',
    '{
        "event": "user.login",
        "user_id": "f5ffc99-9c0b-4ef8-bb6d-6bb9bd380a16",
        "email": "sarah.vendor@example.com",
        "timestamp": "2024-01-20T14:45:00Z",
        "device_info": {
            "ip_address": "198.51.100.25",
            "user_agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"
        }
    }'::JSONB,
    200,
    '{"roles": ["vendor", "admin"], "permissions": ["manage_products", "view_reports"]}',
    0,
    true,
    NULL,
    120,
    NOW() - INTERVAL '3 days'
),
(
    'c2eecc99-9c0b-4ef8-bb6d-6bb9bd380a13'::UUID,
    'g6ffc99-9c0b-4ef8-bb6d-6bb9bd380a17'::UUID,
    'user.register',
    'https://api.startup.io/auth/webhook',
    '{
        "event": "user.register",
        "user_id": "g6ffc99-9c0b-4ef8-bb6d-6bb9bd380a17",
        "email": "mike@startup.io",
        "timestamp": "2024-01-25T09:15:00Z"
    }'::JSONB,
    500,
    'Internal Server Error',
    2,
    false,
    'Webhook endpoint returned 500 status',
    3000,
    NOW() - INTERVAL '5 days'
);

-- Update user login statistics
UPDATE users SET