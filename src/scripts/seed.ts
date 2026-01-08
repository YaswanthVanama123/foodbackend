import dotenv from 'dotenv';
import seedPlans from './seedPlans';
import createSuperAdmin from './createSuperAdmin';
import seedMultiTenant from './seedMultiTenant';

dotenv.config();

/**
 * Master Seed Script
 *
 * Runs all seeding scripts in the correct order:
 * 1. seedPlans - Creates subscription plans
 * 2. createSuperAdmin - Creates super admin user
 * 3. seedMultiTenant - Creates restaurants, admins, and test data
 *
 * Usage: ts-node src/scripts/seed.ts
 */

async function seed() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║                                                           ║');
  console.log('║   🚀 Master Seed Script                                  ║');
  console.log('║   Patlinks Food Ordering System                           ║');
  console.log('║   Complete Database Initialization                        ║');
  console.log('║                                                           ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  console.log('⏱️  Started at:', new Date().toLocaleString());
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const startTime = Date.now();

  try {
    // Step 1: Seed Plans
    console.log('📍 STEP 1/3: Seeding Subscription Plans');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    await seedPlans();
    console.log('✅ Step 1 completed\n');

    // Step 2: Create Super Admin
    console.log('📍 STEP 2/3: Creating Super Admin');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    await createSuperAdmin();
    console.log('✅ Step 2 completed\n');

    // Step 3: Seed Multi-Tenant Data
    console.log('📍 STEP 3/3: Seeding Multi-Tenant Restaurant Data');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    await seedMultiTenant();
    console.log('✅ Step 3 completed\n');

    // Calculate duration
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // Success summary
    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║                                                           ║');
    console.log('║   🎉 DATABASE SEEDED SUCCESSFULLY!                       ║');
    console.log('║                                                           ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    console.log('⏱️  Completed at:', new Date().toLocaleString());
    console.log(`⚡ Total duration: ${duration} seconds\n`);

    console.log('📋 What was created:');
    console.log('   ✓ 3 Subscription Plans (Basic, Pro, Enterprise)');
    console.log('   ✓ 1 Super Admin account');
    console.log('   ✓ 3 Restaurants (Pizza Palace, Burger Barn, Sushi Spot)');
    console.log('   ✓ 3 Restaurant Admin accounts');
    console.log('   ✓ 18 Categories (6 per restaurant)');
    console.log('   ✓ 51 Menu Items (17 per restaurant)');
    console.log('   ✓ 30 Tables (10 per restaurant)');
    console.log('   ✓ 15 Customers (5 per restaurant)');
    console.log('   ✓ 37 Orders with various statuses\n');

    console.log('🔐 Quick Access Credentials:\n');

    console.log('   Super Admin:');
    console.log('   - Username: superadmin');
    console.log('   - Password: superadmin123');
    console.log('   - Email: superadmin@patlinks.com\n');

    console.log('   Restaurant Admins:');
    console.log('   - Pizza Palace: admin1 / admin123');
    console.log('   - Burger Barn: admin2 / admin123');
    console.log('   - Sushi Spot: admin3 / admin123\n');

    console.log('🌐 Next Steps:');
    console.log('   1. Start your backend server: npm run dev');
    console.log('   2. Login to Super Admin dashboard');
    console.log('   3. Explore the restaurant admin interfaces');
    console.log('   4. Test the customer ordering flow\n');

    console.log('📚 Useful Commands:');
    console.log('   - Reset database: ts-node src/scripts/reset.ts');
    console.log('   - Re-run seed: ts-node src/scripts/seed.ts');
    console.log('   - Seed plans only: ts-node src/scripts/seedPlans.ts');
    console.log('   - Create super admin: ts-node src/scripts/createSuperAdmin.ts');
    console.log('   - Seed restaurants: ts-node src/scripts/seedMultiTenant.ts\n');

  } catch (error: any) {
    console.error('\n╔═══════════════════════════════════════════════════════════╗');
    console.error('║                                                           ║');
    console.error('║   ❌ DATABASE SEEDING FAILED!                            ║');
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
    console.error('   4. Try running: ts-node src/scripts/reset.ts first\n');

    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  seed()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export default seed;
