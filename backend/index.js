require('dotenv').config();

const AuthJetApp = require('./src/app');
const logger = require('./src/utils/logger');

// Create application instance
const authJetApp = new AuthJetApp();

// Start the server
authJetApp.start()
  .then((server) => {
    logger.info('AuthJet backend started successfully');
  })
  .catch((error) => {
    logger.error('Failed to start AuthJet backend:', error);
    process.exit(1);
  });

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  
  try {
    await authJetApp.stop();
    logger.info('Server shut down successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

module.exports = authJetApp;
