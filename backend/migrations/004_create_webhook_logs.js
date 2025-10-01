exports.up = (pgm) => {
  // Webhook logs table
  pgm.createTable('webhook_logs', {
    id: {
      type: 'UUID',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    client_id: {
      type: 'UUID',
      notNull: true,
      references: 'clients(id)',
      onDelete: 'CASCADE',
    },
    user_id: {
      type: 'UUID',
      notNull: false,
      references: 'users(id)',
      onDelete: 'SET NULL',
    },
    url: {
      type: 'TEXT',
      notNull: true,
    },
    event_type: {
      type: 'VARCHAR(100)',
      notNull: true,
    },
    request_payload: {
      type: 'JSONB',
      notNull: true,
    },
    request_headers: {
      type: 'JSONB',
      notNull: true,
    },
    response_status: {
      type: 'INTEGER',
      notNull: false,
    },
    response_body: {
      type: 'TEXT',
      notNull: false,
    },
    response_headers: {
      type: 'JSONB',
      notNull: false,
    },
    retry_count: {
      type: 'INTEGER',
      notNull: true,
      default: 0,
    },
    success: {
      type: 'BOOLEAN',
      notNull: true,
    },
    error_message: {
      type: 'TEXT',
      notNull: false,
    },
    duration_ms: {
      type: 'INTEGER',
      notNull: false,
    },
    created_at: {
      type: 'TIMESTAMPTZ',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  // Indexes for webhook logs
  pgm.createIndex('webhook_logs', 'client_id');
  pgm.createIndex('webhook_logs', ['client_id', 'event_type']);
  pgm.createIndex('webhook_logs', 'created_at');
  pgm.createIndex('webhook_logs', 'success');
  pgm.createIndex('webhook_logs', ['client_id', 'success', 'created_at']);
};

exports.down = (pgm) => {
  pgm.dropTable('webhook_logs');
};