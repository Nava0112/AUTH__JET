exports.up = async (pgm) => {
  pgm.sql('CREATE EXTENSION IF NOT EXISTS pgcrypto');
  pgm.addColumns('client_applications', {
    oauth_client_id: { type: 'varchar(120)', unique: true },
    oauth_client_secret_hash: { type: 'varchar(64)' },
    oauth_redirect_uris: { type: 'jsonb', default: '[]' },
    oauth_allowed_scopes: { type: 'jsonb', default: '["openid", "profile", "email"]' },
    oauth_client_type: { type: 'varchar(20)', default: 'confidential' }
  });
  pgm.sql(`
    UPDATE client_applications
    SET oauth_client_id = 'authjet_' || id || '_' || substring(md5(random()::text) from 1 for 16),
        oauth_redirect_uris = jsonb_build_array(redirect_url),
        oauth_client_secret_hash = md5(application_secret)
    WHERE oauth_client_id IS NULL
  `);
  pgm.alterColumn('client_applications', 'oauth_client_id', { notNull: true });
  pgm.alterColumn('client_applications', 'oauth_client_secret_hash', { notNull: true });
  pgm.sql(`CREATE TABLE oauth_authorization_codes (
    id SERIAL PRIMARY KEY, code_hash varchar(64) UNIQUE NOT NULL,
    user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    application_id integer NOT NULL REFERENCES client_applications(id) ON DELETE CASCADE,
    redirect_uri text NOT NULL, scopes jsonb NOT NULL, nonce text,
    code_challenge text NOT NULL, expires_at timestamptz NOT NULL, used_at timestamptz,
    created_at timestamptz DEFAULT NOW() NOT NULL
  )`);
  pgm.sql(`CREATE TABLE oauth_refresh_tokens (
    id SERIAL PRIMARY KEY, token_hash varchar(64) UNIQUE NOT NULL,
    user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    application_id integer NOT NULL REFERENCES client_applications(id) ON DELETE CASCADE,
    scopes jsonb NOT NULL, expires_at timestamptz NOT NULL, revoked_at timestamptz,
    created_at timestamptz DEFAULT NOW() NOT NULL
  )`);
  pgm.sql('CREATE INDEX oauth_codes_lookup ON oauth_authorization_codes(code_hash, application_id, expires_at)');
  pgm.sql('CREATE INDEX oauth_refresh_lookup ON oauth_refresh_tokens(token_hash, application_id, expires_at)');
};

exports.down = async (pgm) => {
  pgm.sql('DROP TABLE IF EXISTS oauth_refresh_tokens');
  pgm.sql('DROP TABLE IF EXISTS oauth_authorization_codes');
  pgm.dropColumns('client_applications', ['oauth_client_id', 'oauth_client_secret_hash', 'oauth_redirect_uris', 'oauth_allowed_scopes', 'oauth_client_type']);
};