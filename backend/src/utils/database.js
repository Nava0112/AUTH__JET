// src/utils/database.js
const { Pool } = require('pg');
const logger = require('./logger');

class Database {
  constructor() {
    this.pool = null;
    this.config = this.loadConfig();
  }

  loadConfig() {
    // Supabase configuration
    return {
      host: process.env.DB_HOST ,
      port: parseInt(process.env.DB_PORT),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: { rejectUnauthorized: false },
      max: parseInt(process.env.DB_POOL_MAX) || 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    };
  }

  async connect() {
    if (this.pool) {
      return this.pool;
    }

    this.pool = new Pool(this.config);
    
    // Test connection
    try {
      const client = await this.pool.connect();
      const result = await client.query('SELECT NOW()');
      client.release();
      logger.info('✅ Connected to Supabase successfully');
      return this.pool;
    } catch (error) {
      logger.error('❌ Failed to connect to Supabase:', error);
      throw error;
    }
  }

  async query(text, params) {
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      logger.database(`Query executed in ${duration}ms`, { text, duration });
      return result;
    } catch (error) {
      logger.error('Database query error:', error);
      throw error;
    }
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}

module.exports = new Database();