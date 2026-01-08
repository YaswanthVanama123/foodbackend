const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');
const readline = require('readline');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Import SuperAdmin model
const SuperAdmin = require('../dist/modules/common/models/SuperAdmin').default;

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/patlinks';

/**
 * Create Super Admin Script
 *
 * This standalone script creates a new super admin user.
 * Can be used to create the first super admin or additional super admin accounts.
 *
 * Usage:
 *   Interactive: node scripts/create-super-admin.js
 *   With args: node scripts/create-super-admin.js <username> <email> <password> <firstName> <lastName>
 */

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
}

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

// Check for existing super admins
async function checkExistingSuperAdmin() {
  const count = await SuperAdmin.countDocuments();
  return count > 0;
}

// Validate email format
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Create super admin
async function createSuperAdmin(username, email, password, firstName, lastName) {
  try {
    // Check if username already exists
    const existingUsername = await SuperAdmin.findOne({ username });
    if (existingUsername) {
      throw new Error(`Username "${username}" already exists`);
    }

    // Check if email already exists
    const existingEmail = await SuperAdmin.findOne({ email });
    if (existingEmail) {
      throw new Error(`Email "${email}" already exists`);
    }

    // Create super admin (password will be hashed by pre-save hook)
    const superAdmin = await SuperAdmin.create({
      username,
      email,
      password,
      firstName,
      lastName,
      role: 'super_admin',
      isActive: true,
    });

    return superAdmin;
  } catch (error) {
    throw new Error(`Failed to create super admin: ${error.message}`);
  }
}

// Interactive mode
async function interactiveMode() {
  console.log('\n📝 Enter super admin details:\n');

  // Get username
  let username = await question('Username (min 3 chars): ');
  while (!username || username.length < 3) {
    console.log('❌ Username must be at least 3 characters long');
    username = await question('Username (min 3 chars): ');
  }

  // Get email
  let email = await question('Email: ');
  while (!isValidEmail(email)) {
    console.log('❌ Invalid email format');
    email = await question('Email: ');
  }

  // Get password
  let password = await question('Password (min 8 chars): ');
  while (password.length < 8) {
    console.log('❌ Password must be at least 8 characters long');
    password = await question('Password (min 8 chars): ');
  }

  // Confirm password
  let confirmPassword = await question('Confirm Password: ');
  while (password !== confirmPassword) {
    console.log('❌ Passwords do not match');
    confirmPassword = await question('Confirm Password: ');
  }

  // Get first name
  let firstName = await question('First Name: ');
  while (!firstName || firstName.length < 2) {
    console.log('❌ First name must be at least 2 characters long');
    firstName = await question('First Name: ');
  }

  // Get last name
  let lastName = await question('Last Name: ');
  while (!lastName || lastName.length < 2) {
    console.log('❌ Last name must be at least 2 characters long');
    lastName = await question('Last Name: ');
  }

  // Review details
  console.log('\n📋 Review details:\n');
  console.log(`   Username: ${username}`);
  console.log(`   Email: ${email}`);
  console.log(`   Name: ${firstName} ${lastName}`);
  console.log(`   Role: Super Admin`);
  console.log(`   Permissions: Full platform access\n`);

  const confirm = await question('Create super admin with these details? (yes/no): ');

  if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
    console.log('\n👋 Cancelled by user');
    return null;
  }

  return { username, email, password, firstName, lastName };
}

// Command-line arguments mode
function parseArguments() {
  const args = process.argv.slice(2);

  if (args.length !== 5) {
    return null;
  }

  const [username, email, password, firstName, lastName] = args;

  // Validate
  if (username.length < 3) {
    throw new Error('Username must be at least 3 characters long');
  }

  if (!isValidEmail(email)) {
    throw new Error('Invalid email format');
  }

  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters long');
  }

  if (firstName.length < 2 || lastName.length < 2) {
    throw new Error('First name and last name must be at least 2 characters long');
  }

  return { username, email, password, firstName, lastName };
}

// Main function
async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║                                                           ║');
  console.log('║   👤 Create Super Admin                                  ║');
  console.log('║   Patlinks Multi-Tenant Food Ordering Platform            ║');
  console.log('║                                                           ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  try {
    // Connect to database
    await connectDB();

    // Check for existing super admins
    const hasSuperAdmin = await checkExistingSuperAdmin();

    if (hasSuperAdmin) {
      console.log('ℹ️  Super admin(s) already exist in the database.');

      // Only prompt if in interactive mode
      if (process.argv.length === 2) {
        const proceed = await question('\nDo you want to create another super admin? (yes/no): ');

        if (proceed.toLowerCase() !== 'yes' && proceed.toLowerCase() !== 'y') {
          console.log('\n👋 Cancelled by user');
          rl.close();
          process.exit(0);
        }
      }
    }

    // Get super admin details
    let details;

    // Try to parse command-line arguments first
    try {
      details = parseArguments();
      if (details) {
        console.log('\n📋 Using command-line arguments\n');
        console.log(`   Username: ${details.username}`);
        console.log(`   Email: ${details.email}`);
        console.log(`   Name: ${details.firstName} ${details.lastName}\n`);
      }
    } catch (error) {
      console.error(`\n❌ ${error.message}`);
      console.log('\nUsage: node scripts/create-super-admin.js <username> <email> <password> <firstName> <lastName>');
      console.log('   or run without arguments for interactive mode\n');
      rl.close();
      process.exit(1);
    }

    // Fall back to interactive mode
    if (!details) {
      details = await interactiveMode();

      if (!details) {
        rl.close();
        process.exit(0);
      }
    }

    // Create super admin
    console.log('\n🔄 Creating super admin...');

    const superAdmin = await createSuperAdmin(
      details.username,
      details.email,
      details.password,
      details.firstName,
      details.lastName
    );

    console.log('\n✅ Super admin created successfully!\n');
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║                                                           ║');
    console.log('║   🎉 Super Admin Account Created                         ║');
    console.log('║                                                           ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    console.log('📌 Account Details:');
    console.log(`   ID: ${superAdmin._id}`);
    console.log(`   Username: ${superAdmin.username}`);
    console.log(`   Email: ${superAdmin.email}`);
    console.log(`   Name: ${superAdmin.firstName} ${superAdmin.lastName}`);
    console.log(`   Status: ${superAdmin.isActive ? 'Active' : 'Inactive'}\n`);

    console.log('🔐 Login Information:');
    console.log(`   Endpoint: POST http://localhost:${process.env.PORT || 5000}/api/super-admin/auth/login`);
    console.log(`   Username: ${superAdmin.username}`);
    console.log(`   Password: [Your password]\n`);

    console.log('📊 Super Admin Capabilities:');
    console.log('   ✓ Create and manage restaurants');
    console.log('   ✓ Create restaurant admins');
    console.log('   ✓ View global platform analytics');
    console.log('   ✓ Manage subscription plans');
    console.log('   ✓ Handle support tickets');
    console.log('   ✓ View audit logs');
    console.log('   ✓ Manage restaurant subscriptions');
    console.log('   ✓ Toggle restaurant active status\n');

    console.log('🚀 Next Steps:');
    console.log('   1. Start the server: npm run dev');
    console.log('   2. Login to super admin dashboard');
    console.log('   3. Create restaurants via POST /api/super-admin/restaurants');
    console.log('   4. Create admins for restaurants\n');

    rl.close();
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    rl.close();
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\n👋 Cancelled by user');
  rl.close();
  mongoose.connection.close();
  process.exit(0);
});

// Run script
main();
