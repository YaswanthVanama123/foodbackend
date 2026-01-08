import mongoose from 'mongoose';
import dotenv from 'dotenv';
import readline from 'readline';
import SuperAdmin from '../models/SuperAdmin';

// Load environment variables
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/patlinks';

/**
 * Create Super Admin Script
 *
 * This script creates the first super admin user for platform management.
 * Super admins can:
 * - Create and manage restaurants
 * - Create admins for restaurants
 * - View global analytics
 * - Manage subscriptions
 */

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
}

async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to MongoDB');
  } catch (error) {
    console.error('✗ MongoDB connection failed:', error);
    process.exit(1);
  }
}

async function checkExistingSuperAdmin(): Promise<boolean> {
  const count = await SuperAdmin.countDocuments();
  return count > 0;
}

async function createSuperAdmin(
  username: string,
  email: string,
  password: string,
  firstName: string,
  lastName: string
) {
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

    // Create super admin
    const superAdmin = await SuperAdmin.create({
      username,
      email,
      password, // Will be hashed by pre-save hook
      firstName,
      lastName,
      role: 'super_admin',
      permissions: [
        'manage:restaurants',
        'manage:admins',
        'view:analytics',
        'manage:subscriptions',
        'system:admin',
      ],
      isActive: true,
    });

    return superAdmin;
  } catch (error: any) {
    throw new Error(`Failed to create super admin: ${error.message}`);
  }
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║                                                           ║');
  console.log('║   👤 Create Super Admin                                  ║');
  console.log('║   Patlinks Food Ordering System                           ║');
  console.log('║                                                           ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  try {
    // Connect to database
    await connectDB();

    // Check for existing super admins
    const hasSuperAdmin = await checkExistingSuperAdmin();

    if (hasSuperAdmin) {
      console.log('⚠️  Super admin(s) already exist in the database.');
      const proceed = await question('\nDo you want to create another super admin? (yes/no): ');

      if (proceed.toLowerCase() !== 'yes' && proceed.toLowerCase() !== 'y') {
        console.log('\n👋 Cancelled by user');
        rl.close();
        process.exit(0);
      }
    }

    console.log('\n📝 Enter super admin details:\n');

    // Get super admin details from user
    const username = await question('Username: ');
    if (!username || username.length < 3) {
      throw new Error('Username must be at least 3 characters long');
    }

    const email = await question('Email: ');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Invalid email format');
    }

    const password = await question('Password (min 8 characters): ');
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    const confirmPassword = await question('Confirm Password: ');
    if (password !== confirmPassword) {
      throw new Error('Passwords do not match');
    }

    const firstName = await question('First Name: ');
    const lastName = await question('Last Name: ');

    console.log('\n📋 Review details:\n');
    console.log(`   Username: ${username}`);
    console.log(`   Email: ${email}`);
    console.log(`   Name: ${firstName} ${lastName}`);
    console.log(`   Role: Super Admin`);
    console.log(`   Permissions: Full platform access\n`);

    const confirm = await question('Create super admin with these details? (yes/no): ');

    if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
      console.log('\n👋 Cancelled by user');
      rl.close();
      process.exit(0);
    }

    // Create super admin
    console.log('\n🔄 Creating super admin...');

    const superAdmin = await createSuperAdmin(
      username,
      email,
      password,
      firstName,
      lastName
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
    console.log(`   Endpoint: POST http://localhost:5000/api/super-admin/auth/login`);
    console.log(`   Username: ${superAdmin.username}`);
    console.log(`   Password: [Your password]\n`);

    console.log('📊 Super Admin Capabilities:');
    console.log('   ✓ Create and manage restaurants');
    console.log('   ✓ Create restaurant admins');
    console.log('   ✓ View global platform analytics');
    console.log('   ✓ Manage restaurant subscriptions');
    console.log('   ✓ Toggle restaurant active status');
    console.log('   ✓ Delete restaurants (with cascade)\n');

    console.log('🚀 Next Steps:');
    console.log('   1. Login to super admin dashboard');
    console.log('   2. Create restaurants via POST /api/super-admin/restaurants');
    console.log('   3. Create admins for restaurants');
    console.log('   4. Configure restaurant branding and settings\n');

    rl.close();
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    rl.close();
    process.exit(1);
  }
}

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\n👋 Cancelled by user');
  rl.close();
  process.exit(0);
});

// Run script
main();
