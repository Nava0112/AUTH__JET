// config/database.js
const { Pool } = require('pg');
const logger = require('../utils/logger');

class DatabaseConfig {
  constructor() {
    this.config = this.loadConfig();
    this.pool = null;
    this.knex = null;
    this.connectionAttempts = 0;
    this.maxConnectionAttempts = 3;
  }

  loadConfig() {
    const isProduction = process.env.NODE_ENV === 'production';

    // Supabase requires SSL and specific settings
    const baseConfig = {
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'postgres',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      max: parseInt(process.env.DB_POOL_MAX) || 10,
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 10000,
      allowExitOnIdle: false,
      // Supabase requires SSL
      ssl: {
        rejectUnauthorized: false
      },
      // Supabase-specific optimizations
      statement_timeout: 30000,
      query_timeout: 30000,
    };

    // Use DATABASE_URL if provided (common with Supabase)
    if (process.env.DATABASE_URL) {
      try {
        const { parse } = require('pg-connection-string');
        const connectionConfig = parse(process.env.DATABASE_URL);
        
        Object.assign(baseConfig, {
          host: connectionConfig.host,
          port: connectionConfig.port,
          database: connectionConfig.database,
          user: connectionConfig.user,
          password: connectionConfig.password,
        });

        // Supabase connection strings include SSL requirement
        baseConfig.ssl = { rejectUnauthorized: false };
        
      } catch (error) {
        logger.error('Error parsing DATABASE_URL:', error);
      }
    }

    // Log configuration (without password)
    logger.info('Supabase database configuration loaded', {
      host: baseConfig.host,
      port: baseConfig.port,
      database: baseConfig.database,
      user: baseConfig.user,
      ssl: !!baseConfig.ssl,
      usingConnectionString: !!process.env.DATABASE_URL
    });

    return baseConfig;
  }

  async createPool() {
    if (this.pool) {
      return this.pool;
    }

    this.pool = new Pool(this.config);

    // Enhanced pool event handlers for Supabase
    this.pool.on('connect', (client) => {
      logger.database('Connected to Supabase database');
    });

    this.pool.on('acquire', (client) => {
      logger.database('Client acquired from pool');
    });

    this.pool.on('remove', (client) => {
      logger.database('Client removed from pool');
    });

    this.pool.on('error', (err, client) => {
      logger.error('Supabase database pool error:', err);
    });

    // Test connection with Supabase
    await this.testSupabaseConnection();

    this.setupGracefulShutdown();
    return this.pool;
  }

  async testSupabaseConnection() {
    while (this.connectionAttempts < this.maxConnectionAttempts) {
      try {
        this.connectionAttempts++;
        logger.info(`Connecting to Supabase (attempt ${this.connectionAttempts}/${this.maxConnectionAttempts})`);
        
        const client = await this.pool.connect();
        
        // Test query specific to Supabase
        const result = await client.query(`
          SELECT 
            current_database() as database,
            version() as version,
            current_user as user,
            inet_server_addr() as host
        `);
        client.release();
        
        logger.info('✅ Successfully connected to Supabase', {
          database: result.rows[0].database,
          user: result.rows[0].user,
          host: result.rows[0].host,
          version: result.rows[0].version.split(',')[0] // Just the PostgreSQL version
        });
        
        this.connectionAttempts = 0;
        return true;
        
      } catch (error) {
        logger.error(`❌ Supabase connection attempt ${this.connectionAttempts} failed:`, error.message);
        
        // Provide specific Supabase troubleshooting tips
        this.provideSupabaseTroubleshooting(error);
        
        if (this.connectionAttempts < this.maxConnectionAttempts) {
          const delay = 5000; // 5 seconds between retries for Supabase
          logger.info(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          logger.error('All Supabase connection attempts failed');
          throw new Error(`Cannot connect to Supabase: ${error.message}`);
        }
      }
    }
  }

  provideSupabaseTroubleshooting(error) {
    if (error.message.includes('SSL')) {
      logger.info('💡 Supabase Tip: SSL connection required. Make sure ssl: { rejectUnauthorized: false } is set');
    } else if (error.message.includes('password authentication')) {
      logger.info('💡 Supabase Tip: Check your password in the Supabase dashboard under Settings > Database');
    } else if (error.message.includes('timeout')) {
      logger.info('💡 Supabase Tip: Connection timeout. Check your network and Supabase project status');
    } else if (error.message.includes('does not exist')) {
      logger.info('💡 Supabase Tip: Database name should be "postgres" for Supabase');
    }
  }

  // Initialize Knex for Supabase
  initKnex() {
    if (this.knex) {
      return this.knex;
    }

    const environment = process.env.NODE_ENV || 'development';
    
    // Knex configuration for Supabase
    const knexConfig = {
      client: 'pg',
      connection: {
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
        user: this.config.user,
        password: this.config.password,
        ssl: this.config.ssl,
      },
      pool: {
        min: 2,
        max: 10,
        acquireTimeoutMillis: 30000,
        createTimeoutMillis: 30000,
        destroyTimeoutMillis: 5000,
        idleTimeoutMillis: 30000,
        reapIntervalMillis: 1000,
        createRetryIntervalMillis: 100,
      },
      migrations: {
        directory: './migrations',
        tableName: 'knex_migrations'
      },
      seeds: {
        directory: './seeds'
      }
    };

    this.knex = require('knex')(knexConfig);
    
    logger.info(`Knex initialized for Supabase (${environment})`);
    return this.knex;
  }

  // Rest of your methods remain similar but optimized for Supabase...
  async runMigrations() {
    try {
      logger.info('Starting migrations on Supabase...');
      
      if (!this.knex) {
        this.initKnex();
      }

      const [batchNo, log] = await this.knex.migrate.latest();
      
      if (log.length === 0) {
        logger.info('No new migrations to run on Supabase');
      } else {
        logger.info(`Supabase migration batch ${batchNo} ran ${log.length} migrations:`);
        log.forEach(migration => logger.info(`  - ${migration}`));
      }

      logger.info('Supabase migrations completed successfully');
      return { batchNo, migrations: log };
    } catch (error) {
      logger.error('Supabase migrations failed:', error);
      throw error;
    }
  }

  // ... other methods remain the same
}

const databaseConfig = new DatabaseConfig();
module.exports = databaseConfig;