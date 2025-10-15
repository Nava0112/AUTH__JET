/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    // Create user_sessions table
    await knex.schema.createTable('user_sessions', (table) => {
      table.increments('id').primary();
      table.integer('user_id').notNullable()
        .references('id').inTable('users').onDelete('CASCADE');
      table.integer('client_id').notNullable()
        .references('id').inTable('clients').onDelete('CASCADE');
      table.integer('application_id').notNullable()
        .references('id').inTable('client_applications').onDelete('CASCADE');
      table.string('refresh_token').notNullable();
      table.integer('use_count').defaultTo(0);
      table.boolean('revoked').defaultTo(false);
      table.timestamp('revoked_at');
      table.timestamp('expires_at').notNullable();
      table.string('ip_address');
      table.string('user_agent');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
  
    // Create user_role_requests table
    await knex.schema.createTable('user_role_requests', (table) => {
      table.increments('id').primary();
      table.integer('user_id').notNullable()
        .references('id').inTable('users').onDelete('CASCADE');
      table.integer('client_id').notNullable()
        .references('id').inTable('clients').onDelete('CASCADE');
      table.integer('application_id').notNullable()
        .references('id').inTable('client_applications').onDelete('CASCADE');
      table.string('current_user_role').notNullable();
      table.string('requested_role').notNullable();
      table.string('status').defaultTo('pending');
      table.text('admin_notes');
      table.timestamp('expires_at').notNullable();
      table.timestamp('reviewed_at');
      table.integer('reviewed_by')
        .references('id').inTable('admins');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    });
  
    // Create indexes for performance
    await knex.schema.alterTable('user_sessions', (table) => {
      table.index(['refresh_token'], 'idx_user_sessions_refresh_token');
      table.index(['user_id', 'client_id', 'application_id'], 'idx_user_sessions_user_client_app');
      table.index(['expires_at'], 'idx_user_sessions_expires_at');
    });
  
    await knex.schema.alterTable('user_role_requests', (table) => {
      table.index(['user_id', 'client_id', 'application_id'], 'idx_role_requests_user_client_app');
      table.index(['status', 'expires_at'], 'idx_role_requests_status_expires');
    });
  };
  
  /**
   * @param { import("knex").Knex } knex
   * @returns { Promise<void> }
   */
  exports.down = async function (knex) {
    await knex.schema.alterTable('user_role_requests', (table) => {
      table.dropIndex(['user_id', 'client_id', 'application_id'], 'idx_role_requests_user_client_app');
      table.dropIndex(['status', 'expires_at'], 'idx_role_requests_status_expires');
    });
  
    await knex.schema.alterTable('user_sessions', (table) => {
      table.dropIndex(['refresh_token'], 'idx_user_sessions_refresh_token');
      table.dropIndex(['user_id', 'client_id', 'application_id'], 'idx_user_sessions_user_client_app');
      table.dropIndex(['expires_at'], 'idx_user_sessions_expires_at');
    });
  
    await knex.schema.dropTableIfExists('user_role_requests');
    await knex.schema.dropTableIfExists('user_sessions');
  };
  