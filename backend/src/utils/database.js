// src/utils/database.js
const { Pool } = require('pg');
const logger = require('./logger');

class Database {
  constructor() {
    this.pool = null;
    this.config = this.loadConfig();
    this.connectionAttempts = 0;
    this.maxConnectionAttempts = 3;
  }

  loadConfig() {
    // Use DATABASE_URL if available (common with Supabase)
    if (process.env.DATABASE_URL) {
      const { parse } = require('pg-connection-string');
      const connectionConfig = parse(process.env.DATABASE_URL);
      
      return {
        host: connectionConfig.host,
        port: connectionConfig.port,
        database: connectionConfig.database,
        user: connectionConfig.user,
        password: connectionConfig.password,
        ssl: { rejectUnauthorized: false },
        max: parseInt(process.env.DB_POOL_MAX) || 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      };
    }

    // Fallback to individual environment variables
    return {
      host: process.env.DB_HOST,
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
    
    // Enhanced error handling with retries
    while (this.connectionAttempts < this.maxConnectionAttempts) {
      try {
        this.connectionAttempts++;
        logger.info(`Connecting to Supabase (attempt ${this.connectionAttempts})`);
        
        const client = await this.pool.connect();
        const result = await client.query('SELECT NOW()');
        client.release();
        
        logger.info('✅ Connected to Supabase successfully');
        this.connectionAttempts = 0;
        return this.pool;
        
      } catch (error) {
        logger.error(`❌ Connection attempt ${this.connectionAttempts} failed:`, error.message);
        
        if (this.connectionAttempts < this.maxConnectionAttempts) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          await this.close();
          throw new Error(`Failed to connect to Supabase after ${this.maxConnectionAttempts} attempts: ${error.message}`);
        }
      }
    }
  }

  async query(text, params) {
    if (!this.pool) {
      await this.connect();
    }

    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      logger.database(`Query executed in ${duration}ms`, { 
        text: text.substring(0, 100) + (text.length > 100 ? '...' : ''), 
        duration,
        rowCount: result.rowCount 
      });
      return result;
    } catch (error) {
      logger.error('Database query error:', {
        error: error.message,
        query: text.substring(0, 200)
      });
      throw error;
    }
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      logger.info('Database connection closed');
    }
  }
}

module.exports = new Database();