exports.up = async function(knex) {
    await knex.schema.createTable('user_sessions', function(table) {
      table.increments('id').primary();
      table.integer('user_id').notNullable();
      table.integer('client_id').notNullable();
      table.integer('application_id').notNullable();
      table.string('refresh_token').notNullable();
      table.integer('use_count').defaultTo(0);
      table.boolean('revoked').defaultTo(false);
      table.timestamp('revoked_at');
      table.timestamp('expires_at').notNullable();
      table.string('ip_address');
      table.string('user_agent');
      table.timestamps(true, true);
      
      // Foreign keys
      table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.foreign('client_id').references('id').inTable('clients').onDelete('CASCADE');
      table.foreign('application_id').references('id').inTable('client_applications').onDelete('CASCADE');
      
      // Indexes for performance
      table.index(['refresh_token']);
      table.index(['user_id', 'client_id', 'application_id']);
      table.index(['expires_at']);
    });
  
    await knex.schema.createTable('user_role_requests', function(table) {
      table.increments('id').primary();
      table.integer('user_id').notNullable();
      table.integer('client_id').notNullable();
      table.integer('application_id').notNullable();
      table.string('current_role').notNullable();
      table.string('requested_role').notNullable();
      table.string('status').defaultTo('pending'); // pending, approved, rejected, expired
      table.text('admin_notes');
      table.timestamp('expires_at').notNullable();
      table.timestamp('reviewed_at');
      table.integer('reviewed_by'); // admin ID
      table.timestamps(true, true);
      
      // Foreign keys
      table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.foreign('client_id').references('id').inTable('clients').onDelete('CASCADE');
      table.foreign('application_id').references('id').inTable('client_applications').onDelete('CASCADE');
      table.foreign('reviewed_by').references('id').inTable('admins');
      
      // Indexes
      table.index(['user_id', 'client_id', 'application_id']);
      table.index(['status', 'expires_at']);
    });
  
    // Add missing columns to users table if they don't exist
    const hasJwtRefreshToken = await knex.schema.hasColumn('users', 'jwt_refresh_token');
    if (!hasJwtRefreshToken) {
      await knex.schema.alterTable('users', function(table) {
        table.string('jwt_refresh_token');
        table.boolean('email_verified').defaultTo(false);
        table.timestamp('last_login');
      });
    }
  
    // Create audit logs for user actions
    await knex.schema.createTableIfNotExists('user_audit_logs', function(table) {
      table.increments('id').primary();
      table.integer('user_id').notNullable();
      table.integer('client_id').notNullable();
      table.integer('application_id').notNullable();
      table.string('action').notNullable(); // login, register, role_request, email_verify
      table.jsonb('metadata').defaultTo('{}');
      table.string('ip_address');
      table.string('user_agent');
      table.timestamps(true, true);
      
      table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.index(['user_id', 'client_id', 'application_id']);
    });
  };
  
  exports.down = async function(knex) {
    await knex.schema.dropTableIfExists('user_audit_logs');
    await knex.schema.dropTableIfExists('user_role_requests');
    await knex.schema.dropTableIfExists('user_sessions');
    
    // Remove added columns
    await knex.schema.alterTable('users', function(table) {
      table.dropColumn('jwt_refresh_token');
      table.dropColumn('email_verified');
      table.dropColumn('last_login');
    });
  };