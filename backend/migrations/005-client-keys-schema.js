exports.up = function(knex) {
  return knex.schema.createTable('client_keys', function(table) {
    table.increments('id').primary();
    table.integer('client_id').notNullable().references('id').inTable('clients').onDelete('CASCADE');
    table.string('key_id', 50).notNullable().unique();
    table.text('public_key').notNullable();
    table.text('private_key_encrypted').notNullable();
    table.string('algorithm', 20).defaultTo('RS256');
    table.boolean('is_active').defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('revoked_at').nullable();
    table.string('key_usage', 20).defaultTo('signing');
    table.string('key_type', 20).defaultTo('RSA');
    table.integer('key_size').defaultTo(2048);
    table.string('kid', 100).unique();
    
    table.index(['client_id']);
    table.index(['key_id']);
    table.index(['kid']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('client_keys');
}; 