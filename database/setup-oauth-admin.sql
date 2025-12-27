ALTER TABLE admins 
ADD COLUMN IF NOT EXISTS google_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS github_id VARCHAR(255);

ALTER TABLE admins 
ALTER COLUMN password_hash DROP NOT NULL;
INSERT INTO admins (email, name, role, github_id, is_active, created_at, updated_at)
VALUES ('nsmnavarasan@gmail.com', 'Navarasan', 'admin', 'Nava0112', true, NOW(), NOW())
ON CONFLICT (email) 
DO UPDATE SET 
  github_id = 'Nava0112',
  name = COALESCE(EXCLUDED.name, admins.name),
  updated_at = NOW();

SELECT id, email, name, github_id, google_id, is_active 
FROM admins 
WHERE email = 'nsmnavarasan@gmail.com';
