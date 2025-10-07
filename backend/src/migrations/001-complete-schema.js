// migrations/001-initial-schema.js

exports.up = function(knex) {
  return knex.schema
    .createTable('admin_requests', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('email').notNullable().unique();
      table.string('password_hash').notNullable();
      table.string('name').notNullable();
      table.text('justification');
      table.string('status').defaultTo('pending');
      table.timestamp('requested_at').defaultTo(knex.fn.now());
      table.timestamp('reviewed_at');
       table.integer('reviewed_by').unsigned().references('id').inTable('admins');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
    })
    .createTable('admins', (table) => {
      table.increments('id').primary();
      table.string('email').notNullable().unique();
      table.string('password_hash');
      table.string('name').notNullable();
      table.string('role').defaultTo('admin');
      table.boolean('is_active').defaultTo(true);
      table.timestamp('last_login');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.string('google_id');
      table.string('github_id');
    })
    .createTable('clients', (table) => {
      table.increments('id').primary();
      table.string('name').notNullable();
      table.string('email').notNullable().unique();
      table.string('password_hash').notNullable();
      table.string('organization_name').notNullable();
      table.string('plan_type').defaultTo('basic');
      table.boolean('is_active').defaultTo(true);
      table.timestamp('last_login');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.string('client_id').unique();
      table.string('client_secret');
    })
    .createTable('client_applications', (table) => {
      table.increments('id').primary();
      table.integer('client_id').notNullable().references('id').inTable('clients');
      table.string('name').notNullable();
      table.text('description');
      table.string('client_secret').notNullable().defaultTo('temp_secret');
      table.string('auth_mode').defaultTo('basic');
      table.string('main_page_url').notNullable();
      table.string('redirect_url').notNullable();
      table.specificType('allowed_origins', 'text[]');
      table.string('webhook_url');
      table.string('role_request_webhook');
      table.string('default_role').defaultTo('user');
      table.boolean('is_active').defaultTo(true);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.jsonb('roles_config').defaultTo('[]');
    })
    .createTable('users', (table) => {
      table.increments('id').primary();
      table.integer('client_id').notNullable().references('id').inTable('clients');
      table.integer('application_id').notNullable().references('id').inTable('client_applications');
      table.string('email').notNullable();
      table.string('password_hash').notNullable();
      table.string('name');
      table.string('role').defaultTo('user');
      table.string('requested_role');
      table.string('role_request_status').defaultTo('none');
      table.jsonb('metadata').defaultTo('{}');
      table.boolean('is_active').defaultTo(true);
      table.boolean('email_verified').defaultTo(false);
      table.timestamp('last_login');
      table.string('jwt_refresh_token');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      
      // Add composite index for client_id and email
      table.index(['client_id', 'email']);
    })
    .createTable('sessions', (table) => {
      table.increments('id').primary();
      table.integer('admin_id').references('id').inTable('admins');
      table.integer('client_id').references('id').inTable('clients');
      table.integer('user_id').references('id').inTable('users');
      table.string('session_type').notNullable();
      table.string('refresh_token').notNullable();
      table.timestamp('expires_at').notNullable();
      table.boolean('revoked').defaultTo(false);
      table.timestamp('revoked_at');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      
      // Add indexes for better performance
      table.index(['refresh_token']);
      table.index(['expires_at']);
    })
    .createTable('audit_logs', (table) => {
      table.increments('id').primary();
      table.integer('admin_id').references('id').inTable('admins');
      table.integer('client_id').references('id').inTable('clients');
      table.integer('user_id').references('id').inTable('users');
      table.string('action').notNullable();
      table.string('resource_type');
      table.integer('resource_id');
      table.jsonb('metadata').defaultTo('{}');
      table.string('ip_address');
      table.text('user_agent');
      table.timestamp('created_at').defaultTo(knex.fn.now());
      
      // Add indexes for better query performance
      table.index(['admin_id', 'created_at']);
      table.index(['client_id', 'created_at']);
      table.index(['user_id', 'created_at']);
      table.index(['resource_type', 'resource_id']);
    });
};

exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('audit_logs')
    .dropTableIfExists('sessions')
    .dropTableIfExists('users')
    .dropTableIfExists('client_applications')
    .dropTableIfExists('clients')
    .dropTableIfExists('admins')
    .dropTableIfExists('admin_requests');
};