exports.up = (pgm) => {
  pgm.sql(`
    DROP VIEW IF EXISTS user_statistics;
    DROP TABLE IF EXISTS user_role_requests;
    DROP INDEX IF EXISTS idx_users_role_request_status;
    DROP INDEX IF EXISTS idx_users_role;

    ALTER TABLE users
      DROP COLUMN IF EXISTS role,
      DROP COLUMN IF EXISTS requested_role,
      DROP COLUMN IF EXISTS role_request_status;

    CREATE OR REPLACE VIEW user_statistics AS
    SELECT
      c.id AS client_id,
      c.name AS client_name,
      ca.id AS application_id,
      ca.name AS application_name,
      COUNT(u.id) AS total_users,
      COUNT(CASE WHEN u.is_active THEN 1 END) AS active_users,
      COUNT(CASE WHEN u.email_verified THEN 1 END) AS verified_users
    FROM clients c
    LEFT JOIN client_applications ca ON c.id = ca.client_id
    LEFT JOIN users u ON ca.id = u.application_id
    GROUP BY c.id, c.name, ca.id, ca.name;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'user',
      ADD COLUMN IF NOT EXISTS requested_role VARCHAR(50),
      ADD COLUMN IF NOT EXISTS role_request_status VARCHAR(50) DEFAULT 'none';

    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_users_role_request_status ON users(role_request_status);
  `);
};