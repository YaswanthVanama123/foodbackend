import dotenv from 'dotenv';
import mongoose from 'mongoose';
import SuperAdmin from '../modules/common/models/SuperAdmin';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://foodadmin:Yaswanth123@cluster0.0wuz8fl.mongodb.net/?appName=Cluster0';

/**
 * Create Super Admin Script
 *
 * Creates a super admin user with predefined credentials:
 * - Username: superadmin
 * - Password: superadmin123
 * - Email: superadmin@patlinks.com
 *
 * Super admins can:
 * - Create and manage restaurants
 * - Create admins for restaurants
 * - View global analytics
 * - Manage subscriptions
 */

async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    throw error;
  }
}

async function createSuperAdmin() {
  try {
    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║                                                           ║');
    console.log('║   👤 Creating Super Admin                                ║');
    console.log('║   Patlinks Food Ordering System                           ║');
    console.log('║                                                           ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    await connectDB();

    // Check if super admin already exists
    console.log('🔍 Checking for existing super admin...');
    const existingAdmin = await SuperAdmin.findOne({ username: 'superadmin' });

    if (existingAdmin) {
      console.log('⚠️  Super admin with username "superadmin" already exists!');
      console.log('   Deleting existing super admin...');
      await SuperAdmin.deleteOne({ username: 'superadmin' });
      console.log('   ✓ Existing super admin deleted\n');
    } else {
      console.log('   ✓ No existing super admin found\n');
    }

    // Create super admin
    console.log('🔨 Creating new super admin...');

    const superAdminData = {
      username: 'superadmin',
      email: 'superadmin@patlinks.com',
      password: 'superadmin123', // Will be hashed by pre-save hook
      firstName: 'Super',
      lastName: 'Admin',
      role: 'super_admin',
      permissions: [
        'restaurant:create',
        'restaurant:read',
        'restaurant:update',
        'restaurant:delete',
        'restaurant:view_all',
        'restaurant:toggle_status',
        'admin:create',
        'admin:read',
        'admin:update',
        'admin:delete',
        'analytics:global',
        'analytics:restaurant',
        'billing:manage',
        'system:configure',
      ],
      isActive: true,
    };

    const superAdmin = await SuperAdmin.create(superAdminData);

    console.log('   ✓ Super admin created successfully!\n');

    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║                                                           ║');
    console.log('║   ✅ Super Admin Account Created                         ║');
    console.log('║                                                           ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    console.log('📌 Account Details:');
    console.log(`   ID: ${superAdmin._id}`);
    console.log(`   Username: ${superAdmin.username}`);
    console.log(`   Email: ${superAdmin.email}`);
    console.log(`   Name: ${superAdmin.firstName} ${superAdmin.lastName}`);
    console.log(`   Role: ${superAdmin.role}`);
    console.log(`   Status: ${superAdmin.isActive ? '✅ Active' : '❌ Inactive'}`);
    console.log(`   Permissions: ${superAdmin.permissions.length} permissions\n`);

    console.log('🔐 Login Credentials:');
    console.log('   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   Username: superadmin');
    console.log('   Password: superadmin123');
    console.log('   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('🌐 API Endpoints:');
    console.log('   Login:  POST /api/super-admin/auth/login');
    console.log('   Profile: GET /api/super-admin/profile\n');

    console.log('🎯 Super Admin Capabilities:');
    console.log('   ✓ Create and manage restaurants');
    console.log('   ✓ Create restaurant admins');
    console.log('   ✓ View global platform analytics');
    console.log('   ✓ Manage restaurant subscriptions');
    console.log('   ✓ Toggle restaurant active/inactive status');
    console.log('   ✓ Delete restaurants (with cascade)');
    console.log('   ✓ Configure system settings\n');

    await mongoose.connection.close();
    console.log('🔌 Database connection closed\n');
  } catch (error) {
    console.error('\n❌ Error creating super admin:', error);
    throw error;
  }
}

// Export for use in other scripts
export default createSuperAdmin;

// Run if executed directly
if (require.main === module) {
  createSuperAdmin()
    .then(() => {
      console.log('✨ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Script failed:', error);
      process.exit(1);
    });
}
