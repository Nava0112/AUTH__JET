// knexfile.js
require('dotenv').config();

const getConfig = () => ({
  client: 'postgresql',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'auth_system',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
  },
  migrations: {
    directory: './migrations',
    tableName: 'knex_migrations'
  },
  seeds: {
    directory: './seeds'
  },
  pool: {
    min: parseInt(process.env.DB_POOL_MIN) || 2,
    max: parseInt(process.env.DB_POOL_MAX) || 10
  },
  acquireConnectionTimeout: parseInt(process.env.DB_TIMEOUT) || 60000,
  debug: process.env.DB_DEBUG === 'true'
});

module.exports = {
  development: getConfig(),
  test: getConfig(),
  staging: getConfig(),
  production: getConfig()
};