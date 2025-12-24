exports.up = async (pgm) => {
  console.log('🚀 Starting schema unification migration...');

  // ============================================================================
  // STEP 1: Add client_id string column to clients table
  // ============================================================================
  console.log('Step 1: Adding client_id column to clients table...');
  
  pgm.addColumns('clients', {
    client_id: {
      type: 'varchar(255)',
      unique: true,
      notNull: false  // Temporarily nullable for migration
    }
  });

  // Generate client_id values for existing clients
  pgm.sql(`
    UPDATE clients 
    SET client_id = 'cli_' || substring(md5(random()::text || id::text) from 1 for 32)
    WHERE client_id IS NULL
  `);

  // Make client_id NOT NULL after populating
  pgm.alterColumn('clients', 'client_id', { notNull: true });

  console.log('✅ Step 1 complete: client_id column added');

  // ============================================================================
  // STEP 2: Create application_keys table
  // ============================================================================
  console.log('Step 2: Creating application_keys table...');

  pgm.createTable('application_keys', {
    id: 'id',
    application_id: {
      type: 'integer',
      notNull: true,
      references: 'client_applications',
      onDelete: 'CASCADE'
    },
    key_id: { 
      type: 'varchar(50)', 
      notNull: true, 
      unique: true 
    },
    public_key: { 
      type: 'text', 
      notNull: true 
    },
    private_key_encrypted: { 
      type: 'text', 
      notNull: true 
    },
    algorithm: { 
      type: 'varchar(20)', 
      default: 'RS256' 
    },
    kid: { 
      type: 'varchar(100)', 
      notNull: true, 
      unique: true 
    },
    is_active: { 
      type: 'boolean', 
      default: true 
    },
    created_at: { 
      type: 'timestamp', 
      default: pgm.func('NOW()') 
    },
    revoked_at: { 
      type: 'timestamp' 
    }
  });

  // Add indexes
  pgm.createIndex('application_keys', 'application_id', { name: 'idx_application_keys_app_id' });
  pgm.createIndex('application_keys', 'kid', { name: 'idx_application_keys_kid' });
  pgm.createIndex('application_keys', 'is_active', { name: 'idx_application_keys_is_active' });

  console.log('✅ Step 2 complete: application_keys table created');

  // ============================================================================
  // STEP 3: Migrate client_keys data to application_keys
  // ============================================================================
  console.log('Step 3: Migrating client_keys to application_keys...');

  // Check if client_keys table exists
  const tableExists = await pgm.db.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_name = 'client_keys'
    )
  `);

  if (tableExists.rows[0].exists) {
    console.log('Found client_keys table, migrating data...');
    
    // For each client, assign their keys to their first application
    pgm.sql(`
      INSERT INTO application_keys (
        application_id, key_id, public_key, private_key_encrypted,
        algorithm, kid, is_active, created_at, revoked_at
      )
      SELECT 
        ca.id as application_id,
        ck.key_id,
        ck.public_key,
        ck.private_key_encrypted,
        ck.algorithm,
        ck.kid,
        ck.is_active,
        ck.created_at,
        ck.revoked_at
      FROM client_keys ck
      JOIN clients c ON ck.client_id = c.id
      JOIN LATERAL (
        SELECT id FROM client_applications 
        WHERE client_id = c.id 
        ORDER BY created_at ASC 
        LIMIT 1
      ) ca ON true
      WHERE EXISTS (
        SELECT 1 FROM client_applications WHERE client_id = c.id
      )
    `);

    console.log('✅ Data migrated from client_keys to application_keys');
  } else {
    console.log('⚠️  client_keys table not found, skipping migration');
  }

  console.log('✅ Step 3 complete: Keys migrated');

  // ============================================================================
  // STEP 4: Rebuild sessions table (polymorphic design)
  // ============================================================================
  console.log('Step 4: Rebuilding sessions table...');

  // Backup existing sessions
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS sessions_backup AS 
    SELECT * FROM sessions
  `);

  // Drop old sessions table
  pgm.dropTable('sessions', { ifExists: true });

  // Create new polymorphic sessions table
  pgm.createTable('sessions', {
    id: 'id',
    session_type: { 
      type: 'varchar(50)', 
      notNull: true 
    },
    entity_id: { 
      type: 'integer', 
      notNull: true 
    },
    refresh_token: { 
      type: 'varchar(500)', 
      notNull: true, 
      unique: true 
    },
    expires_at: { 
      type: 'timestamp', 
      notNull: true 
    },
    revoked: { 
      type: 'boolean', 
      default: false 
    },
    revoked_at: { 
      type: 'timestamp' 
    },
    ip_address: { 
      type: 'inet' 
    },
    user_agent: { 
      type: 'text' 
    },
    created_at: { 
      type: 'timestamp', 
      default: pgm.func('NOW()') 
    }
  });

  // Add indexes
  pgm.createIndex('sessions', 'refresh_token', { name: 'idx_sessions_refresh_token' });
  pgm.createIndex('sessions', 'expires_at', { name: 'idx_sessions_expires_at' });
  pgm.createIndex('sessions', ['entity_id', 'session_type', 'revoked'], { 
    name: 'idx_sessions_entity_lookup' 
  });
  pgm.createIndex('sessions', 'revoked', { name: 'idx_sessions_revoked' });

  // Migrate old sessions to new format
  pgm.sql(`
    INSERT INTO sessions (session_type, entity_id, refresh_token, expires_at, revoked, revoked_at, ip_address, created_at)
    SELECT 
      CASE 
        WHEN admin_id IS NOT NULL THEN 'admin'
        WHEN client_id IS NOT NULL THEN 'client'
        WHEN user_id IS NOT NULL THEN 'user'
      END as session_type,
      COALESCE(admin_id, client_id, user_id) as entity_id,
      refresh_token,
      expires_at,
      COALESCE(revoked, false),
      revoked_at,
      ip_address,
      created_at
    FROM sessions_backup
    WHERE (admin_id IS NOT NULL OR client_id IS NOT NULL OR user_id IS NOT NULL)
  `);

  console.log('✅ Step 4 complete: Sessions table rebuilt');

  // ============================================================================
  // STEP 5: Add application_secret to client_applications
  // ============================================================================
  console.log('Step 5: Adding application_secret column...');

  pgm.addColumn('client_applications', {
    application_secret: {
      type: 'varchar(255)',
      notNull: false  // Temporarily nullable
    }
  });

  // Generate application secrets for existing applications
  pgm.sql(`
    UPDATE client_applications
    SET application_secret = 'aps_' || substring(md5(random()::text || id::text) from 1 for 32)
    WHERE application_secret IS NULL
  `);

  // Make application_secret NOT NULL
  pgm.alterColumn('client_applications', 'application_secret', { notNull: true });

  console.log('✅ Step 5 complete: application_secret column added');

  // ============================================================================
  // STEP 6: Remove DEFAULT from client_secret in client_applications
  // ============================================================================
  console.log('Step 6: Cleaning up client_applications...');

  // Check if client_secret column exists in client_applications
  const hasClientSecret = await pgm.db.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'client_applications' AND column_name = 'client_secret'
  `);

  if (hasClientSecret.rows.length > 0) {
    console.log('Removing client_secret from client_applications (it belongs in clients table)...');
    pgm.dropColumn('client_applications', 'client_secret', { ifExists: true });
  }

  console.log('✅ Step 6 complete: client_applications cleaned up');

  // ============================================================================
  // STEP 7: Create views
  // ============================================================================
  console.log('Step 7: Creating database views...');

  // Active Sessions View
  pgm.createView('active_sessions', {}, `
    SELECT 
      s.*,
      s.session_type as user_type
    FROM sessions s
    WHERE s.revoked = false 
    AND s.expires_at > NOW()
  `);

  console.log('✅ Step 7 complete: Views created');

  // ============================================================================
  // FINAL STEP: Cleanup
  // ============================================================================
  console.log('Final step: Cleanup...');

  // Drop backup table after successful migration (optional - uncomment if desired)
  // pgm.dropTable('sessions_backup', { ifExists: true });

  console.log('🎉 Schema unification migration complete!');
  console.log('📊 Summary:');
  console.log('  - Added client_id string column to clients');
  console.log('  - Created application_keys table');
  console.log('  - Migrated keys from client to application level');
  console.log('  - Rebuilt sessions table with polymorphic design');
  console.log('  - Added application_secret to client_applications');
  console.log('  - Created database views');
};

exports.down = async (pgm) => {
  console.log('🔄 Rolling back schema unification...');

  // Drop views
  pgm.dropView('active_sessions', { ifExists: true });

  // Remove application_secret
  pgm.dropColumn('client_applications', 'application_secret', { ifExists: true });

  // Drop application_keys table
  pgm.dropTable('application_keys', { ifExists: true });

  // Remove client_id from clients
  pgm.dropColumn('clients', 'client_id', { ifExists: true });

  // Restore sessions_backup if it exists
  pgm.sql(`
    DROP TABLE IF EXISTS sessions;
    ALTER TABLE IF EXISTS sessions_backup RENAME TO sessions;
  `);

  console.log('✅ Rollback complete');
};
