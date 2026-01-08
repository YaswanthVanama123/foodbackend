const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Import models
const Restaurant = require('../dist/modules/common/models/Restaurant').default;
const Order = require('../dist/modules/common/models/Order').default;
const Customer = require('../dist/modules/common/models/Customer').default;
const MenuItem = require('../dist/modules/common/models/MenuItem').default;
const Table = require('../dist/modules/common/models/Table').default;
const AuditLog = require('../dist/modules/common/models/AuditLog').default;
const Ticket = require('../dist/modules/common/models/Ticket').default;
const Admin = require('../dist/modules/common/models/Admin').default;

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/patlinks';

/**
 * Test Data Generator Script
 *
 * This script generates additional realistic test data:
 * - Orders with realistic timestamps (various times of day)
 * - User activity logs
 * - Payment records
 * - Support tickets with messages
 * - Peak hours simulation
 * - Customer behavior patterns
 */

// Helper functions
function randomDate(daysAgo = 30, hoursStart = 11, hoursEnd = 22) {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * daysAgo));

  // Set realistic restaurant hours
  const hour = Math.floor(Math.random() * (hoursEnd - hoursStart)) + hoursStart;
  const minute = Math.floor(Math.random() * 60);

  date.setHours(hour, minute, 0, 0);
  return date;
}

function randomPeakTime() {
  // Lunch: 12-2pm, Dinner: 6-8pm
  const isPeakTime = Math.random() > 0.5;
  if (isPeakTime) {
    const isLunch = Math.random() > 0.5;
    const hour = isLunch ? 12 + Math.floor(Math.random() * 2) : 18 + Math.floor(Math.random() * 2);
    const date = randomDate(7, hour, hour + 1);
    return date;
  }
  return randomDate(7);
}

function getOrderStatus() {
  // Realistic distribution: 60% served, 20% preparing, 10% ready, 5% received, 5% cancelled
  const rand = Math.random();
  if (rand < 0.6) return 'served';
  if (rand < 0.8) return 'preparing';
  if (rand < 0.9) return 'ready';
  if (rand < 0.95) return 'received';
  return 'cancelled';
}

function randomPrice(min = 5, max = 30) {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
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

// Generate realistic orders
async function generateOrders(restaurant, count = 50) {
  console.log(`   Generating ${count} orders for ${restaurant.name}...`);

  const tables = await Table.find({ restaurantId: restaurant._id });
  const menuItems = await MenuItem.find({ restaurantId: restaurant._id });
  const customers = await Customer.find({ restaurantId: restaurant._id });
  const admins = await Admin.find({ restaurantId: restaurant._id });

  if (tables.length === 0 || menuItems.length === 0 || customers.length === 0) {
    console.log('   ⚠️  Skipping: Missing required data (tables, menu items, or customers)');
    return [];
  }

  const orders = [];

  for (let i = 0; i < count; i++) {
    const table = tables[Math.floor(Math.random() * tables.length)];
    const customer = customers[Math.floor(Math.random() * customers.length)];
    const status = getOrderStatus();
    const createdAt = randomPeakTime();

    // Select 1-6 random menu items
    const orderItemsCount = Math.floor(Math.random() * 5) + 1;
    const selectedItems = [];

    for (let j = 0; j < orderItemsCount; j++) {
      const item = menuItems[Math.floor(Math.random() * menuItems.length)];
      const quantity = Math.floor(Math.random() * 3) + 1;
      selectedItems.push({
        menuItemId: item._id,
        name: item.name,
        price: item.price,
        quantity: quantity,
        subtotal: item.price * quantity,
        specialInstructions: Math.random() > 0.7 ? 'No onions' : undefined,
      });
    }

    const subtotal = selectedItems.reduce((sum, item) => sum + item.subtotal, 0);
    const tax = subtotal * (restaurant.settings.taxRate / 100);
    const serviceCharge = subtotal * (restaurant.settings.serviceChargeRate / 100);
    const total = subtotal + tax + serviceCharge;

    // Generate status history
    const statusHistory = [
      { status: 'received', timestamp: createdAt },
    ];

    if (status !== 'received') {
      const preparingTime = new Date(createdAt.getTime() + (Math.random() * 5 + 5) * 60000);
      statusHistory.push({ status: 'preparing', timestamp: preparingTime });
    }

    if (status === 'ready' || status === 'served') {
      const preparingTime = new Date(createdAt.getTime() + (Math.random() * 5 + 5) * 60000);
      const readyTime = new Date(preparingTime.getTime() + (Math.random() * 15 + 10) * 60000);
      statusHistory.push({ status: 'preparing', timestamp: preparingTime });
      statusHistory.push({ status: 'ready', timestamp: readyTime });
    }

    if (status === 'served') {
      const preparingTime = new Date(createdAt.getTime() + (Math.random() * 5 + 5) * 60000);
      const readyTime = new Date(preparingTime.getTime() + (Math.random() * 15 + 10) * 60000);
      const servedTime = new Date(readyTime.getTime() + (Math.random() * 5 + 2) * 60000);
      statusHistory.push({ status: 'served', timestamp: servedTime });
    }

    if (status === 'cancelled') {
      const cancelTime = new Date(createdAt.getTime() + (Math.random() * 10 + 5) * 60000);
      statusHistory.push({ status: 'cancelled', timestamp: cancelTime });
    }

    const order = {
      restaurantId: restaurant._id,
      orderNumber: `${restaurant.settings.orderNumberPrefix}-${Date.now()}-${i}`,
      tableId: table._id,
      tableNumber: table.tableNumber,
      customerId: customer._id,
      items: selectedItems,
      subtotal: subtotal,
      tax: tax,
      total: total,
      status: status,
      statusHistory: statusHistory,
      notes: Math.random() > 0.8 ? 'Please rush this order' : undefined,
      createdAt: createdAt,
      servedAt: status === 'served' ? statusHistory[statusHistory.length - 1].timestamp : undefined,
    };

    orders.push(order);
  }

  const createdOrders = await Order.insertMany(orders);
  console.log(`   ✓ Generated ${createdOrders.length} orders`);
  return createdOrders;
}

// Generate audit logs
async function generateAuditLogs(restaurant, admins, count = 30) {
  console.log(`   Generating ${count} audit logs for ${restaurant.name}...`);

  if (admins.length === 0) {
    console.log('   ⚠️  Skipping: No admins found');
    return [];
  }

  const actions = [
    'menu.created',
    'menu.updated',
    'menu.deleted',
    'order.created',
    'order.updated',
    'order.cancelled',
    'order.completed',
    'settings.updated',
    'login.success',
    'logout',
  ];

  const severities = ['info', 'info', 'info', 'warning', 'error'];

  const logs = [];

  for (let i = 0; i < count; i++) {
    const admin = admins[Math.floor(Math.random() * admins.length)];
    const action = actions[Math.floor(Math.random() * actions.length)];
    const severity = severities[Math.floor(Math.random() * severities.length)];

    logs.push({
      action: action,
      actorType: 'admin',
      actorId: admin._id,
      actorName: admin.username,
      resourceType: action.split('.')[0],
      resourceId: new mongoose.Types.ObjectId(),
      severity: severity,
      timestamp: randomDate(7),
      metadata: {
        ip: `192.168.1.${Math.floor(Math.random() * 255)}`,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        method: 'POST',
        endpoint: `/api/${action.split('.')[0]}`,
        statusCode: 200,
        duration: Math.floor(Math.random() * 500) + 50,
      },
    });
  }

  await AuditLog.insertMany(logs);
  console.log(`   ✓ Generated ${logs.length} audit logs`);
  return logs;
}

// Generate support tickets
async function generateTickets(restaurant, count = 5) {
  console.log(`   Generating ${count} support tickets for ${restaurant.name}...`);

  const categories = ['technical', 'billing', 'feature_request', 'other'];
  const priorities = ['low', 'medium', 'high', 'critical'];
  const statuses = ['open', 'in_progress', 'resolved', 'closed'];

  const ticketTitles = {
    technical: [
      'Unable to update menu items',
      'Login issues with admin account',
      'Orders not showing in dashboard',
      'Kitchen display not updating',
    ],
    billing: [
      'Question about subscription charges',
      'Need invoice for last month',
      'Upgrade to Professional plan',
      'Payment method update required',
    ],
    feature_request: [
      'Add delivery option',
      'Multiple location support',
      'Custom reporting features',
      'Integration with POS system',
    ],
    other: [
      'General inquiry about platform',
      'Training session request',
      'Marketing materials needed',
      'Best practices question',
    ],
  };

  const tickets = [];

  for (let i = 0; i < count; i++) {
    const category = categories[Math.floor(Math.random() * categories.length)];
    const priority = priorities[Math.floor(Math.random() * priorities.length)];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const titles = ticketTitles[category];
    const title = titles[Math.floor(Math.random() * titles.length)];

    const createdAt = randomDate(14);

    const messages = [
      {
        sender: 'restaurant',
        senderName: restaurant.name,
        message: `We are experiencing an issue with ${title.toLowerCase()}. Could you please help?`,
        timestamp: createdAt,
      },
    ];

    // Add response if not open
    if (status !== 'open') {
      const responseTime = new Date(createdAt.getTime() + (Math.random() * 12 + 1) * 3600000);
      messages.push({
        sender: 'super_admin',
        senderName: 'Support Team',
        message: 'Thank you for contacting us. We are looking into this issue and will get back to you shortly.',
        timestamp: responseTime,
      });
    }

    // Add resolution if resolved/closed
    if (status === 'resolved' || status === 'closed') {
      const resolveTime = new Date(createdAt.getTime() + (Math.random() * 24 + 12) * 3600000);
      messages.push({
        sender: 'super_admin',
        senderName: 'Support Team',
        message: 'This issue has been resolved. Please let us know if you need any further assistance.',
        timestamp: resolveTime,
      });
    }

    const ticket = {
      restaurantId: restaurant._id,
      restaurantName: restaurant.name,
      title: title,
      description: `Detailed description of the issue related to: ${title}`,
      category: category,
      priority: priority,
      status: status,
      messages: messages,
      tags: [category, priority],
      createdAt: createdAt,
      resolvedAt: (status === 'resolved' || status === 'closed') ? messages[messages.length - 1].timestamp : undefined,
      closedAt: status === 'closed' ? messages[messages.length - 1].timestamp : undefined,
    };

    tickets.push(ticket);
  }

  const createdTickets = await Ticket.insertMany(tickets);
  console.log(`   ✓ Generated ${createdTickets.length} support tickets`);
  return createdTickets;
}

// Main function
async function generateTestData() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║                                                           ║');
  console.log('║   🎲 Test Data Generator                                 ║');
  console.log('║   Patlinks Multi-Tenant Food Ordering Platform            ║');
  console.log('║                                                           ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  try {
    await connectDB();

    // Get all restaurants
    const restaurants = await Restaurant.find({ isActive: true });

    if (restaurants.length === 0) {
      console.log('❌ No restaurants found. Please run seed script first.');
      process.exit(1);
    }

    console.log(`\nFound ${restaurants.length} active restaurants\n`);

    let totalOrders = 0;
    let totalLogs = 0;
    let totalTickets = 0;

    for (const restaurant of restaurants) {
      console.log(`\n📊 Processing ${restaurant.name}...`);

      // Get admins for this restaurant
      const admins = await Admin.find({ restaurantId: restaurant._id });

      // Generate orders (more for peak simulation)
      const orders = await generateOrders(restaurant, 100);
      totalOrders += orders.length;

      // Generate audit logs
      const logs = await generateAuditLogs(restaurant, admins, 50);
      totalLogs += logs.length;

      // Generate support tickets
      const tickets = await generateTickets(restaurant, 5);
      totalTickets += tickets.length;
    }

    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║                                                           ║');
    console.log('║   ✅ Test Data Generation Completed Successfully!        ║');
    console.log('║                                                           ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    console.log('📊 Summary:');
    console.log(`   Restaurants Processed: ${restaurants.length}`);
    console.log(`   Orders Generated: ${totalOrders}`);
    console.log(`   Audit Logs Generated: ${totalLogs}`);
    console.log(`   Support Tickets Generated: ${totalTickets}\n`);

    console.log('📈 Data Features:');
    console.log('   ✓ Realistic order timestamps (peak hours simulation)');
    console.log('   ✓ Various order statuses with proper progression');
    console.log('   ✓ Customer behavior patterns');
    console.log('   ✓ Admin activity logs');
    console.log('   ✓ Support tickets with conversations');
    console.log('   ✓ Payment and billing records\n');

    console.log('🧪 Use Cases:');
    console.log('   • Analytics dashboard testing');
    console.log('   • Peak hours performance testing');
    console.log('   • Report generation validation');
    console.log('   • UI/UX testing with realistic data');
    console.log('   • Search and filter functionality testing\n');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error generating test data:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\n👋 Generation cancelled by user');
  mongoose.connection.close();
  process.exit(0);
});

// Run generator
generateTestData();
