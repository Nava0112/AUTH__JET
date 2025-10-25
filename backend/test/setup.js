/**
 * Setup and validation script for AuthJet backend
 * This script checks all dependencies and configurations before starting the server
 */

const fs = require('fs');
const path = require('path');

const chalk = { 
  green: (msg) => `\x1b[32m${msg}\x1b[0m`,
  red: (msg) => `\x1b[31m${msg}\x1b[0m`,
  yellow: (msg) => `\x1b[33m${msg}\x1b[0m`,
  blue: (msg) => `\x1b[34m${msg}\x1b[0m`,
};

console.log(chalk.blue('\n🚀 AuthJet Backend Setup & Validation\n'));

let hasErrors = false;
let hasWarnings = false;

// Check Node version
function checkNodeVersion() {
  const requiredVersion = 18;
  const currentVersion = parseInt(process.version.slice(1).split('.')[0]);
  
  if (currentVersion < requiredVersion) {
    console.log(chalk.red(`✗ Node.js version ${currentVersion} is not supported. Required: >= ${requiredVersion}`));
    hasErrors = true;
  } else {
    console.log(chalk.green(`✓ Node.js version ${currentVersion} is supported`));
  }
}

// Check if .env file exists
function checkEnvFile() {
  const envPath = path.join(__dirname, '..', '.env');
  
  if (!fs.existsSync(envPath)) {
    console.log(chalk.yellow('⚠ .env file not found. Creating from template...'));
    
    const examplePath = path.join(__dirname, '..', '.env.example');
    if (fs.existsSync(examplePath)) {
      fs.copyFileSync(examplePath, envPath);
      console.log(chalk.green('✓ .env file created. Please configure it with your settings.'));
      hasWarnings = true;
    } else {
      console.log(chalk.red('✗ .env.example not found'));
      hasErrors = true;
    }
  } else {
    console.log(chalk.green('✓ .env file exists'));
  }
}

// Check required directories
function checkDirectories() {
  const logsDir = path.join(__dirname, 'logs');
  
  if (!fs.existsSync(logsDir)) {
    console.log(chalk.yellow('⚠ logs/ directory not found. Creating...'));
    fs.mkdirSync(logsDir, { recursive: true });
    console.log(chalk.green('✓ logs/ directory created'));
  } else {
    console.log(chalk.green('✓ logs/ directory exists'));
  }
}

// Check required files
function checkRequiredFiles() {
  const requiredFiles = [
    'src/app.js',
    'src/middleware/errorHandler.js',
    'src/config/database.js',
    'src/config/jwt.js',
    'src/utils/logger.js',
    'src/utils/database.js',
    'index.js',
  ];
  
  requiredFiles.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
      console.log(chalk.green(`✓ ${file} exists`));
    } else {
      console.log(chalk.red(`✗ ${file} is missing`));
      hasErrors = true;
    }
  });
}

// Check package.json dependencies
function checkDependencies() {
  const packagePath = path.join(__dirname, 'package.json');
  
  if (!fs.existsSync(packagePath)) {
    console.log(chalk.red('✗ package.json not found'));
    hasErrors = true;
    return;
  }
  
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const requiredDeps = [
    'express',
    'pg',
    'bcryptjs',
    'jsonwebtoken',
    'winston',
    'express-session',
    'helmet',
    'cors',
    'dotenv',
  ];
  
  const missingDeps = requiredDeps.filter(dep => !pkg.dependencies[dep]);
  
  if (missingDeps.length > 0) {
    console.log(chalk.red(`✗ Missing dependencies: ${missingDeps.join(', ')}`));
    console.log(chalk.yellow('  Run: npm install'));
    hasErrors = true;
  } else {
    console.log(chalk.green('✓ All core dependencies are listed'));
  }
  
  // Check if node_modules exists
  const nodeModulesPath = path.join(__dirname, 'node_modules');
  if (!fs.existsSync(nodeModulesPath)) {
    console.log(chalk.yellow('⚠ node_modules not found. Run: npm install'));
    hasWarnings = true;
  } else {
    console.log(chalk.green('✓ node_modules directory exists'));
  }
}

// Check environment variables
function checkEnvVariables() {
  try {
    require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
  } catch (error) {
    console.log(chalk.yellow('⚠ dotenv not installed yet. Skipping environment check.'));
    console.log(chalk.yellow('  Run npm install first.'));
    hasWarnings = true;
    return;
  }
  
  const requiredVars = [
    'DB_HOST',
    'DB_PORT',
    'DB_NAME',
    'DB_USER',
    'DB_PASSWORD',
  ];
  
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.log(chalk.yellow(`⚠ Missing environment variables: ${missingVars.join(', ')}`));
    console.log(chalk.yellow('  Please configure your .env file'));
    hasWarnings = true;
  } else {
    console.log(chalk.green('✓ Required environment variables are set'));
  }
  
  // Check optional but recommended vars
  const recommendedVars = ['SESSION_SECRET', 'ALLOWED_ORIGINS'];
  const missingRecommended = recommendedVars.filter(varName => !process.env[varName]);
  
  if (missingRecommended.length > 0) {
    console.log(chalk.yellow(`⚠ Recommended variables not set: ${missingRecommended.join(', ')}`));
    hasWarnings = true;
  }
}

// Main execution
async function main() {
  try {
    console.log(chalk.blue('Checking Node.js version...'));
    checkNodeVersion();
    
    console.log(chalk.blue('\nChecking configuration files...'));
    checkEnvFile();
    
    console.log(chalk.blue('\nChecking directories...'));
    checkDirectories();
    
    console.log(chalk.blue('\nChecking required files...'));
    checkRequiredFiles();
    
    console.log(chalk.blue('\nChecking dependencies...'));
    checkDependencies();
    
    console.log(chalk.blue('\nChecking environment variables...'));
    checkEnvVariables();
    
    // Summary
    console.log(chalk.blue('\n' + '='.repeat(50)));
    if (hasErrors) {
      console.log(chalk.red('\n✗ Setup validation FAILED'));
      console.log(chalk.red('  Please fix the errors above before running the server.\n'));
      process.exit(1);
    } else if (hasWarnings) {
      console.log(chalk.yellow('\n⚠ Setup validation completed with WARNINGS'));
      console.log(chalk.yellow('  The server may run, but some features might not work properly.\n'));
      process.exit(0);
    } else {
      console.log(chalk.green('\n✓ Setup validation PASSED'));
      console.log(chalk.green('  Your backend is ready to run!\n'));
      console.log(chalk.blue('Next steps:'));
      console.log('  1. Create database: createdb authjet');
      console.log('  2. Run migrations: npm run migrate:up');
      console.log('  3. Start server: npm run dev\n');
      process.exit(0);
    }
  } catch (error) {
    console.error(chalk.red('\n✗ Setup validation failed with error:'));
    console.error(error);
    process.exit(1);
  }
}

main();
