const { Pool } = require('pg');
const logger = require('../utils/logger');

class DatabaseConfig {
  constructor() {
    this.config = this.loadConfig();
    this.pool = null;
  }

  loadConfig() {
    const isProduction = process.env.NODE_ENV === 'production';
    const isTest = process.env.NODE_ENV === 'test';

    // Base configuration
    const baseConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || (isTest ? 'authjet_test' : 'authjet'),
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      max: parseInt(process.env.DB_POOL_MAX) || 20,
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 2000,
      allowExitOnIdle: false,
    };

    // Environment-specific configurations
    if (isProduction) {
      // Production configuration
      Object.assign(baseConfig, {
        ssl: {
          rejectUnauthorized: false,
          ca: process.env.DB_SSL_CA,
          cert: process.env.DB_SSL_CERT,
          key: process.env.DB_SSL_KEY,
        },
        max: parseInt(process.env.DB_POOL_MAX) || 25,
        idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,
      });
    } else if (isTest) {
      // Test configuration
      Object.assign(baseConfig, {
        max: 10,
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 8000,
      });
    } else {
      // Development configuration
      Object.assign(baseConfig, {
        // Log queries in development
        log: (message) => logger.database(message),
      });
    }

    // Connection URL takes precedence if provided
    if (process.env.DATABASE_URL) {
      const url = require('url').parse(process.env.DATABASE_URL);
      baseConfig.host = url.hostname;
      baseConfig.port = url.port;
      baseConfig.database = url.pathname.slice(1);
      baseConfig.user = url.auth.split(':')[0];
      baseConfig.password = url.auth.split(':')[1];
      
      if (url.search && url.search.includes('ssl=true')) {
        baseConfig.ssl = { rejectUnauthorized: false };
      }
    }

    return baseConfig;
  }

  createPool() {
    if (this.pool) {
      return this.pool;
    }

    this.pool = new Pool(this.config);

    // Pool event handlers for better monitoring
    this.pool.on('connect', (client) => {
      logger.database('New client connected to database pool');
    });

    this.pool.on('acquire', (client) => {
      logger.database('Client acquired from pool');
    });

    this.pool.on('remove', (client) => {
      logger.database('Client removed from pool');
    });

    this.pool.on('error', (err, client) => {
      logger.error('Database pool error:', err);
    });

    // Set up graceful shutdown
    this.setupGracefulShutdown();

    return this.pool;
  }

  setupGracefulShutdown() {
    const gracefulShutdown = async (signal) => {
      logger.info(`Received ${signal}, starting graceful shutdown...`);
      
      // Stop accepting new connections
      if (this.pool) {
        try {
          await this.pool.end();
          logger.info('Database pool closed gracefully');
        } catch (error) {
          logger.error('Error closing database pool:', error);
        }
      }
      
      process.exit(0);
    };

    // Handle different shutdown signals
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // For nodemon
  }

  getConfig() {
    return {
      ...this.config,
      password: '***', // Hide password in logs
    };
  }

  // Health check method
  async healthCheck() {
    if (!this.pool) {
      return { status: 'unhealthy', error: 'Pool not initialized' };
    }

    try {
      const client = await this.pool.connect();
      
      // Check database connection
      const result = await client.query('SELECT NOW() as current_time, version() as version');
      client.release();

      return {
        status: 'healthy',
        timestamp: result.rows[0].current_time,
        version: result.rows[0].version,
        pool: {
          totalCount: this.pool.totalCount,
          idleCount: this.pool.idleCount,
          waitingCount: this.pool.waitingCount,
        },
      };
    } catch (error) {
      logger.error('Database health check failed:', error);
      return {
        status: 'unhealthy',
        error: error.message,
      };
    }
  }

  // Get pool statistics
  getPoolStats() {
    if (!this.pool) {
      return null;
    }

    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
    };
  }

  // Test connection (for startup validation)
  async testConnection() {
    try {
      const health = await this.healthCheck();
      if (health.status === 'healthy') {
        logger.info('Database connection test passed');
        return true;
      } else {
        logger.error('Database connection test failed:', health.error);
        return false;
      }
    } catch (error) {
      logger.error('Database connection test failed:', error);
      return false;
    }
  }

  // Method to run database migrations
  async runMigrations() {
    const { default: migrate } = require('node-pg-migrate');
    const logger = require('../utils/logger');

    try {
      logger.info('Starting database migrations...');

      const migrationConfig = {
        databaseUrl: process.env.DATABASE_URL || {
          host: this.config.host,
          port: this.config.port,
          database: this.config.database,
          user: this.config.user,
          password: this.config.password,
        },
        dir: 'migrations',
        direction: 'up',
        migrationsTable: 'pgmigrations',
        count: Infinity,
        verbose: process.env.NODE_ENV !== 'production',
        log: () => {}, // Use our own logger
        logger: {
          info: (msg) => logger.info(`MIGRATION: ${msg}`),
          warn: (msg) => logger.warn(`MIGRATION: ${msg}`),
          error: (msg) => logger.error(`MIGRATION: ${msg}`),
        },
      };

      await migrate(migrationConfig);
      logger.info('Database migrations completed successfully');
    } catch (error) {
      logger.error('Database migrations failed:', error);
      throw error;
    }
  }

  // Method to create test database (for testing environment)
  async createTestDatabase() {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('This method can only be used in test environment');
    }

    const adminPool = new Pool({
      host: this.config.host,
      port: this.config.port,
      database: 'postgres', // Connect to default database
      user: this.config.user,
      password: this.config.password,
    });

    try {
      // Check if test database exists
      const dbCheck = await adminPool.query(
        'SELECT 1 FROM pg_database WHERE datname = $1',
        [this.config.database]
      );

      if (dbCheck.rows.length === 0) {
        // Create test database
        await adminPool.query(`CREATE DATABASE ${this.config.database}`);
        logger.info(`Test database '${this.config.database}' created`);
      } else {
        logger.info(`Test database '${this.config.database}' already exists`);
      }
    } finally {
      await adminPool.end();
    }
  }

  // Method to drop test database (for testing environment)
  async dropTestDatabase() {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('This method can only be used in test environment');
    }

    const adminPool = new Pool({
      host: this.config.host,
      port: this.config.port,
      database: 'postgres', // Connect to default database
      user: this.config.user,
      password: this.config.password,
    });

    try {
      // Terminate existing connections to the test database
      await adminPool.query(`
        SELECT pg_terminate_backend(pid) 
        FROM pg_stat_activity 
        WHERE datname = $1 AND pid <> pg_backend_pid()
      `, [this.config.database]);

      // Drop test database
      await adminPool.query(`DROP DATABASE IF EXISTS ${this.config.database}`);
      logger.info(`Test database '${this.config.database}' dropped`);
    } finally {
      await adminPool.end();
    }
  }
}

// Create singleton instance
const databaseConfig = new DatabaseConfig();

module.exports = databaseConfig;