#!/usr/bin/env node

/**
 * Test Script for Order Bulk Operations
 *
 * This script demonstrates how to use the bulk operations API endpoints.
 * Replace the placeholders with actual values from your environment.
 */

const BASE_URL = 'http://localhost:5000';
const AUTH_TOKEN = 'YOUR_ADMIN_JWT_TOKEN'; // Replace with actual token

// Example order IDs - replace with actual IDs from your database
const TEST_ORDER_IDS = [
  '65a1b2c3d4e5f6g7h8i9j0',
  '65a1b2c3d4e5f6g7h8i9j1',
];

/**
 * Test 1: Bulk Update Order Status
 */
async function testBulkUpdateStatus() {
  console.log('\n=== Test 1: Bulk Update Order Status ===');

  try {
    const response = await fetch(`${BASE_URL}/api/orders/bulk/update-status`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json',
        'x-restaurant-id': 'YOUR_RESTAURANT_ID', // For development bypass
      },
      body: JSON.stringify({
        orderIds: TEST_ORDER_IDS,
        status: 'preparing',
      }),
    });

    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));

    if (data.success) {
      console.log(`✓ Successfully updated ${data.data.updated} orders`);
    } else {
      console.log(`✗ Failed: ${data.message}`);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

/**
 * Test 2: Bulk Delete Orders (with safety checks)
 */
async function testBulkDelete() {
  console.log('\n=== Test 2: Bulk Delete Orders ===');

  try {
    const response = await fetch(`${BASE_URL}/api/orders/bulk/delete`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json',
        'x-restaurant-id': 'YOUR_RESTAURANT_ID',
      },
      body: JSON.stringify({
        orderIds: TEST_ORDER_IDS,
        confirm: true, // Required!
      }),
    });

    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));

    if (data.success) {
      console.log(`✓ Successfully deleted ${data.data.deleted} orders`);
    } else {
      console.log(`✗ Failed: ${data.message}`);
      if (data.data?.activeOrders) {
        console.log('Active orders blocking deletion:', data.data.activeOrders);
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

/**
 * Test 3: Export Orders to CSV
 */
async function testExportOrders() {
  console.log('\n=== Test 3: Export Orders to CSV ===');

  const params = new URLSearchParams({
    startDate: '2026-01-01',
    endDate: '2026-01-31',
    status: 'served',
  });

  try {
    const response = await fetch(`${BASE_URL}/api/orders/bulk/export?${params}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'x-restaurant-id': 'YOUR_RESTAURANT_ID',
      },
    });

    if (response.ok && response.headers.get('content-type')?.includes('text/csv')) {
      const csv = await response.text();
      console.log('Status:', response.status);
      console.log('Content-Type:', response.headers.get('content-type'));
      console.log('Content-Disposition:', response.headers.get('content-disposition'));
      console.log('\nFirst 500 characters of CSV:');
      console.log(csv.substring(0, 500));
      console.log('\n✓ CSV export successful');
    } else {
      const data = await response.json();
      console.log('Status:', response.status);
      console.log('Response:', JSON.stringify(data, null, 2));
      console.log(`✗ Failed: ${data.message}`);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

/**
 * Test 4: Error Handling - Invalid Order IDs
 */
async function testInvalidOrderIds() {
  console.log('\n=== Test 4: Error Handling - Invalid Order IDs ===');

  try {
    const response = await fetch(`${BASE_URL}/api/orders/bulk/update-status`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json',
        'x-restaurant-id': 'YOUR_RESTAURANT_ID',
      },
      body: JSON.stringify({
        orderIds: ['invalid-id', '123'],
        status: 'preparing',
      }),
    });

    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));

    if (!data.success) {
      console.log('✓ Correctly rejected invalid order IDs');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

/**
 * Test 5: Error Handling - Missing Confirmation
 */
async function testMissingConfirmation() {
  console.log('\n=== Test 5: Error Handling - Missing Confirmation ===');

  try {
    const response = await fetch(`${BASE_URL}/api/orders/bulk/delete`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Type': 'application/json',
        'x-restaurant-id': 'YOUR_RESTAURANT_ID',
      },
      body: JSON.stringify({
        orderIds: TEST_ORDER_IDS,
        // confirm: true // Intentionally omitted
      }),
    });

    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));

    if (!data.success && data.message.includes('Confirmation required')) {
      console.log('✓ Correctly requires confirmation for deletion');
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('==============================================');
  console.log('Order Bulk Operations - Test Suite');
  console.log('==============================================');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Auth Token: ${AUTH_TOKEN.substring(0, 20)}...`);
  console.log('==============================================');

  // Comment out tests you don't want to run
  await testBulkUpdateStatus();
  // await testBulkDelete(); // Commented out to prevent accidental deletions
  await testExportOrders();
  await testInvalidOrderIds();
  await testMissingConfirmation();

  console.log('\n==============================================');
  console.log('Tests completed!');
  console.log('==============================================\n');
}

// Run tests if executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  testBulkUpdateStatus,
  testBulkDelete,
  testExportOrders,
  testInvalidOrderIds,
  testMissingConfirmation,
  runAllTests,
};
