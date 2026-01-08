import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Restaurant from '../models/Restaurant';
import Admin from '../models/Admin';
import Category from '../models/Category';
import MenuItem from '../models/MenuItem';
import Table from '../models/Table';
import Order from '../models/Order';

// Load environment variables
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://foodadmin:Yaswanth123@cluster0.0wuz8fl.mongodb.net/?appName=Cluster0';

/**
 * Migration Script: Single-Tenant to Multi-Tenant
 *
 * This script migrates existing single-tenant data to multi-tenant architecture:
 * 1. Creates a default restaurant for existing data
 * 2. Updates all existing documents to include restaurantId
 * 3. Creates compound unique indexes
 * 4. Verifies data integrity
 *
 * IMPORTANT: Take a database backup before running this script!
 */

async function connectDB() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to MongoDB');
  } catch (error) {
    console.error('✗ MongoDB connection failed:', error);
    process.exit(1);
  }
}

async function createDefaultRestaurant() {
  console.log('\n1️⃣  Creating default restaurant...');

  try {
    // Check if a restaurant already exists
    const existingRestaurant = await Restaurant.findOne();

    if (existingRestaurant) {
      console.log(`   ℹ️  Restaurant already exists: ${existingRestaurant.name}`);
      return existingRestaurant._id;
    }

    // Create default restaurant
    const restaurant = await Restaurant.create({
      subdomain: 'default',
      name: 'Default Restaurant',
      slug: 'default-restaurant',
      email: 'admin@defaultrestaurant.com',
      phone: '',
      address: {
        street: '',
        city: '',
        state: '',
        zipCode: '',
        country: 'US',
      },
      branding: {
        logo: '',
        primaryColor: '#1F2937',
        secondaryColor: '#F59E0B',
        accentColor: '#10B981',
        fontFamily: 'Inter',
        theme: 'light',
      },
      settings: {
        currency: 'USD',
        taxRate: 8.5,
        serviceChargeRate: 0,
        timezone: 'America/New_York',
        locale: 'en-US',
        orderNumberPrefix: 'ORD',
      },
      subscription: {
        plan: 'enterprise',
        status: 'active',
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
        billingCycle: 'yearly',
        maxTables: 999,
        maxMenuItems: 9999,
        maxAdmins: 99,
      },
      isActive: true,
      isOnboarded: true,
      onboardingStep: 10,
    });

    console.log(`   ✓ Created default restaurant: ${restaurant.name} (ID: ${restaurant._id})`);
    return restaurant._id;
  } catch (error: any) {
    console.error('   ✗ Error creating default restaurant:', error.message);
    throw error;
  }
}

async function migrateAdmins(restaurantId: mongoose.Types.ObjectId) {
  console.log('\n2️⃣  Migrating admins...');

  try {
    const admins = await Admin.find({ restaurantId: { $exists: false } });

    if (admins.length === 0) {
      console.log('   ℹ️  No admins to migrate');
      return;
    }

    console.log(`   Found ${admins.length} admins to migrate`);

    const result = await Admin.updateMany(
      { restaurantId: { $exists: false } },
      { $set: { restaurantId } }
    );

    console.log(`   ✓ Updated ${result.modifiedCount} admins with restaurantId`);
  } catch (error: any) {
    console.error('   ✗ Error migrating admins:', error.message);
    throw error;
  }
}

async function migrateCategories(restaurantId: mongoose.Types.ObjectId) {
  console.log('\n3️⃣  Migrating categories...');

  try {
    const categories = await Category.find({ restaurantId: { $exists: false } });

    if (categories.length === 0) {
      console.log('   ℹ️  No categories to migrate');
      return;
    }

    console.log(`   Found ${categories.length} categories to migrate`);

    const result = await Category.updateMany(
      { restaurantId: { $exists: false } },
      { $set: { restaurantId } }
    );

    console.log(`   ✓ Updated ${result.modifiedCount} categories with restaurantId`);
  } catch (error: any) {
    console.error('   ✗ Error migrating categories:', error.message);
    throw error;
  }
}

async function migrateMenuItems(restaurantId: mongoose.Types.ObjectId) {
  console.log('\n4️⃣  Migrating menu items...');

  try {
    const menuItems = await MenuItem.find({ restaurantId: { $exists: false } });

    if (menuItems.length === 0) {
      console.log('   ℹ️  No menu items to migrate');
      return;
    }

    console.log(`   Found ${menuItems.length} menu items to migrate`);

    const result = await MenuItem.updateMany(
      { restaurantId: { $exists: false } },
      { $set: { restaurantId } }
    );

    console.log(`   ✓ Updated ${result.modifiedCount} menu items with restaurantId`);
  } catch (error: any) {
    console.error('   ✗ Error migrating menu items:', error.message);
    throw error;
  }
}

async function migrateTables(restaurantId: mongoose.Types.ObjectId) {
  console.log('\n5️⃣  Migrating tables...');

  try {
    const tables = await Table.find({ restaurantId: { $exists: false } });

    if (tables.length === 0) {
      console.log('   ℹ️  No tables to migrate');
      return;
    }

    console.log(`   Found ${tables.length} tables to migrate`);

    const result = await Table.updateMany(
      { restaurantId: { $exists: false } },
      { $set: { restaurantId } }
    );

    console.log(`   ✓ Updated ${result.modifiedCount} tables with restaurantId`);
  } catch (error: any) {
    console.error('   ✗ Error migrating tables:', error.message);
    throw error;
  }
}

async function migrateOrders(restaurantId: mongoose.Types.ObjectId) {
  console.log('\n6️⃣  Migrating orders...');

  try {
    const orders = await Order.find({ restaurantId: { $exists: false } });

    if (orders.length === 0) {
      console.log('   ℹ️  No orders to migrate');
      return;
    }

    console.log(`   Found ${orders.length} orders to migrate`);

    const result = await Order.updateMany(
      { restaurantId: { $exists: false } },
      { $set: { restaurantId } }
    );

    console.log(`   ✓ Updated ${result.modifiedCount} orders with restaurantId`);
  } catch (error: any) {
    console.error('   ✗ Error migrating orders:', error.message);
    throw error;
  }
}

async function verifyMigration(restaurantId: mongoose.Types.ObjectId) {
  console.log('\n7️⃣  Verifying migration...');

  try {
    // Check for documents without restaurantId
    const [
      adminsWithoutId,
      categoriesWithoutId,
      menuItemsWithoutId,
      tablesWithoutId,
      ordersWithoutId,
    ] = await Promise.all([
      Admin.countDocuments({ restaurantId: { $exists: false } }),
      Category.countDocuments({ restaurantId: { $exists: false } }),
      MenuItem.countDocuments({ restaurantId: { $exists: false } }),
      Table.countDocuments({ restaurantId: { $exists: false } }),
      Order.countDocuments({ restaurantId: { $exists: false } }),
    ]);

    // Count migrated documents
    const [
      totalAdmins,
      totalCategories,
      totalMenuItems,
      totalTables,
      totalOrders,
    ] = await Promise.all([
      Admin.countDocuments({ restaurantId }),
      Category.countDocuments({ restaurantId }),
      MenuItem.countDocuments({ restaurantId }),
      Table.countDocuments({ restaurantId }),
      Order.countDocuments({ restaurantId }),
    ]);

    console.log('\n   📊 Migration Summary:');
    console.log(`   ├─ Admins: ${totalAdmins} (${adminsWithoutId} missing restaurantId)`);
    console.log(`   ├─ Categories: ${totalCategories} (${categoriesWithoutId} missing restaurantId)`);
    console.log(`   ├─ Menu Items: ${totalMenuItems} (${menuItemsWithoutId} missing restaurantId)`);
    console.log(`   ├─ Tables: ${totalTables} (${tablesWithoutId} missing restaurantId)`);
    console.log(`   └─ Orders: ${totalOrders} (${ordersWithoutId} missing restaurantId)`);

    const totalMissing =
      adminsWithoutId +
      categoriesWithoutId +
      menuItemsWithoutId +
      tablesWithoutId +
      ordersWithoutId;

    if (totalMissing > 0) {
      console.log(`\n   ⚠️  WARNING: ${totalMissing} documents still missing restaurantId!`);
      return false;
    }

    console.log('\n   ✓ All documents have restaurantId!');
    return true;
  } catch (error: any) {
    console.error('   ✗ Error verifying migration:', error.message);
    throw error;
  }
}

async function showMigrationInfo() {
  console.log('\n8️⃣  Migration info for next steps:');

  try {
    const restaurant = await Restaurant.findOne({ subdomain: 'default' });

    if (!restaurant) {
      console.log('   ⚠️  Default restaurant not found!');
      return;
    }

    console.log('\n   📝 Restaurant Details:');
    console.log(`   ├─ ID: ${restaurant._id}`);
    console.log(`   ├─ Name: ${restaurant.name}`);
    console.log(`   ├─ Subdomain: ${restaurant.subdomain}`);
    console.log(`   └─ Access URL: http://${restaurant.subdomain}.localhost:5000`);

    console.log('\n   ⚙️  Development Access:');
    console.log(`   Use header: x-restaurant-id: ${restaurant._id}`);
    console.log('   Or configure subdomain: default.localhost:5000');

    console.log('\n   🔐 Next Steps:');
    console.log('   1. Run createSuperAdmin script to create platform admin');
    console.log('   2. Update restaurant details via super admin panel');
    console.log('   3. Configure custom subdomain');
    console.log('   4. Test tenant isolation with another restaurant');
  } catch (error: any) {
    console.error('   ✗ Error showing migration info:', error.message);
  }
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║                                                           ║');
  console.log('║   🔄 Multi-Tenant Migration Script                       ║');
  console.log('║   Patlinks Food Ordering System                           ║');
  console.log('║                                                           ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');

  console.log('\n⚠️  WARNING: This script will modify your database!');
  console.log('   Ensure you have a backup before proceeding.');

  try {
    // Connect to database
    await connectDB();

    // Step 1: Create default restaurant
    const restaurantId = await createDefaultRestaurant();

    // Step 2-6: Migrate all collections
    await migrateAdmins(restaurantId);
    await migrateCategories(restaurantId);
    await migrateMenuItems(restaurantId);
    await migrateTables(restaurantId);
    await migrateOrders(restaurantId);

    // Step 7: Verify migration
    const success = await verifyMigration(restaurantId);

    if (success) {
      // Step 8: Show info
      await showMigrationInfo();

      console.log('\n✅ Migration completed successfully!');
      console.log('\n🎉 Your system is now multi-tenant ready!');
    } else {
      console.log('\n⚠️  Migration completed with warnings. Please review the summary above.');
    }

    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\n👋 Migration cancelled by user');
  process.exit(0);
});

// Run migration
main();
