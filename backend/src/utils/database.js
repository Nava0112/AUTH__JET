const databaseConfig = require('../config/database');
const logger = require('./logger');

class Database {
  constructor() {
    this.pool = null;
    this.isConnected = false;
  }

  async connect() {
    if (this.pool && this.isConnected) {
      return this.pool;
    }

    this.pool = databaseConfig.createPool();

    try {
      // Test connection
      const client = await this.pool.connect();
      const result = await client.query('SELECT NOW() as current_time, version() as version');
      
      logger.info('Database connected successfully', {
        timestamp: result.rows[0].current_time,
        version: result.rows[0].version,
      });
      
      client.release();
      this.isConnected = true;
      
      return this.pool;
    } catch (error) {
      logger.error('Database connection failed:', error);
      throw error;
    }
  }

  async query(text, params) {
    if (!this.isConnected) {
      await this.connect();
    }

    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      
      if (process.env.NODE_ENV === 'development') {
        logger.database('Executed query', { 
          text, 
          duration: `${duration}ms`, 
          rows: result.rowCount 
        });
      }
      
      return result;
    } catch (error) {
      logger.error('Query error:', { 
        text, 
        params, 
        error: error.message,
        stack: error.stack 
      });
      throw error;
    }
  }

  async getClient() {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      const client = await this.pool.connect();
      
      // Add query method to client for consistency
      client.queryAsync = (text, params) => {
        return client.query(text, params);
      };

      return client;
    } catch (error) {
      logger.error('Failed to get database client:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.pool) {
      await this.pool.end();
      this.isConnected = false;
      this.pool = null;
      logger.info('Database pool closed');
    }
  }

  async healthCheck() {
    try {
      const health = await databaseConfig.healthCheck();
      return health;
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
      };
    }
  }

  getPoolStats() {
    return databaseConfig.getPoolStats();
  }

  // Transaction helper method
  async transaction(callback) {
    const client = await this.getClient();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      client.release();
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      client.release();
      logger.error('Transaction failed:', error);
      throw error;
    }
  }

  // Batch operation helper
  async batchInsert(table, records, batchSize = 100) {
    if (!records || records.length === 0) {
      return [];
    }

    const results = [];
    
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const placeholders = [];
      const values = [];
      
      batch.forEach((record, index) => {
        const startIndex = index * Object.keys(record).length;
        const recordPlaceholders = Object.keys(record)
          .map((_, idx) => `$${startIndex + idx + 1}`)
          .join(', ');
        
        placeholders.push(`(${recordPlaceholders})`);
        values.push(...Object.values(record));
      });

      const columns = Object.keys(records[0]).join(', ');
      const query = `
        INSERT INTO ${table} (${columns}) 
        VALUES ${placeholders.join(', ')} 
        RETURNING *
      `;

      const result = await this.query(query, values);
      results.push(...result.rows);
    }

    return results;
  }

  // Method to run migrations
  async runMigrations() {
    return await databaseConfig.runMigrations();
  }

  // Method to check if a table exists
  async tableExists(tableName) {
    try {
      const result = await this.query(
        'SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)',
        [tableName]
      );
      return result.rows[0].exists;
    } catch (error) {
      logger.error('Table existence check failed:', error);
      return false;
    }
  }

  // Method to get table information
  async getTableInfo(tableName) {
    try {
      const result = await this.query(`
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns 
        WHERE table_name = $1 
        ORDER BY ordinal_position
      `, [tableName]);
      
      return result.rows;
    } catch (error) {
      logger.error('Table info query failed:', error);
      throw error;
    }
  }
}

module.exports = new Database();