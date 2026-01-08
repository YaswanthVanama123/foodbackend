const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// Import models (using require since this is CommonJS)
const SuperAdmin = require('../dist/modules/common/models/SuperAdmin').default;
const Restaurant = require('../dist/modules/common/models/Restaurant').default;
const Admin = require('../dist/modules/common/models/Admin').default;
const Plan = require('../dist/modules/common/models/Plan').default;
const Category = require('../dist/modules/common/models/Category').default;
const MenuItem = require('../dist/modules/common/models/MenuItem').default;
const Table = require('../dist/modules/common/models/Table').default;
const Order = require('../dist/modules/common/models/Order').default;
const Customer = require('../dist/modules/common/models/Customer').default;
const AuditLog = require('../dist/modules/common/models/AuditLog').default;

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/patlinks';

/**
 * Complete Database Seed Script
 *
 * This script creates a complete development environment:
 * - 1 Super Admin
 * - 4 Subscription Plans
 * - 3 Sample Restaurants with different plans
 * - 3 Restaurant Admins (one per restaurant)
 * - 3-5 Categories per restaurant
 * - 10-15 Menu items per restaurant
 * - 5-10 Tables per restaurant
 * - 10-20 Sample orders per restaurant
 * - 5-10 Customers per restaurant
 * - Sample audit logs
 */

// Helper function to generate random date within last N days
function randomDate(days = 30) {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * days));
  return date;
}

// Helper function to generate random price
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

// Create Super Admin
async function createSuperAdmin() {
  console.log('\n👤 Creating Super Admin...');

  const superAdminData = {
    username: 'superadmin',
    email: 'admin@patlinks.com',
    password: 'superadmin123',
    firstName: 'Platform',
    lastName: 'Administrator',
    role: 'super_admin',
    isActive: true,
  };

  const superAdmin = await SuperAdmin.create(superAdminData);
  console.log(`   ✓ Super Admin created: ${superAdmin.username}`);
  return superAdmin;
}

// Create Subscription Plans
async function createPlans() {
  console.log('\n📋 Creating Subscription Plans...');

  const plans = [
    {
      name: 'Starter',
      description: 'Perfect for small restaurants getting started with digital ordering.',
      price: 0,
      currency: 'USD',
      billingCycle: 'monthly',
      features: [
        'Up to 10 tables',
        'Up to 30 menu items',
        '2 admin users',
        'Basic order management',
        'Standard support',
      ],
      limits: {
        maxTables: 10,
        maxMenuItems: 30,
        maxAdmins: 2,
        maxOrders: 500,
      },
      isActive: true,
      displayOrder: 1,
    },
    {
      name: 'Professional',
      description: 'Great for growing restaurants with increased capacity needs.',
      price: 49.99,
      currency: 'USD',
      billingCycle: 'monthly',
      features: [
        'Up to 25 tables',
        'Up to 100 menu items',
        '5 admin users',
        'Advanced order management',
        'Priority support',
        'Kitchen display system',
        'Customer reviews',
      ],
      limits: {
        maxTables: 25,
        maxMenuItems: 100,
        maxAdmins: 5,
        maxOrders: -1,
      },
      isActive: true,
      displayOrder: 2,
    },
    {
      name: 'Enterprise',
      description: 'For large restaurants requiring unlimited resources and premium features.',
      price: 149.99,
      currency: 'USD',
      billingCycle: 'monthly',
      features: [
        'Unlimited tables',
        'Unlimited menu items',
        'Unlimited admin users',
        'All Professional features',
        'Advanced analytics',
        'API access',
        'Dedicated support',
        'Custom integrations',
      ],
      limits: {
        maxTables: 999999,
        maxMenuItems: 999999,
        maxAdmins: 999999,
        maxOrders: -1,
      },
      isActive: true,
      displayOrder: 3,
    },
  ];

  const createdPlans = await Plan.insertMany(plans);
  console.log(`   ✓ Created ${createdPlans.length} subscription plans`);
  return createdPlans;
}

// Create Restaurants
async function createRestaurants(superAdminId, plans) {
  console.log('\n🏢 Creating Sample Restaurants...');

  const restaurants = [
    {
      subdomain: 'pizzapalace',
      name: 'Pizza Palace',
      slug: 'pizzapalace',
      email: 'contact@pizzapalace.com',
      phone: '+1-555-0101',
      address: {
        street: '123 Main Street',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        country: 'USA',
      },
      branding: {
        logo: { original: '' },
        primaryColor: '#E74C3C',
        secondaryColor: '#C0392B',
        accentColor: '#F39C12',
        fontFamily: 'Roboto, sans-serif',
        theme: 'light',
      },
      settings: {
        currency: 'USD',
        taxRate: 8.5,
        serviceChargeRate: 0,
        timezone: 'America/New_York',
        locale: 'en-US',
        orderNumberPrefix: 'PP',
      },
      subscription: {
        plan: 'trial',
        status: 'active',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        billingCycle: 'monthly',
        maxTables: plans[0].limits.maxTables,
        maxMenuItems: plans[0].limits.maxMenuItems,
        maxAdmins: plans[0].limits.maxAdmins,
      },
      isActive: true,
      isOnboarded: true,
      onboardingStep: 10,
      createdBy: superAdminId,
    },
    {
      subdomain: 'burgerbarn',
      name: 'Burger Barn',
      slug: 'burgerbarn',
      email: 'contact@burgerbarn.com',
      phone: '+1-555-0202',
      address: {
        street: '456 Oak Avenue',
        city: 'Los Angeles',
        state: 'CA',
        zipCode: '90001',
        country: 'USA',
      },
      branding: {
        logo: { original: '' },
        primaryColor: '#27AE60',
        secondaryColor: '#229954',
        accentColor: '#F1C40F',
        fontFamily: 'Poppins, sans-serif',
        theme: 'light',
      },
      settings: {
        currency: 'USD',
        taxRate: 9.5,
        serviceChargeRate: 2,
        timezone: 'America/Los_Angeles',
        locale: 'en-US',
        orderNumberPrefix: 'BB',
      },
      subscription: {
        plan: 'pro',
        status: 'active',
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        billingCycle: 'monthly',
        maxTables: plans[1].limits.maxTables,
        maxMenuItems: plans[1].limits.maxMenuItems,
        maxAdmins: plans[1].limits.maxAdmins,
      },
      isActive: true,
      isOnboarded: true,
      onboardingStep: 10,
      createdBy: superAdminId,
    },
    {
      subdomain: 'sushispot',
      name: 'Sushi Spot',
      slug: 'sushispot',
      email: 'contact@sushispot.com',
      phone: '+1-555-0303',
      address: {
        street: '789 Beach Boulevard',
        city: 'Miami',
        state: 'FL',
        zipCode: '33101',
        country: 'USA',
      },
      branding: {
        logo: { original: '' },
        primaryColor: '#3498DB',
        secondaryColor: '#2980B9',
        accentColor: '#E74C3C',
        fontFamily: 'Montserrat, sans-serif',
        theme: 'light',
      },
      settings: {
        currency: 'USD',
        taxRate: 7,
        serviceChargeRate: 3,
        timezone: 'America/New_York',
        locale: 'en-US',
        orderNumberPrefix: 'SS',
      },
      subscription: {
        plan: 'enterprise',
        status: 'active',
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        billingCycle: 'monthly',
        maxTables: plans[2].limits.maxTables,
        maxMenuItems: plans[2].limits.maxMenuItems,
        maxAdmins: plans[2].limits.maxAdmins,
      },
      isActive: true,
      isOnboarded: true,
      onboardingStep: 10,
      createdBy: superAdminId,
    },
  ];

  const createdRestaurants = await Restaurant.insertMany(restaurants);
  console.log(`   ✓ Created ${createdRestaurants.length} restaurants`);
  return createdRestaurants;
}

// Create Restaurant Admins
async function createAdmins(restaurants) {
  console.log('\n👥 Creating Restaurant Admins...');

  const admins = [];
  const adminDetails = [
    { username: 'pizzaadmin', email: 'admin@pizzapalace.com', password: 'admin123' },
    { username: 'burgeradmin', email: 'admin@burgerbarn.com', password: 'admin123' },
    { username: 'sushiadmin', email: 'admin@sushispot.com', password: 'admin123' },
  ];

  for (let i = 0; i < restaurants.length; i++) {
    const admin = await Admin.create({
      restaurantId: restaurants[i]._id,
      username: adminDetails[i].username,
      email: adminDetails[i].email,
      password: adminDetails[i].password,
      role: 'admin',
      permissions: ['all'],
      isActive: true,
    });
    admins.push(admin);
    console.log(`   ✓ Created admin for ${restaurants[i].name}: ${admin.username}`);
  }

  return admins;
}

// Create Categories
async function createCategories(restaurant) {
  const categoryData = {
    pizzapalace: [
      { name: 'Appetizers', description: 'Start your meal right', displayOrder: 1 },
      { name: 'Pizzas', description: 'Our signature pizzas', displayOrder: 2 },
      { name: 'Pasta', description: 'Fresh pasta dishes', displayOrder: 3 },
      { name: 'Salads', description: 'Fresh and healthy', displayOrder: 4 },
      { name: 'Desserts', description: 'Sweet endings', displayOrder: 5 },
    ],
    burgerbarn: [
      { name: 'Burgers', description: 'Juicy, delicious burgers', displayOrder: 1 },
      { name: 'Sides', description: 'Perfect accompaniments', displayOrder: 2 },
      { name: 'Drinks', description: 'Refreshing beverages', displayOrder: 3 },
      { name: 'Salads', description: 'Fresh and crispy', displayOrder: 4 },
    ],
    sushispot: [
      { name: 'Sushi Rolls', description: 'Traditional and specialty rolls', displayOrder: 1 },
      { name: 'Sashimi', description: 'Fresh sliced fish', displayOrder: 2 },
      { name: 'Appetizers', description: 'Japanese starters', displayOrder: 3 },
      { name: 'Ramen', description: 'Hot noodle soups', displayOrder: 4 },
      { name: 'Drinks', description: 'Japanese beverages', displayOrder: 5 },
    ],
  };

  const categories = [];
  const data = categoryData[restaurant.subdomain];

  for (const cat of data) {
    const category = await Category.create({
      restaurantId: restaurant._id,
      name: cat.name,
      description: cat.description,
      displayOrder: cat.displayOrder,
      isActive: true,
    });
    categories.push(category);
  }

  return categories;
}

// Create Menu Items
async function createMenuItems(restaurant, categories) {
  const menuData = {
    pizzapalace: {
      Appetizers: [
        { name: 'Garlic Bread', description: 'Toasted bread with garlic butter', price: 5.99 },
        { name: 'Mozzarella Sticks', description: 'Crispy fried mozzarella', price: 7.99 },
      ],
      Pizzas: [
        { name: 'Margherita Pizza', description: 'Classic tomato and mozzarella', price: 14.99, isVegetarian: true },
        { name: 'Pepperoni Pizza', description: 'Loaded with pepperoni', price: 16.99 },
        { name: 'Hawaiian Pizza', description: 'Ham and pineapple', price: 15.99 },
        { name: 'Veggie Deluxe', description: 'Assorted fresh vegetables', price: 15.99, isVegetarian: true, isVegan: true },
      ],
      Pasta: [
        { name: 'Spaghetti Carbonara', description: 'Creamy bacon pasta', price: 13.99 },
        { name: 'Fettuccine Alfredo', description: 'Rich cream sauce', price: 12.99, isVegetarian: true },
      ],
      Salads: [
        { name: 'Caesar Salad', description: 'Romaine, parmesan, croutons', price: 8.99, isVegetarian: true },
      ],
      Desserts: [
        { name: 'Tiramisu', description: 'Italian coffee dessert', price: 6.99, isVegetarian: true },
        { name: 'Gelato', description: 'Assorted flavors', price: 5.99, isVegetarian: true },
      ],
    },
    burgerbarn: {
      Burgers: [
        { name: 'Classic Burger', description: 'Beef patty with lettuce and tomato', price: 9.99 },
        { name: 'Cheeseburger', description: 'With melted cheese', price: 10.99 },
        { name: 'Bacon Burger', description: 'Topped with crispy bacon', price: 11.99 },
        { name: 'Veggie Burger', description: 'Plant-based patty', price: 10.99, isVegetarian: true, isVegan: true },
        { name: 'Double Burger', description: 'Two beef patties', price: 13.99 },
      ],
      Sides: [
        { name: 'French Fries', description: 'Crispy golden fries', price: 3.99, isVegetarian: true },
        { name: 'Onion Rings', description: 'Beer-battered rings', price: 4.99, isVegetarian: true },
        { name: 'Coleslaw', description: 'Creamy cabbage salad', price: 3.49, isVegetarian: true },
      ],
      Drinks: [
        { name: 'Soda', description: 'Assorted flavors', price: 2.49, isVegetarian: true, isVegan: true },
        { name: 'Milkshake', description: 'Chocolate, vanilla, or strawberry', price: 5.99, isVegetarian: true },
      ],
      Salads: [
        { name: 'Garden Salad', description: 'Fresh mixed greens', price: 7.99, isVegetarian: true, isVegan: true },
      ],
    },
    sushispot: {
      'Sushi Rolls': [
        { name: 'California Roll', description: 'Crab, avocado, cucumber', price: 8.99 },
        { name: 'Spicy Tuna Roll', description: 'Tuna with spicy mayo', price: 9.99 },
        { name: 'Dragon Roll', description: 'Eel, cucumber, avocado', price: 12.99 },
        { name: 'Veggie Roll', description: 'Assorted vegetables', price: 7.99, isVegetarian: true, isVegan: true },
      ],
      Sashimi: [
        { name: 'Salmon Sashimi', description: 'Fresh salmon slices', price: 14.99 },
        { name: 'Tuna Sashimi', description: 'Fresh tuna slices', price: 15.99 },
      ],
      Appetizers: [
        { name: 'Edamame', description: 'Steamed soybeans', price: 4.99, isVegetarian: true, isVegan: true },
        { name: 'Gyoza', description: 'Pan-fried dumplings', price: 6.99 },
      ],
      Ramen: [
        { name: 'Tonkotsu Ramen', description: 'Pork bone broth', price: 13.99 },
        { name: 'Miso Ramen', description: 'Soybean paste broth', price: 12.99 },
      ],
      Drinks: [
        { name: 'Green Tea', description: 'Hot or iced', price: 2.99, isVegetarian: true, isVegan: true },
        { name: 'Sake', description: 'Japanese rice wine', price: 8.99, isVegetarian: true, isVegan: true },
      ],
    },
  };

  const menuItems = [];
  const data = menuData[restaurant.subdomain];

  for (const category of categories) {
    const items = data[category.name] || [];
    for (const item of items) {
      const menuItem = await MenuItem.create({
        restaurantId: restaurant._id,
        name: item.name,
        description: item.description,
        categoryId: category._id,
        price: item.price,
        isAvailable: true,
        isVegetarian: item.isVegetarian || false,
        isVegan: item.isVegan || false,
        isGlutenFree: false,
        preparationTime: Math.floor(Math.random() * 20) + 10,
        averageRating: (Math.random() * 2 + 3).toFixed(1),
        ratingsCount: Math.floor(Math.random() * 50),
      });
      menuItems.push(menuItem);
    }
  }

  return menuItems;
}

// Create Tables
async function createTables(restaurant) {
  const tables = [];
  const tableCount = restaurant.subscription.plan === 'trial' ? 8 :
                     restaurant.subscription.plan === 'pro' ? 15 : 20;

  for (let i = 1; i <= tableCount; i++) {
    const table = await Table.create({
      restaurantId: restaurant._id,
      tableNumber: `T${i.toString().padStart(2, '0')}`,
      capacity: Math.floor(Math.random() * 4) + 2,
      isActive: true,
      isOccupied: false,
      location: i <= tableCount / 2 ? 'Main Floor' : 'Patio',
    });
    tables.push(table);
  }

  return tables;
}

// Create Customers
async function createCustomers(restaurant) {
  const customers = [];
  const customerData = [
    { firstName: 'John', lastName: 'Doe', email: 'john.doe@example.com' },
    { firstName: 'Jane', lastName: 'Smith', email: 'jane.smith@example.com' },
    { firstName: 'Bob', lastName: 'Johnson', email: 'bob.johnson@example.com' },
    { firstName: 'Alice', lastName: 'Williams', email: 'alice.williams@example.com' },
    { firstName: 'Charlie', lastName: 'Brown', email: 'charlie.brown@example.com' },
  ];

  for (const data of customerData) {
    const customer = await Customer.create({
      restaurantId: restaurant._id,
      email: data.email,
      password: 'customer123',
      firstName: data.firstName,
      lastName: data.lastName,
      phone: `+1-555-${Math.floor(Math.random() * 9000) + 1000}`,
      isActive: true,
      preferences: {
        dietaryRestrictions: [],
        allergens: [],
        favoriteItems: [],
      },
      notifications: {
        email: true,
        push: true,
      },
      language: 'en',
      theme: 'light',
    });
    customers.push(customer);
  }

  return customers;
}

// Create Orders
async function createOrders(restaurant, tables, menuItems, customers) {
  const orders = [];
  const statuses = ['received', 'preparing', 'ready', 'served', 'cancelled'];
  const orderCount = Math.floor(Math.random() * 10) + 10;

  for (let i = 0; i < orderCount; i++) {
    const table = tables[Math.floor(Math.random() * tables.length)];
    const customer = customers[Math.floor(Math.random() * customers.length)];
    const status = statuses[Math.floor(Math.random() * statuses.length)];

    // Select 1-5 random menu items
    const orderItemsCount = Math.floor(Math.random() * 4) + 1;
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
      });
    }

    const subtotal = selectedItems.reduce((sum, item) => sum + item.subtotal, 0);
    const tax = subtotal * (restaurant.settings.taxRate / 100);
    const total = subtotal + tax;

    const order = await Order.create({
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
      statusHistory: [
        { status: 'received', timestamp: randomDate(7) },
      ],
      createdAt: randomDate(30),
      servedAt: status === 'served' ? randomDate(5) : undefined,
    });
    orders.push(order);
  }

  return orders;
}

// Create Audit Logs
async function createAuditLogs(superAdmin, restaurants, admins) {
  const logs = [];

  // Super admin logs
  for (const restaurant of restaurants) {
    logs.push({
      action: 'restaurant.created',
      actorType: 'super_admin',
      actorId: superAdmin._id,
      actorName: `${superAdmin.firstName} ${superAdmin.lastName}`,
      resourceType: 'Restaurant',
      resourceId: restaurant._id,
      severity: 'info',
      timestamp: randomDate(30),
      metadata: {
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      },
    });
  }

  // Admin logs
  for (let i = 0; i < admins.length; i++) {
    logs.push({
      action: 'login.success',
      actorType: 'admin',
      actorId: admins[i]._id,
      actorName: admins[i].username,
      resourceType: 'Admin',
      resourceId: admins[i]._id,
      severity: 'info',
      timestamp: randomDate(7),
      metadata: {
        ip: '192.168.1.' + (i + 10),
        userAgent: 'Mozilla/5.0',
      },
    });
  }

  await AuditLog.insertMany(logs);
  return logs;
}

// Main seed function
async function seedDatabase() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║                                                           ║');
  console.log('║   🌱 Database Seeding Script                             ║');
  console.log('║   Patlinks Multi-Tenant Food Ordering Platform            ║');
  console.log('║                                                           ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  try {
    // Connect to database
    await connectDB();

    // Clear existing data
    console.log('\n🗑️  Clearing existing data...');
    await Promise.all([
      SuperAdmin.deleteMany({}),
      Restaurant.deleteMany({}),
      Admin.deleteMany({}),
      Plan.deleteMany({}),
      Category.deleteMany({}),
      MenuItem.deleteMany({}),
      Table.deleteMany({}),
      Order.deleteMany({}),
      Customer.deleteMany({}),
      AuditLog.deleteMany({}),
    ]);
    console.log('   ✓ Existing data cleared');

    // Create data
    const superAdmin = await createSuperAdmin();
    const plans = await createPlans();
    const restaurants = await createRestaurants(superAdmin._id, plans);
    const admins = await createAdmins(restaurants);

    // Create data for each restaurant
    let totalCategories = 0;
    let totalMenuItems = 0;
    let totalTables = 0;
    let totalCustomers = 0;
    let totalOrders = 0;

    console.log('\n🍽️  Creating restaurant data...');
    for (const restaurant of restaurants) {
      console.log(`\n   Processing ${restaurant.name}...`);

      const categories = await createCategories(restaurant);
      totalCategories += categories.length;
      console.log(`      ✓ ${categories.length} categories`);

      const menuItems = await createMenuItems(restaurant, categories);
      totalMenuItems += menuItems.length;
      console.log(`      ✓ ${menuItems.length} menu items`);

      const tables = await createTables(restaurant);
      totalTables += tables.length;
      console.log(`      ✓ ${tables.length} tables`);

      const customers = await createCustomers(restaurant);
      totalCustomers += customers.length;
      console.log(`      ✓ ${customers.length} customers`);

      const orders = await createOrders(restaurant, tables, menuItems, customers);
      totalOrders += orders.length;
      console.log(`      ✓ ${orders.length} orders`);
    }

    // Create audit logs
    console.log('\n📝 Creating audit logs...');
    const logs = await createAuditLogs(superAdmin, restaurants, admins);
    console.log(`   ✓ Created ${logs.length} audit logs`);

    // Print summary
    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║                                                           ║');
    console.log('║   ✅ Database Seeding Completed Successfully!            ║');
    console.log('║                                                           ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    console.log('📊 Summary:');
    console.log(`   Super Admins: 1`);
    console.log(`   Subscription Plans: ${plans.length}`);
    console.log(`   Restaurants: ${restaurants.length}`);
    console.log(`   Restaurant Admins: ${admins.length}`);
    console.log(`   Categories: ${totalCategories}`);
    console.log(`   Menu Items: ${totalMenuItems}`);
    console.log(`   Tables: ${totalTables}`);
    console.log(`   Customers: ${totalCustomers}`);
    console.log(`   Orders: ${totalOrders}`);
    console.log(`   Audit Logs: ${logs.length}\n`);

    console.log('🔐 Default Credentials:\n');
    console.log('   Super Admin:');
    console.log('      Username: superadmin');
    console.log('      Password: superadmin123');
    console.log('      Endpoint: POST /api/super-admin/auth/login\n');

    console.log('   Restaurant Admins:');
    console.log('      Pizza Palace - username: pizzaadmin, password: admin123');
    console.log('      Burger Barn - username: burgeradmin, password: admin123');
    console.log('      Sushi Spot - username: sushiadmin, password: admin123');
    console.log('      Endpoint: POST /api/auth/login (with x-restaurant-id header)\n');

    console.log('   Customers:');
    console.log('      All customers have password: customer123\n');

    console.log('🏢 Restaurant Subdomains:');
    console.log('      pizzapalace.patlinks.com');
    console.log('      burgerbarn.patlinks.com');
    console.log('      sushispot.patlinks.com\n');

    console.log('📝 Next Steps:');
    console.log('   1. Start the server: npm run dev');
    console.log('   2. Test super admin login');
    console.log('   3. Test restaurant admin login');
    console.log('   4. Explore the API endpoints\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error seeding database:', error);
    process.exit(1);
  }
}

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\n👋 Seed cancelled by user');
  process.exit(0);
});

// Run seed
seedDatabase();
