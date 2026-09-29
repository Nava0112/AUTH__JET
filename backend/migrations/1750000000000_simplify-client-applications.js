exports.up = (pgm) => {
  pgm.sql(`
    DROP TRIGGER IF EXISTS update_client_applications_updated_at ON client_applications;

    ALTER TABLE client_applications
      DROP COLUMN IF EXISTS client_secret,
      DROP COLUMN IF EXISTS auth_mode,
      DROP COLUMN IF EXISTS main_page_url,
      DROP COLUMN IF EXISTS allowed_origins,
      DROP COLUMN IF EXISTS webhook_url,
      DROP COLUMN IF EXISTS role_request_webhook,
      DROP COLUMN IF EXISTS default_role,
      DROP COLUMN IF EXISTS roles_config,
      DROP COLUMN IF EXISTS created_at,
      DROP COLUMN IF EXISTS updated_at;

    ALTER TABLE client_applications
      ADD COLUMN IF NOT EXISTS oauth_application_id VARCHAR(120),
      ADD COLUMN IF NOT EXISTS oauth_application_secret VARCHAR(255),
      ADD COLUMN IF NOT EXISTS oauth_allowed_scopes JSONB,
      ADD COLUMN IF NOT EXISTS oauth_jwt_claims JSONB;

    UPDATE client_applications
    SET oauth_application_id = COALESCE(
          oauth_application_id,
          oauth_client_id,
          'authjet_' || id::text
        ),
        oauth_application_secret = COALESCE(
          oauth_application_secret,
          application_secret,
          'aps_' || md5(random()::text || id::text)
        ),
        oauth_allowed_scopes = COALESCE(oauth_allowed_scopes, '["openid", "profile", "email"]'::jsonb),
        oauth_jwt_claims = COALESCE(oauth_jwt_claims, '[]'::jsonb);

    ALTER TABLE client_applications
      DROP COLUMN IF EXISTS oauth_client_id,
      DROP COLUMN IF EXISTS oauth_client_secret_hash,
      DROP COLUMN IF EXISTS oauth_redirect_uris,
      DROP COLUMN IF EXISTS oauth_client_type,
      DROP COLUMN IF EXISTS application_secret;

    ALTER TABLE client_applications
      ALTER COLUMN oauth_application_id SET NOT NULL,
      ALTER COLUMN oauth_application_secret SET NOT NULL,
      ALTER COLUMN oauth_allowed_scopes SET DEFAULT '["openid", "profile", "email"]'::jsonb,
      ALTER COLUMN oauth_jwt_claims SET DEFAULT '[]'::jsonb,
      ALTER COLUMN oauth_jwt_claims SET NOT NULL;

    ALTER TABLE client_applications
      ADD CONSTRAINT client_applications_oauth_application_id_key
      UNIQUE (oauth_application_id);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE client_applications
      DROP CONSTRAINT IF EXISTS client_applications_oauth_application_id_key,
      DROP COLUMN IF EXISTS oauth_application_id,
      DROP COLUMN IF EXISTS oauth_application_secret,
      DROP COLUMN IF EXISTS oauth_allowed_scopes,
      DROP COLUMN IF EXISTS oauth_jwt_claims;
  `);
};