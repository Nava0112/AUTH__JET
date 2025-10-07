// migrations/002-add-indexes.js

exports.up = function(knex) {
  return knex.schema
    .alterTable('admin_requests', (table) => {
      table.index(['status', 'requested_at']);
    })
    .alterTable('admins', (table) => {
      table.index(['email']);
      table.index(['is_active']);
    })
    .alterTable('clients', (table) => {
      table.index(['email']);
      table.index(['is_active']);
      table.index(['client_id']);
    })
    .alterTable('client_applications', (table) => {
      table.index(['client_id']);
      table.index(['is_active']);
    })
    .alterTable('users', (table) => {
      table.index(['client_id', 'application_id']);
      table.index(['email']);
      table.index(['role']);
      table.index(['role_request_status']);
      table.index(['is_active']);
    })
    .alterTable('sessions', (table) => {
      table.index(['admin_id', 'revoked']);
      table.index(['client_id', 'revoked']);
      table.index(['user_id', 'revoked']);
      table.index(['session_type']);
    });
};

exports.down = function(knex) {
  return knex.schema
    .alterTable('admin_requests', (table) => {
      table.dropIndex(['status', 'requested_at']);
    })
    .alterTable('admins', (table) => {
      table.dropIndex(['email']);
      table.dropIndex(['is_active']);
    })
    .alterTable('clients', (table) => {
      table.dropIndex(['email']);
      table.dropIndex(['is_active']);
      table.dropIndex(['client_id']);
    })
    .alterTable('client_applications', (table) => {
      table.dropIndex(['client_id']);
      table.dropIndex(['is_active']);
    })
    .alterTable('users', (table) => {
      table.dropIndex(['client_id', 'application_id']);
      table.dropIndex(['email']);
      table.dropIndex(['role']);
      table.dropIndex(['role_request_status']);
      table.dropIndex(['is_active']);
    })
    .alterTable('sessions', (table) => {
      table.dropIndex(['admin_id', 'revoked']);
      table.dropIndex(['client_id', 'revoked']);
      table.dropIndex(['user_id', 'revoked']);
      table.dropIndex(['session_type']);
    });
};