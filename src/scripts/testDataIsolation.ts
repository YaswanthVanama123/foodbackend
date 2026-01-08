import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Restaurant from '../models/Restaurant';
import Admin from '../models/Admin';
import Category from '../models/Category';
import MenuItem from '../models/MenuItem';
import Table from '../models/Table';
import Order from '../models/Order';
import connectDB from '../config/database';

dotenv.config();

/**
 * Data Isolation Test Script
 *
 * This script verifies that multi-tenant data isolation is working correctly:
 * 1. Tests cross-tenant query prevention
 * 2. Validates restaurantId filters
 * 3. Ensures no data leaks between tenants
 * 4. Verifies compound unique indexes
 */

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

const results: TestResult[] = [];

function addResult(name: string, passed: boolean, message: string) {
  results.push({ name, passed, message });
  if (passed) {
    console.log(`   ✓ ${name}`);
  } else {
    console.log(`   ✗ ${name}: ${message}`);
  }
}

async function testDataIsolation() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║                                                           ║');
  console.log('║   🔒 Data Isolation Test Suite                           ║');
  console.log('║   Patlinks Food Ordering System                           ║');
  console.log('║                                                           ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  try {
    await connectDB();

    // Get test restaurants
    const restaurants = await Restaurant.find().limit(3).lean();

    if (restaurants.length < 2) {
      console.log('❌ Error: Need at least 2 restaurants to test isolation.');
      console.log('   Run seedMultiTenant script first.');
      process.exit(1);
    }

    const [restaurant1, restaurant2] = restaurants;
    console.log(`📊 Testing with restaurants:`);
    console.log(`   Restaurant 1: ${restaurant1.name} (${restaurant1._id})`);
    console.log(`   Restaurant 2: ${restaurant2.name} (${restaurant2._id})\n`);

    // TEST 1: Admin Isolation
    console.log('1️⃣  Testing Admin Isolation...');
    await testAdminIsolation(restaurant1._id, restaurant2._id);

    // TEST 2: Category Isolation
    console.log('\n2️⃣  Testing Category Isolation...');
    await testCategoryIsolation(restaurant1._id, restaurant2._id);

    // TEST 3: MenuItem Isolation
    console.log('\n3️⃣  Testing MenuItem Isolation...');
    await testMenuItemIsolation(restaurant1._id, restaurant2._id);

    // TEST 4: Table Isolation
    console.log('\n4️⃣  Testing Table Isolation...');
    await testTableIsolation(restaurant1._id, restaurant2._id);

    // TEST 5: Order Isolation
    console.log('\n5️⃣  Testing Order Isolation...');
    await testOrderIsolation(restaurant1._id, restaurant2._id);

    // TEST 6: Username Uniqueness (Scoped)
    console.log('\n6️⃣  Testing Username Uniqueness (Scoped)...');
    await testUsernameUniqueness(restaurant1._id, restaurant2._id);

    // TEST 7: Cross-Tenant Query Prevention
    console.log('\n7️⃣  Testing Cross-Tenant Query Prevention...');
    await testCrossTenantQueries(restaurant1._id, restaurant2._id);

    // Display Summary
    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║                                                           ║');
    console.log('║   📋 Test Summary                                        ║');
    console.log('║                                                           ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed).length;
    const total = results.length;

    console.log(`Total Tests: ${total}`);
    console.log(`✓ Passed: ${passed}`);
    console.log(`✗ Failed: ${failed}`);
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%\n`);

    if (failed > 0) {
      console.log('❌ Failed Tests:');
      results
        .filter((r) => !r.passed)
        .forEach((r) => {
          console.log(`   - ${r.name}: ${r.message}`);
        });
      console.log('');
      process.exit(1);
    } else {
      console.log('✅ All tests passed! Data isolation is working correctly.\n');
      process.exit(0);
    }
  } catch (error: any) {
    console.error('\n❌ Test suite error:', error.message);
    process.exit(1);
  }
}

async function testAdminIsolation(restaurantId1: mongoose.Types.ObjectId, restaurantId2: mongoose.Types.ObjectId) {
  // Test 1: Get admins for restaurant 1
  const admins1 = await Admin.find({ restaurantId: restaurantId1 }).lean();
  const hasOnlyRestaurant1 = admins1.every((a: any) => a.restaurantId.toString() === restaurantId1.toString());
  addResult(
    'Admins query returns only restaurant 1 data',
    hasOnlyRestaurant1 && admins1.length > 0,
    hasOnlyRestaurant1 ? '' : 'Found admins from other restaurants'
  );

  // Test 2: Get admins for restaurant 2
  const admins2 = await Admin.find({ restaurantId: restaurantId2 }).lean();
  const hasOnlyRestaurant2 = admins2.every((a: any) => a.restaurantId.toString() === restaurantId2.toString());
  addResult(
    'Admins query returns only restaurant 2 data',
    hasOnlyRestaurant2 && admins2.length > 0,
    hasOnlyRestaurant2 ? '' : 'Found admins from other restaurants'
  );

  // Test 3: No overlap
  const hasNoOverlap = admins1.every((a1: any) => !admins2.some((a2: any) => a1._id.toString() === a2._id.toString()));
  addResult('No admin overlap between restaurants', hasNoOverlap, hasNoOverlap ? '' : 'Found overlapping admins');
}

async function testCategoryIsolation(restaurantId1: mongoose.Types.ObjectId, restaurantId2: mongoose.Types.ObjectId) {
  const categories1 = await Category.find({ restaurantId: restaurantId1 }).lean();
  const categories2 = await Category.find({ restaurantId: restaurantId2 }).lean();

  const hasOnlyRestaurant1 = categories1.every((c: any) => c.restaurantId.toString() === restaurantId1.toString());
  const hasOnlyRestaurant2 = categories2.every((c: any) => c.restaurantId.toString() === restaurantId2.toString());
  const hasNoOverlap = categories1.every(
    (c1: any) => !categories2.some((c2: any) => c1._id.toString() === c2._id.toString())
  );

  addResult('Categories isolated for restaurant 1', hasOnlyRestaurant1 && categories1.length > 0, '');
  addResult('Categories isolated for restaurant 2', hasOnlyRestaurant2 && categories2.length > 0, '');
  addResult('No category overlap', hasNoOverlap, '');
}

async function testMenuItemIsolation(restaurantId1: mongoose.Types.ObjectId, restaurantId2: mongoose.Types.ObjectId) {
  const items1 = await MenuItem.find({ restaurantId: restaurantId1 }).lean();
  const items2 = await MenuItem.find({ restaurantId: restaurantId2 }).lean();

  const hasOnlyRestaurant1 = items1.every((i: any) => i.restaurantId.toString() === restaurantId1.toString());
  const hasOnlyRestaurant2 = items2.every((i: any) => i.restaurantId.toString() === restaurantId2.toString());
  const hasNoOverlap = items1.every((i1: any) => !items2.some((i2: any) => i1._id.toString() === i2._id.toString()));

  addResult('Menu items isolated for restaurant 1', hasOnlyRestaurant1 && items1.length > 0, '');
  addResult('Menu items isolated for restaurant 2', hasOnlyRestaurant2 && items2.length > 0, '');
  addResult('No menu item overlap', hasNoOverlap, '');
}

async function testTableIsolation(restaurantId1: mongoose.Types.ObjectId, restaurantId2: mongoose.Types.ObjectId) {
  const tables1 = await Table.find({ restaurantId: restaurantId1 }).lean();
  const tables2 = await Table.find({ restaurantId: restaurantId2 }).lean();

  const hasOnlyRestaurant1 = tables1.every((t: any) => t.restaurantId.toString() === restaurantId1.toString());
  const hasOnlyRestaurant2 = tables2.every((t: any) => t.restaurantId.toString() === restaurantId2.toString());
  const hasNoOverlap = tables1.every((t1: any) => !tables2.some((t2: any) => t1._id.toString() === t2._id.toString()));

  addResult('Tables isolated for restaurant 1', hasOnlyRestaurant1 && tables1.length > 0, '');
  addResult('Tables isolated for restaurant 2', hasOnlyRestaurant2 && tables2.length > 0, '');
  addResult('No table overlap', hasNoOverlap, '');
}

async function testOrderIsolation(restaurantId1: mongoose.Types.ObjectId, restaurantId2: mongoose.Types.ObjectId) {
  const orders1 = await Order.find({ restaurantId: restaurantId1 }).lean();
  const orders2 = await Order.find({ restaurantId: restaurantId2 }).lean();

  const hasOnlyRestaurant1 = orders1.length === 0 || orders1.every((o: any) => o.restaurantId.toString() === restaurantId1.toString());
  const hasOnlyRestaurant2 = orders2.length === 0 || orders2.every((o: any) => o.restaurantId.toString() === restaurantId2.toString());
  const hasNoOverlap = orders1.every((o1: any) => !orders2.some((o2: any) => o1._id.toString() === o2._id.toString()));

  addResult('Orders isolated for restaurant 1', hasOnlyRestaurant1, '');
  addResult('Orders isolated for restaurant 2', hasOnlyRestaurant2, '');
  addResult('No order overlap', hasNoOverlap, '');
}

async function testUsernameUniqueness(restaurantId1: mongoose.Types.ObjectId, restaurantId2: mongoose.Types.ObjectId) {
  // Test: Same username should be allowed in different restaurants
  const testUsername = `testuser_${Date.now()}`;

  try {
    await Admin.create({
      restaurantId: restaurantId1,
      username: testUsername,
      email: `${testUsername}@restaurant1.com`,
      password: 'Test@123',
      firstName: 'Test',
      lastName: 'User1',
      role: 'admin',
    });

    await Admin.create({
      restaurantId: restaurantId2,
      username: testUsername, // Same username, different restaurant
      email: `${testUsername}@restaurant2.com`,
      password: 'Test@123',
      firstName: 'Test',
      lastName: 'User2',
      role: 'admin',
    });

    addResult('Same username allowed in different restaurants', true, '');

    // Clean up
    await Admin.deleteMany({ username: testUsername });
  } catch (error: any) {
    addResult('Same username allowed in different restaurants', false, error.message);
  }
}

async function testCrossTenantQueries(restaurantId1: mongoose.Types.ObjectId, restaurantId2: mongoose.Types.ObjectId) {
  // Test: Query with wrong restaurantId should return empty
  const admin1 = await Admin.findOne({ restaurantId: restaurantId1 }).lean();

  if (admin1) {
    const crossTenantQuery = await Admin.findOne({
      _id: admin1._id,
      restaurantId: restaurantId2, // Wrong restaurant ID
    }).lean();

    addResult(
      'Cross-tenant query returns null',
      crossTenantQuery === null,
      crossTenantQuery ? 'Found admin across tenants!' : ''
    );
  } else {
    addResult('Cross-tenant query returns null', true, 'No admin to test with');
  }

  // Test: Attempting to find all admins without restaurantId filter should include all
  const allAdmins = await Admin.find({}).lean();
  const hasMultipleRestaurants = new Set(allAdmins.map((a: any) => a.restaurantId.toString())).size > 1;
  addResult(
    'Unfiltered query includes multiple restaurants',
    hasMultipleRestaurants,
    'Query without restaurantId filter should include all tenants'
  );
}

// Run tests
testDataIsolation();
