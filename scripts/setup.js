const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const { spawn } = require('child_process');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/patlinks';

/**
 * Setup Script
 *
 * One-command setup for the entire Patlinks backend.
 * This script will:
 * 1. Check MongoDB connection
 * 2. Create database indexes
 * 3. Seed initial data (plans, super admin, restaurants)
 * 4. Display summary and next steps
 *
 * Usage: npm run setup
 */

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function success(message) {
  log(`✓ ${message}`, colors.green);
}

function error(message) {
  log(`✗ ${message}`, colors.red);
}

function info(message) {
  log(`ℹ ${message}`, colors.cyan);
}

function warning(message) {
  log(`⚠ ${message}`, colors.yellow);
}

// Check MongoDB connection
async function checkMongoConnection() {
  log('\n📡 Checking MongoDB connection...', colors.bright);

  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });

    const adminDb = mongoose.connection.db.admin();
    const serverStatus = await adminDb.serverStatus();

    success('Connected to MongoDB successfully');
    info(`   Version: ${serverStatus.version}`);
    info(`   Uptime: ${Math.floor(serverStatus.uptime)} seconds`);
    info(`   Database: ${mongoose.connection.db.databaseName}`);

    return true;
  } catch (err) {
    error('Failed to connect to MongoDB');
    error(`   ${err.message}`);
    error('\n   Please ensure MongoDB is running:');
    error('   - Start MongoDB: mongod');
    error(`   - Check connection string: ${MONGODB_URI}`);
    return false;
  }
}

// Create database indexes
async function createIndexes() {
  log('\n🔍 Creating database indexes...', colors.bright);

  try {
    const collections = await mongoose.connection.db.listCollections().toArray();

    if (collections.length === 0) {
      info('   No collections found yet (will be created during seeding)');
      return true;
    }

    let indexCount = 0;

    for (const collection of collections) {
      const coll = mongoose.connection.db.collection(collection.name);
      const indexes = await coll.indexes();
      indexCount += indexes.length;
    }

    success(`Database indexes verified (${indexCount} indexes found)`);
    return true;
  } catch (err) {
    error(`Failed to verify indexes: ${err.message}`);
    return false;
  }
}

// Run seed script
function runSeedScript() {
  return new Promise((resolve, reject) => {
    log('\n🌱 Seeding database with initial data...', colors.bright);
    log('═══════════════════════════════════════════════════════════\n');

    const seedProcess = spawn('node', [path.join(__dirname, 'seed-database.js')], {
      stdio: 'inherit',
      env: process.env,
    });

    seedProcess.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Seed script exited with code ${code}`));
      }
    });

    seedProcess.on('error', (err) => {
      reject(err);
    });
  });
}

// Check environment variables
function checkEnvironment() {
  log('\n⚙️  Checking environment configuration...', colors.bright);

  const requiredVars = ['MONGODB_URI', 'JWT_SECRET', 'PORT'];
  const warnings = [];
  let allPresent = true;

  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      warning(`   Missing: ${varName}`);
      allPresent = false;
    } else {
      success(`   Found: ${varName}`);
    }
  }

  // Check optional but recommended vars
  const optionalVars = ['JWT_REFRESH_SECRET', 'CORS_ORIGIN', 'NODE_ENV'];
  for (const varName of optionalVars) {
    if (!process.env[varName]) {
      warnings.push(varName);
    }
  }

  if (warnings.length > 0) {
    warning(`\n   Optional variables not set: ${warnings.join(', ')}`);
  }

  if (!allPresent) {
    error('\n   Please create a .env file with required variables');
    error('   See .env.example for reference');
  }

  return allPresent;
}

// Display summary
function displaySummary() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║                                                           ║');
  log('║   🎉 Setup Completed Successfully!                       ║', colors.green + colors.bright);
  console.log('║                                                           ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  log('🚀 Next Steps:\n', colors.bright);

  console.log('1. Start the development server:');
  log('   npm run dev\n', colors.cyan);

  console.log('2. Access the API:');
  log(`   http://localhost:${process.env.PORT || 5000}/api`, colors.cyan);
  log(`   http://localhost:${process.env.PORT || 5000}/health\n`, colors.cyan);

  console.log('3. Test Super Admin Login:');
  log(`   POST http://localhost:${process.env.PORT || 5000}/api/super-admin/auth/login`, colors.cyan);
  log('   Body: { "username": "superadmin", "password": "superadmin123" }\n', colors.cyan);

  console.log('4. Test Restaurant Admin Login:');
  log(`   POST http://localhost:${process.env.PORT || 5000}/api/auth/login`, colors.cyan);
  log('   Headers: { "x-restaurant-id": "<restaurant_id>" }', colors.cyan);
  log('   Body: { "username": "pizzaadmin", "password": "admin123" }\n', colors.cyan);

  log('📚 Documentation:\n', colors.bright);
  console.log('   API Documentation: API_DOCUMENTATION.md');
  console.log('   Admin API: ADMIN_API_DOCUMENTATION.md');
  console.log('   Setup Guide: docs/SETUP.md');
  console.log('   Architecture: ARCHITECTURE_IMPLEMENTATION.md\n');

  log('🛠️  Available Scripts:\n', colors.bright);
  console.log('   npm run seed             - Seed database with sample data');
  console.log('   npm run reset            - Reset database (drop + reseed)');
  console.log('   npm run create-admin     - Create a new super admin');
  console.log('   npm run test-data        - Generate additional test data');
  console.log('   npm run dev              - Start development server');
  console.log('   npm run build            - Build for production');
  console.log('   npm start                - Start production server\n');

  log('📝 Default Credentials:\n', colors.bright);
  console.log('   Super Admin:');
  console.log('      Username: superadmin');
  console.log('      Password: superadmin123\n');

  console.log('   Restaurant Admins:');
  console.log('      Pizza Palace: pizzaadmin / admin123');
  console.log('      Burger Barn: burgeradmin / admin123');
  console.log('      Sushi Spot: sushiadmin / admin123\n');

  console.log('   Customers:');
  console.log('      All customers: password is "customer123"\n');

  log('🔒 Security Reminder:\n', colors.yellow);
  warning('   Change default passwords before deploying to production!');
  warning('   Generate secure JWT secrets using: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"\n');
}

// Main setup function
async function setup() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║                                                           ║');
  log('║   🏗️  Patlinks Backend Setup                             ║', colors.blue + colors.bright);
  log('║   Multi-Tenant Food Ordering Platform                     ║', colors.blue);
  console.log('║                                                           ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');

  try {
    // Step 1: Check environment variables
    if (!checkEnvironment()) {
      throw new Error('Missing required environment variables');
    }

    // Step 2: Check MongoDB connection
    const mongoConnected = await checkMongoConnection();
    if (!mongoConnected) {
      throw new Error('MongoDB connection failed');
    }

    // Step 3: Create indexes
    await createIndexes();

    // Step 4: Close connection before running seed (seed will create its own)
    await mongoose.connection.close();
    success('Closed MongoDB connection');

    // Step 5: Run seed script
    await runSeedScript();

    // Step 6: Display summary
    displaySummary();

    process.exit(0);
  } catch (err) {
    error(`\n❌ Setup failed: ${err.message}`);
    console.log('\n');

    if (err.message.includes('MongoDB')) {
      error('MongoDB Connection Issues:');
      console.log('   1. Ensure MongoDB is installed and running');
      console.log('   2. Check your connection string in .env');
      console.log('   3. Verify MongoDB is accessible on the configured port\n');
    } else if (err.message.includes('environment')) {
      error('Environment Configuration Issues:');
      console.log('   1. Copy .env.example to .env');
      console.log('   2. Fill in all required variables');
      console.log('   3. Generate secure secrets for JWT_SECRET\n');
    } else {
      error('General Setup Issues:');
      console.log('   1. Check the error message above');
      console.log('   2. Ensure all dependencies are installed: npm install');
      console.log('   3. Build TypeScript files: npm run build');
      console.log('   4. Review logs for more details\n');
    }

    await mongoose.connection.close();
    process.exit(1);
  }
}

// Handle Ctrl+C
process.on('SIGINT', () => {
  log('\n\n👋 Setup cancelled by user', colors.yellow);
  mongoose.connection.close();
  process.exit(0);
});

// Run setup
setup();
