const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const { spawn } = require('child_process');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/patlinks';

/**
 * Reset Database Script
 *
 * This script will:
 * 1. Drop all collections in the database
 * 2. Re-run the seed script to populate fresh data
 *
 * WARNING: This will delete ALL data in the database!
 */

// Connect to MongoDB
async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to MongoDB');
  } catch (error) {
    console.error('✗ MongoDB connection failed:', error);
    process.exit(1);
  }
}

// Drop all collections
async function dropAllCollections() {
  console.log('\n🗑️  Dropping all collections...');

  try {
    const collections = await mongoose.connection.db.collections();

    if (collections.length === 0) {
      console.log('   ℹ️  No collections found');
      return;
    }

    console.log(`   Found ${collections.length} collections`);

    for (const collection of collections) {
      await collection.drop();
      console.log(`   ✓ Dropped collection: ${collection.collectionName}`);
    }

    console.log('\n   ✅ All collections dropped successfully');
  } catch (error) {
    console.error('   ❌ Error dropping collections:', error.message);
    throw error;
  }
}

// Run seed script
function runSeedScript() {
  return new Promise((resolve, reject) => {
    console.log('\n🌱 Running seed script...\n');
    console.log('═══════════════════════════════════════════════════════════\n');

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

    seedProcess.on('error', (error) => {
      reject(error);
    });
  });
}

// Main reset function
async function resetDatabase() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║                                                           ║');
  console.log('║   🔄 Database Reset Script                               ║');
  console.log('║   Patlinks Multi-Tenant Food Ordering Platform            ║');
  console.log('║                                                           ║');
  console.log('║   ⚠️  WARNING: This will delete ALL data!                ║');
  console.log('║                                                           ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  // Confirmation prompt
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question('Are you sure you want to reset the database? (yes/no): ', async (answer) => {
    if (answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'y') {
      console.log('\n👋 Reset cancelled by user');
      rl.close();
      process.exit(0);
    }

    rl.close();

    try {
      // Connect to database
      await connectDB();

      // Drop all collections
      await dropAllCollections();

      // Close database connection
      await mongoose.connection.close();
      console.log('\n✓ Database connection closed');

      // Run seed script
      await runSeedScript();

      console.log('\n╔═══════════════════════════════════════════════════════════╗');
      console.log('║                                                           ║');
      console.log('║   ✅ Database Reset Completed Successfully!              ║');
      console.log('║                                                           ║');
      console.log('╚═══════════════════════════════════════════════════════════╝\n');

      process.exit(0);
    } catch (error) {
      console.error('\n❌ Error resetting database:', error.message);
      process.exit(1);
    }
  });
}

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\n👋 Reset cancelled by user');
  process.exit(0);
});

// Run reset
resetDatabase();
