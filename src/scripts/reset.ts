import dotenv from 'dotenv';
import mongoose from 'mongoose';
import SuperAdmin from '../modules/common/models/SuperAdmin';
import Restaurant from '../modules/common/models/Restaurant';
import Admin from '../modules/common/models/Admin';
import Category from '../modules/common/models/Category';
import MenuItem from '../modules/common/models/MenuItem';
import Table from '../modules/common/models/Table';
import Customer from '../modules/common/models/Customer';
import Order from '../modules/common/models/Order';
import Plan from '../modules/common/models/Plan';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://foodadmin:Yaswanth123@cluster0.0wuz8fl.mongodb.net/?appName=Cluster0';

/**
 * Database Reset Script
 *
 * Clears all data from the database by dropping all collections.
 * This is useful for:
 * - Development/testing cleanup
 * - Preparing for fresh seed
 * - Resetting to clean state
 *
 * WARNING: This will delete ALL data from the database!
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

async function reset() {
  try {
    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║                                                           ║');
    console.log('║   🗑️  Database Reset Script                              ║');
    console.log('║   Patlinks Food Ordering System                           ║');
    console.log('║                                                           ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    console.log('⚠️  WARNING: This will delete ALL data from the database!');
    console.log('⚠️  Database:', MONGODB_URI);
    console.log('\n⏱️  Starting reset at:', new Date().toLocaleString());
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    await connectDB();

    const startTime = Date.now();

    // Count existing data
    console.log('📊 Checking existing data...\n');

    const counts = {
      plans: await Plan.countDocuments(),
      superAdmins: await SuperAdmin.countDocuments(),
      restaurants: await Restaurant.countDocuments(),
      admins: await Admin.countDocuments(),
      categories: await Category.countDocuments(),
      menuItems: await MenuItem.countDocuments(),
      tables: await Table.countDocuments(),
      customers: await Customer.countDocuments(),
      orders: await Order.countDocuments(),
    };

    console.log('   Current data in database:');
    console.log(`   - Plans: ${counts.plans}`);
    console.log(`   - Super Admins: ${counts.superAdmins}`);
    console.log(`   - Restaurants: ${counts.restaurants}`);
    console.log(`   - Admins: ${counts.admins}`);
    console.log(`   - Categories: ${counts.categories}`);
    console.log(`   - Menu Items: ${counts.menuItems}`);
    console.log(`   - Tables: ${counts.tables}`);
    console.log(`   - Customers: ${counts.customers}`);
    console.log(`   - Orders: ${counts.orders}\n`);

    const totalRecords = Object.values(counts).reduce((a, b) => a + b, 0);

    if (totalRecords === 0) {
      console.log('ℹ️  Database is already empty. Nothing to reset.\n');
      await mongoose.connection.close();
      console.log('🔌 Database connection closed\n');
      return;
    }

    console.log(`📝 Total records to delete: ${totalRecords}\n`);

    // Delete all collections
    console.log('🗑️  Deleting all collections...\n');

    const deleteResults = {
      orders: await Order.deleteMany({}),
      customers: await Customer.deleteMany({}),
      tables: await Table.deleteMany({}),
      menuItems: await MenuItem.deleteMany({}),
      categories: await Category.deleteMany({}),
      admins: await Admin.deleteMany({}),
      restaurants: await Restaurant.deleteMany({}),
      superAdmins: await SuperAdmin.deleteMany({}),
      plans: await Plan.deleteMany({}),
    };

    console.log('   Deletion results:');
    console.log(`   ✓ Orders: ${deleteResults.orders.deletedCount} deleted`);
    console.log(`   ✓ Customers: ${deleteResults.customers.deletedCount} deleted`);
    console.log(`   ✓ Tables: ${deleteResults.tables.deletedCount} deleted`);
    console.log(`   ✓ Menu Items: ${deleteResults.menuItems.deletedCount} deleted`);
    console.log(`   ✓ Categories: ${deleteResults.categories.deletedCount} deleted`);
    console.log(`   ✓ Admins: ${deleteResults.admins.deletedCount} deleted`);
    console.log(`   ✓ Restaurants: ${deleteResults.restaurants.deletedCount} deleted`);
    console.log(`   ✓ Super Admins: ${deleteResults.superAdmins.deletedCount} deleted`);
    console.log(`   ✓ Plans: ${deleteResults.plans.deletedCount} deleted\n`);

    // Verify deletion
    const verifyCount = await Promise.all([
      Plan.countDocuments(),
      SuperAdmin.countDocuments(),
      Restaurant.countDocuments(),
      Admin.countDocuments(),
      Category.countDocuments(),
      MenuItem.countDocuments(),
      Table.countDocuments(),
      Customer.countDocuments(),
      Order.countDocuments(),
    ]);

    const remaining = verifyCount.reduce((a, b) => a + b, 0);

    if (remaining > 0) {
      console.log(`⚠️  Warning: ${remaining} records still remain in database\n`);
    } else {
      console.log('✅ Verification: All collections are empty\n');
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║                                                           ║');
    console.log('║   ✅ Database Reset Completed!                           ║');
    console.log('║                                                           ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    console.log('⏱️  Completed at:', new Date().toLocaleString());
    console.log(`⚡ Duration: ${duration} seconds`);
    console.log(`🗑️  Total records deleted: ${totalRecords}\n`);

    console.log('🔄 Next Steps:');
    console.log('   - Run seed script: ts-node src/scripts/seed.ts');
    console.log('   - Or seed individually:');
    console.log('     • ts-node src/scripts/seedPlans.ts');
    console.log('     • ts-node src/scripts/createSuperAdmin.ts');
    console.log('     • ts-node src/scripts/seedMultiTenant.ts\n');

    await mongoose.connection.close();
    console.log('🔌 Database connection closed\n');

  } catch (error: any) {
    console.error('\n╔═══════════════════════════════════════════════════════════╗');
    console.error('║                                                           ║');
    console.error('║   ❌ DATABASE RESET FAILED!                              ║');
    console.error('║                                                           ║');
    console.error('╚═══════════════════════════════════════════════════════════╝\n');

    console.error('💥 Error Details:');
    console.error('   Message:', error.message);
    if (error.stack) {
      console.error('   Stack:', error.stack);
    }

    console.error('\n💡 Troubleshooting:');
    console.error('   1. Ensure MongoDB is running');
    console.error('   2. Check MONGODB_URI in .env file');
    console.error('   3. Verify database permissions');
    console.error('   4. Check MongoDB server logs\n');

    throw error;
  }
}

// Export for use in other scripts
export default reset;

// Run if executed directly
if (require.main === module) {
  reset()
    .then(() => {
      console.log('✨ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Script failed:', error);
      process.exit(1);
    });
}
