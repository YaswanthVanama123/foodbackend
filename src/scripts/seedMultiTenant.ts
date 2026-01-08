import dotenv from 'dotenv';
import mongoose from 'mongoose';
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
 * Multi-Tenant Seed Script
 *
 * Creates complete test data for 3 restaurants:
 * 1. Pizza Palace - Italian restaurant with pizzas and pasta
 * 2. Burger Barn - American burger joint
 * 3. Sushi Spot - Japanese sushi restaurant
 *
 * Each restaurant includes:
 * - 1 Admin user
 * - 5-10 Categories
 * - 15-20 Menu items
 * - 10 Tables
 * - 5 Sample customers
 * - 10-15 Orders with different statuses
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

async function seedMultiTenant() {
  try {
    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║                                                           ║');
    console.log('║   🌍 Seeding Multi-Tenant Test Data                      ║');
    console.log('║   Patlinks Food Ordering System                           ║');
    console.log('║                                                           ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    await connectDB();

    // Get plans
    console.log('🔍 Fetching subscription plans...');
    const plans = await Plan.find({}).sort({ displayOrder: 1 });

    if (plans.length === 0) {
      console.log('⚠️  No plans found! Run seedPlans.ts first.');
      throw new Error('No subscription plans found');
    }

    console.log(`   ✓ Found ${plans.length} plans\n`);

    // Clear existing data
    console.log('🗑️  Clearing existing restaurant data...');
    await Restaurant.deleteMany({});
    await Admin.deleteMany({});
    await Category.deleteMany({});
    await MenuItem.deleteMany({});
    await Table.deleteMany({});
    await Customer.deleteMany({});
    await Order.deleteMany({});
    console.log('   ✓ Existing data cleared\n');

    // Create restaurants
    console.log('🏪 Creating restaurants...\n');

    const restaurants = await Restaurant.insertMany([
      {
        subdomain: 'pizzapalace',
        name: 'Pizza Palace',
        slug: 'pizza-palace',
        email: 'contact@pizzapalace.com',
        phone: '+1 (555) 111-0001',
        address: {
          street: '123 Main Street',
          city: 'New York',
          state: 'NY',
          zipCode: '10001',
          country: 'USA',
        },
        branding: {
          logo: { original: '', medium: '', small: '' },
          primaryColor: '#DC2626',
          secondaryColor: '#FEF3C7',
          accentColor: '#059669',
          fontFamily: 'Roboto, sans-serif',
          theme: 'light',
        },
        settings: {
          currency: 'USD',
          taxRate: 8.5,
          serviceChargeRate: 5,
          timezone: 'America/New_York',
          locale: 'en-US',
          orderNumberPrefix: 'PP',
        },
        subscription: {
          plan: 'pro',
          status: 'active',
          startDate: new Date(),
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          billingCycle: 'monthly',
          maxTables: 50,
          maxMenuItems: 300,
          maxAdmins: 10,
        },
        isActive: true,
        isOnboarded: true,
        onboardingStep: 10,
      },
      {
        subdomain: 'burgerbarn',
        name: 'Burger Barn',
        slug: 'burger-barn',
        email: 'contact@burgerbarn.com',
        phone: '+1 (555) 222-0002',
        address: {
          street: '456 Oak Avenue',
          city: 'Los Angeles',
          state: 'CA',
          zipCode: '90001',
          country: 'USA',
        },
        branding: {
          logo: { original: '', medium: '', small: '' },
          primaryColor: '#B91C1C',
          secondaryColor: '#FCD34D',
          accentColor: '#F59E0B',
          fontFamily: 'Open Sans, sans-serif',
          theme: 'light',
        },
        settings: {
          currency: 'USD',
          taxRate: 9.5,
          serviceChargeRate: 0,
          timezone: 'America/Los_Angeles',
          locale: 'en-US',
          orderNumberPrefix: 'BB',
        },
        subscription: {
          plan: 'basic',
          status: 'active',
          startDate: new Date(),
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          billingCycle: 'monthly',
          maxTables: 20,
          maxMenuItems: 100,
          maxAdmins: 3,
        },
        isActive: true,
        isOnboarded: true,
        onboardingStep: 10,
      },
      {
        subdomain: 'sushispot',
        name: 'Sushi Spot',
        slug: 'sushi-spot',
        email: 'contact@sushispot.com',
        phone: '+1 (555) 333-0003',
        address: {
          street: '789 Cherry Blossom Lane',
          city: 'Seattle',
          state: 'WA',
          zipCode: '98101',
          country: 'USA',
        },
        branding: {
          logo: { original: '', medium: '', small: '' },
          primaryColor: '#1E40AF',
          secondaryColor: '#FEE2E2',
          accentColor: '#DC2626',
          fontFamily: 'Lato, sans-serif',
          theme: 'light',
        },
        settings: {
          currency: 'USD',
          taxRate: 10.1,
          serviceChargeRate: 3,
          timezone: 'America/Los_Angeles',
          locale: 'en-US',
          orderNumberPrefix: 'SS',
        },
        subscription: {
          plan: 'enterprise',
          status: 'active',
          startDate: new Date(),
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          billingCycle: 'monthly',
          maxTables: 999999,
          maxMenuItems: 999999,
          maxAdmins: 999999,
        },
        isActive: true,
        isOnboarded: true,
        onboardingStep: 10,
      },
    ]);

    console.log(`   ✓ Created ${restaurants.length} restaurants\n`);

    // Create admins for each restaurant
    console.log('👥 Creating admin users...\n');

    const admins = await Admin.insertMany([
      {
        restaurantId: restaurants[0]._id,
        username: 'admin1',
        email: 'admin1@pizzapalace.com',
        password: 'admin123',
        firstName: 'Tony',
        lastName: 'Soprano',
        role: 'admin',
        permissions: [],
        isActive: true,
      },
      {
        restaurantId: restaurants[1]._id,
        username: 'admin2',
        email: 'admin2@burgerbarn.com',
        password: 'admin123',
        firstName: 'Bob',
        lastName: 'Belcher',
        role: 'admin',
        permissions: [],
        isActive: true,
      },
      {
        restaurantId: restaurants[2]._id,
        username: 'admin3',
        email: 'admin3@sushispot.com',
        password: 'admin123',
        firstName: 'Hiro',
        lastName: 'Tanaka',
        role: 'admin',
        permissions: [],
        isActive: true,
      },
    ]);

    console.log(`   ✓ Created ${admins.length} admin users\n`);

    // Seed each restaurant
    console.log('🌱 Seeding individual restaurants...\n');

    await seedPizzaPalace(restaurants[0]._id);
    await seedBurgerBarn(restaurants[1]._id);
    await seedSushiSpot(restaurants[2]._id);

    // Summary
    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║                                                           ║');
    console.log('║   ✅ Multi-Tenant Seeding Completed!                     ║');
    console.log('║                                                           ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    // Display credentials
    console.log('🔐 Restaurant Admin Credentials:\n');

    console.log('   🍕 Pizza Palace:');
    console.log('      Subdomain: pizzapalace.localhost:5000');
    console.log('      Username: admin1');
    console.log('      Password: admin123');
    console.log('      Email: admin1@pizzapalace.com\n');

    console.log('   🍔 Burger Barn:');
    console.log('      Subdomain: burgerbarn.localhost:5000');
    console.log('      Username: admin2');
    console.log('      Password: admin123');
    console.log('      Email: admin2@burgerbarn.com\n');

    console.log('   🍣 Sushi Spot:');
    console.log('      Subdomain: sushispot.localhost:5000');
    console.log('      Username: admin3');
    console.log('      Password: admin123');
    console.log('      Email: admin3@sushispot.com\n');

    console.log('📊 Summary:');
    const categoryCount = await Category.countDocuments();
    const menuItemCount = await MenuItem.countDocuments();
    const tableCount = await Table.countDocuments();
    const customerCount = await Customer.countDocuments();
    const orderCount = await Order.countDocuments();

    console.log(`   Restaurants: ${restaurants.length}`);
    console.log(`   Admins: ${admins.length}`);
    console.log(`   Categories: ${categoryCount}`);
    console.log(`   Menu Items: ${menuItemCount}`);
    console.log(`   Tables: ${tableCount}`);
    console.log(`   Customers: ${customerCount}`);
    console.log(`   Orders: ${orderCount}\n`);

    await mongoose.connection.close();
    console.log('🔌 Database connection closed\n');
  } catch (error) {
    console.error('\n❌ Error seeding multi-tenant data:', error);
    throw error;
  }
}

// Seed Pizza Palace
async function seedPizzaPalace(restaurantId: mongoose.Types.ObjectId) {
  console.log('   🍕 Seeding Pizza Palace...');

  // Categories
  const categories = await Category.insertMany([
    { restaurantId, name: 'Pizzas', description: 'Hand-tossed and wood-fired pizzas', displayOrder: 1, isActive: true },
    { restaurantId, name: 'Appetizers', description: 'Starters and small plates', displayOrder: 2, isActive: true },
    { restaurantId, name: 'Pasta', description: 'Fresh Italian pasta dishes', displayOrder: 3, isActive: true },
    { restaurantId, name: 'Salads', description: 'Fresh garden salads', displayOrder: 4, isActive: true },
    { restaurantId, name: 'Desserts', description: 'Sweet Italian treats', displayOrder: 5, isActive: true },
    { restaurantId, name: 'Beverages', description: 'Drinks and refreshments', displayOrder: 6, isActive: true },
  ]);

  const catMap: any = {};
  categories.forEach(cat => catMap[cat.name] = cat._id);

  // Menu Items
  await MenuItem.insertMany([
    // Pizzas
    { restaurantId, categoryId: catMap['Pizzas'], name: 'Margherita', description: 'Classic tomato, mozzarella, and basil', price: 12.99, isAvailable: true, isVegetarian: true, preparationTime: 15 },
    { restaurantId, categoryId: catMap['Pizzas'], name: 'Pepperoni', description: 'Pepperoni and mozzarella cheese', price: 14.99, isAvailable: true, preparationTime: 15 },
    { restaurantId, categoryId: catMap['Pizzas'], name: 'Supreme', description: 'Pepperoni, sausage, peppers, onions, mushrooms', price: 17.99, isAvailable: true, preparationTime: 18 },
    { restaurantId, categoryId: catMap['Pizzas'], name: 'Hawaiian', description: 'Ham, pineapple, and mozzarella', price: 15.99, isAvailable: true, preparationTime: 15 },
    { restaurantId, categoryId: catMap['Pizzas'], name: 'Veggie Deluxe', description: 'Mushrooms, peppers, onions, olives, tomatoes', price: 16.99, isAvailable: true, isVegetarian: true, preparationTime: 15 },
    // Appetizers
    { restaurantId, categoryId: catMap['Appetizers'], name: 'Garlic Bread', description: 'Toasted garlic bread with herbs', price: 5.99, isAvailable: true, isVegetarian: true, preparationTime: 8 },
    { restaurantId, categoryId: catMap['Appetizers'], name: 'Mozzarella Sticks', description: 'Breaded mozzarella with marinara', price: 7.99, isAvailable: true, isVegetarian: true, preparationTime: 10 },
    { restaurantId, categoryId: catMap['Appetizers'], name: 'Bruschetta', description: 'Toasted bread with tomatoes and basil', price: 6.99, isAvailable: true, isVegetarian: true, isVegan: true, preparationTime: 8 },
    // Pasta
    { restaurantId, categoryId: catMap['Pasta'], name: 'Spaghetti Carbonara', description: 'Pasta with bacon, egg, and parmesan', price: 14.99, isAvailable: true, preparationTime: 20 },
    { restaurantId, categoryId: catMap['Pasta'], name: 'Fettuccine Alfredo', description: 'Creamy parmesan sauce', price: 13.99, isAvailable: true, isVegetarian: true, preparationTime: 18 },
    { restaurantId, categoryId: catMap['Pasta'], name: 'Penne Arrabbiata', description: 'Spicy tomato sauce', price: 12.99, isAvailable: true, isVegetarian: true, preparationTime: 18 },
    // Salads
    { restaurantId, categoryId: catMap['Salads'], name: 'Caesar Salad', description: 'Romaine lettuce with Caesar dressing', price: 8.99, isAvailable: true, isVegetarian: true, preparationTime: 10 },
    { restaurantId, categoryId: catMap['Salads'], name: 'Caprese Salad', description: 'Tomatoes, mozzarella, and basil', price: 9.99, isAvailable: true, isVegetarian: true, preparationTime: 10 },
    // Desserts
    { restaurantId, categoryId: catMap['Desserts'], name: 'Tiramisu', description: 'Classic Italian coffee dessert', price: 6.99, isAvailable: true, isVegetarian: true, preparationTime: 5 },
    { restaurantId, categoryId: catMap['Desserts'], name: 'Gelato', description: 'Italian ice cream - various flavors', price: 5.99, isAvailable: true, isVegetarian: true, preparationTime: 5 },
    // Beverages
    { restaurantId, categoryId: catMap['Beverages'], name: 'Coca-Cola', description: 'Classic soft drink', price: 2.99, isAvailable: true, isVegan: true, preparationTime: 2 },
    { restaurantId, categoryId: catMap['Beverages'], name: 'Italian Soda', description: 'Flavored sparkling water', price: 3.99, isAvailable: true, isVegan: true, preparationTime: 3 },
  ]);

  // Tables
  await Table.insertMany(
    Array.from({ length: 10 }, (_, i) => ({
      restaurantId,
      tableNumber: `T${i + 1}`,
      capacity: i % 3 === 0 ? 6 : i % 2 === 0 ? 4 : 2,
      location: i < 3 ? 'Window' : i < 7 ? 'Main Hall' : 'Terrace',
      isActive: true,
      isOccupied: i < 3,
    }))
  );

  // Customers
  const customers = await Customer.insertMany([
    { restaurantId, email: 'john.doe@example.com', password: 'customer123', firstName: 'John', lastName: 'Doe', phone: '+1 555-1001', isActive: true },
    { restaurantId, email: 'jane.smith@example.com', password: 'customer123', firstName: 'Jane', lastName: 'Smith', phone: '+1 555-1002', isActive: true },
    { restaurantId, email: 'mike.jones@example.com', password: 'customer123', firstName: 'Mike', lastName: 'Jones', phone: '+1 555-1003', isActive: true },
    { restaurantId, email: 'sarah.wilson@example.com', password: 'customer123', firstName: 'Sarah', lastName: 'Wilson', phone: '+1 555-1004', isActive: true },
    { restaurantId, email: 'tom.brown@example.com', password: 'customer123', firstName: 'Tom', lastName: 'Brown', phone: '+1 555-1005', isActive: true },
  ]);

  // Orders
  const tables = await Table.find({ restaurantId });
  const menuItems = await MenuItem.find({ restaurantId });
  const statuses: Array<'received' | 'preparing' | 'ready' | 'served' | 'cancelled'> = ['received', 'preparing', 'ready', 'served', 'cancelled'];

  for (let i = 0; i < 12; i++) {
    const randomTable = tables[Math.floor(Math.random() * tables.length)];
    const randomCustomer = customers[Math.floor(Math.random() * customers.length)];
    const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
    const itemCount = Math.floor(Math.random() * 3) + 1;

    const orderItems = [];
    let subtotal = 0;

    for (let j = 0; j < itemCount; j++) {
      const randomItem = menuItems[Math.floor(Math.random() * menuItems.length)];
      const quantity = Math.floor(Math.random() * 2) + 1;
      const itemSubtotal = randomItem.price * quantity;

      orderItems.push({
        menuItemId: randomItem._id,
        name: randomItem.name,
        price: randomItem.price,
        quantity,
        subtotal: itemSubtotal,
      });

      subtotal += itemSubtotal;
    }

    const tax = subtotal * 0.085;
    const total = subtotal + tax;

    await Order.create({
      restaurantId,
      tableId: randomTable._id,
      tableNumber: randomTable.tableNumber,
      customerId: randomCustomer._id,
      items: orderItems,
      subtotal,
      tax,
      total,
      status: randomStatus,
      statusHistory: [{ status: randomStatus, timestamp: new Date() }],
      createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
    });
  }

  console.log('      ✓ Pizza Palace seeded');
}

// Seed Burger Barn
async function seedBurgerBarn(restaurantId: mongoose.Types.ObjectId) {
  console.log('   🍔 Seeding Burger Barn...');

  const categories = await Category.insertMany([
    { restaurantId, name: 'Burgers', description: 'Juicy flame-grilled burgers', displayOrder: 1, isActive: true },
    { restaurantId, name: 'Chicken', description: 'Crispy chicken sandwiches', displayOrder: 2, isActive: true },
    { restaurantId, name: 'Sides', description: 'Fries and more', displayOrder: 3, isActive: true },
    { restaurantId, name: 'Salads', description: 'Fresh and healthy', displayOrder: 4, isActive: true },
    { restaurantId, name: 'Desserts', description: 'Sweet treats', displayOrder: 5, isActive: true },
    { restaurantId, name: 'Drinks', description: 'Cold beverages', displayOrder: 6, isActive: true },
  ]);

  const catMap: any = {};
  categories.forEach(cat => catMap[cat.name] = cat._id);

  await MenuItem.insertMany([
    // Burgers
    { restaurantId, categoryId: catMap['Burgers'], name: 'Classic Burger', description: 'Beef patty, lettuce, tomato, onion', price: 8.99, isAvailable: true, preparationTime: 12 },
    { restaurantId, categoryId: catMap['Burgers'], name: 'Cheeseburger', description: 'Classic burger with cheese', price: 9.99, isAvailable: true, preparationTime: 12 },
    { restaurantId, categoryId: catMap['Burgers'], name: 'Bacon Burger', description: 'Burger with crispy bacon', price: 11.99, isAvailable: true, preparationTime: 15 },
    { restaurantId, categoryId: catMap['Burgers'], name: 'Double Burger', description: 'Two beef patties with cheese', price: 13.99, isAvailable: true, preparationTime: 15 },
    { restaurantId, categoryId: catMap['Burgers'], name: 'Veggie Burger', description: 'Plant-based patty', price: 10.99, isAvailable: true, isVegetarian: true, preparationTime: 12 },
    // Chicken
    { restaurantId, categoryId: catMap['Chicken'], name: 'Crispy Chicken Sandwich', description: 'Breaded chicken with mayo', price: 9.99, isAvailable: true, preparationTime: 12 },
    { restaurantId, categoryId: catMap['Chicken'], name: 'Spicy Chicken', description: 'Spicy breaded chicken', price: 10.99, isAvailable: true, preparationTime: 12 },
    { restaurantId, categoryId: catMap['Chicken'], name: 'Grilled Chicken Sandwich', description: 'Grilled chicken breast', price: 10.49, isAvailable: true, preparationTime: 12 },
    // Sides
    { restaurantId, categoryId: catMap['Sides'], name: 'French Fries', description: 'Crispy golden fries', price: 3.99, isAvailable: true, isVegetarian: true, preparationTime: 8 },
    { restaurantId, categoryId: catMap['Sides'], name: 'Onion Rings', description: 'Battered onion rings', price: 4.99, isAvailable: true, isVegetarian: true, preparationTime: 10 },
    { restaurantId, categoryId: catMap['Sides'], name: 'Loaded Fries', description: 'Fries with cheese and bacon', price: 6.99, isAvailable: true, preparationTime: 10 },
    // Salads
    { restaurantId, categoryId: catMap['Salads'], name: 'Garden Salad', description: 'Mixed greens with vegetables', price: 7.99, isAvailable: true, isVegetarian: true, isVegan: true, preparationTime: 8 },
    { restaurantId, categoryId: catMap['Salads'], name: 'Chicken Salad', description: 'Grilled chicken on greens', price: 10.99, isAvailable: true, preparationTime: 10 },
    // Desserts
    { restaurantId, categoryId: catMap['Desserts'], name: 'Chocolate Shake', description: 'Thick chocolate milkshake', price: 5.99, isAvailable: true, isVegetarian: true, preparationTime: 5 },
    { restaurantId, categoryId: catMap['Desserts'], name: 'Apple Pie', description: 'Warm apple pie', price: 4.99, isAvailable: true, isVegetarian: true, preparationTime: 5 },
    // Drinks
    { restaurantId, categoryId: catMap['Drinks'], name: 'Soda', description: 'Various flavors', price: 2.49, isAvailable: true, isVegan: true, preparationTime: 2 },
    { restaurantId, categoryId: catMap['Drinks'], name: 'Iced Tea', description: 'Fresh brewed iced tea', price: 2.99, isAvailable: true, isVegan: true, preparationTime: 2 },
  ]);

  await Table.insertMany(
    Array.from({ length: 10 }, (_, i) => ({
      restaurantId,
      tableNumber: `B${i + 1}`,
      capacity: i % 3 === 0 ? 6 : i % 2 === 0 ? 4 : 2,
      location: i < 5 ? 'Indoor' : 'Outdoor',
      isActive: true,
      isOccupied: i < 2,
    }))
  );

  const customers = await Customer.insertMany([
    { restaurantId, email: 'alex.johnson@example.com', password: 'customer123', firstName: 'Alex', lastName: 'Johnson', phone: '+1 555-2001', isActive: true },
    { restaurantId, email: 'emily.davis@example.com', password: 'customer123', firstName: 'Emily', lastName: 'Davis', phone: '+1 555-2002', isActive: true },
    { restaurantId, email: 'chris.martin@example.com', password: 'customer123', firstName: 'Chris', lastName: 'Martin', phone: '+1 555-2003', isActive: true },
    { restaurantId, email: 'lisa.anderson@example.com', password: 'customer123', firstName: 'Lisa', lastName: 'Anderson', phone: '+1 555-2004', isActive: true },
    { restaurantId, email: 'david.lee@example.com', password: 'customer123', firstName: 'David', lastName: 'Lee', phone: '+1 555-2005', isActive: true },
  ]);

  const tables = await Table.find({ restaurantId });
  const menuItems = await MenuItem.find({ restaurantId });
  const statuses: Array<'received' | 'preparing' | 'ready' | 'served' | 'cancelled'> = ['received', 'preparing', 'ready', 'served', 'cancelled'];

  for (let i = 0; i < 10; i++) {
    const randomTable = tables[Math.floor(Math.random() * tables.length)];
    const randomCustomer = customers[Math.floor(Math.random() * customers.length)];
    const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
    const itemCount = Math.floor(Math.random() * 3) + 1;

    const orderItems = [];
    let subtotal = 0;

    for (let j = 0; j < itemCount; j++) {
      const randomItem = menuItems[Math.floor(Math.random() * menuItems.length)];
      const quantity = Math.floor(Math.random() * 2) + 1;
      const itemSubtotal = randomItem.price * quantity;

      orderItems.push({
        menuItemId: randomItem._id,
        name: randomItem.name,
        price: randomItem.price,
        quantity,
        subtotal: itemSubtotal,
      });

      subtotal += itemSubtotal;
    }

    const tax = subtotal * 0.095;
    const total = subtotal + tax;

    await Order.create({
      restaurantId,
      tableId: randomTable._id,
      tableNumber: randomTable.tableNumber,
      customerId: randomCustomer._id,
      items: orderItems,
      subtotal,
      tax,
      total,
      status: randomStatus,
      statusHistory: [{ status: randomStatus, timestamp: new Date() }],
      createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
    });
  }

  console.log('      ✓ Burger Barn seeded');
}

// Seed Sushi Spot
async function seedSushiSpot(restaurantId: mongoose.Types.ObjectId) {
  console.log('   🍣 Seeding Sushi Spot...');

  const categories = await Category.insertMany([
    { restaurantId, name: 'Nigiri', description: 'Hand-pressed sushi', displayOrder: 1, isActive: true },
    { restaurantId, name: 'Rolls', description: 'Sushi rolls', displayOrder: 2, isActive: true },
    { restaurantId, name: 'Sashimi', description: 'Fresh raw fish', displayOrder: 3, isActive: true },
    { restaurantId, name: 'Appetizers', description: 'Japanese starters', displayOrder: 4, isActive: true },
    { restaurantId, name: 'Desserts', description: 'Japanese sweets', displayOrder: 5, isActive: true },
    { restaurantId, name: 'Beverages', description: 'Japanese drinks', displayOrder: 6, isActive: true },
  ]);

  const catMap: any = {};
  categories.forEach(cat => catMap[cat.name] = cat._id);

  await MenuItem.insertMany([
    // Nigiri
    { restaurantId, categoryId: catMap['Nigiri'], name: 'Salmon Nigiri', description: 'Fresh salmon on rice', price: 4.99, isAvailable: true, preparationTime: 8 },
    { restaurantId, categoryId: catMap['Nigiri'], name: 'Tuna Nigiri', description: 'Fresh tuna on rice', price: 5.99, isAvailable: true, preparationTime: 8 },
    { restaurantId, categoryId: catMap['Nigiri'], name: 'Eel Nigiri', description: 'Grilled eel on rice', price: 6.99, isAvailable: true, preparationTime: 10 },
    { restaurantId, categoryId: catMap['Nigiri'], name: 'Shrimp Nigiri', description: 'Cooked shrimp on rice', price: 4.49, isAvailable: true, preparationTime: 8 },
    // Rolls
    { restaurantId, categoryId: catMap['Rolls'], name: 'California Roll', description: 'Crab, avocado, cucumber', price: 8.99, isAvailable: true, preparationTime: 12 },
    { restaurantId, categoryId: catMap['Rolls'], name: 'Spicy Tuna Roll', description: 'Tuna with spicy mayo', price: 10.99, isAvailable: true, preparationTime: 12 },
    { restaurantId, categoryId: catMap['Rolls'], name: 'Dragon Roll', description: 'Eel and avocado', price: 14.99, isAvailable: true, preparationTime: 15 },
    { restaurantId, categoryId: catMap['Rolls'], name: 'Philadelphia Roll', description: 'Salmon, cream cheese, cucumber', price: 11.99, isAvailable: true, preparationTime: 12 },
    { restaurantId, categoryId: catMap['Rolls'], name: 'Veggie Roll', description: 'Cucumber, avocado, carrot', price: 7.99, isAvailable: true, isVegetarian: true, isVegan: true, preparationTime: 10 },
    // Sashimi
    { restaurantId, categoryId: catMap['Sashimi'], name: 'Salmon Sashimi', description: '5 pieces of fresh salmon', price: 12.99, isAvailable: true, preparationTime: 10 },
    { restaurantId, categoryId: catMap['Sashimi'], name: 'Tuna Sashimi', description: '5 pieces of fresh tuna', price: 14.99, isAvailable: true, preparationTime: 10 },
    { restaurantId, categoryId: catMap['Sashimi'], name: 'Assorted Sashimi', description: 'Chef\'s selection of 9 pieces', price: 18.99, isAvailable: true, preparationTime: 12 },
    // Appetizers
    { restaurantId, categoryId: catMap['Appetizers'], name: 'Edamame', description: 'Steamed soybeans', price: 5.99, isAvailable: true, isVegetarian: true, isVegan: true, preparationTime: 8 },
    { restaurantId, categoryId: catMap['Appetizers'], name: 'Gyoza', description: 'Pan-fried dumplings', price: 7.99, isAvailable: true, preparationTime: 10 },
    { restaurantId, categoryId: catMap['Appetizers'], name: 'Miso Soup', description: 'Traditional Japanese soup', price: 3.99, isAvailable: true, isVegetarian: true, preparationTime: 5 },
    // Desserts
    { restaurantId, categoryId: catMap['Desserts'], name: 'Mochi Ice Cream', description: 'Japanese ice cream dessert', price: 6.99, isAvailable: true, isVegetarian: true, preparationTime: 5 },
    { restaurantId, categoryId: catMap['Desserts'], name: 'Green Tea Cheesecake', description: 'Matcha flavored cheesecake', price: 7.99, isAvailable: true, isVegetarian: true, preparationTime: 5 },
    // Beverages
    { restaurantId, categoryId: catMap['Beverages'], name: 'Green Tea', description: 'Hot or iced', price: 2.99, isAvailable: true, isVegan: true, preparationTime: 3 },
    { restaurantId, categoryId: catMap['Beverages'], name: 'Sake', description: 'Japanese rice wine', price: 8.99, isAvailable: true, isVegan: true, preparationTime: 3 },
  ]);

  await Table.insertMany(
    Array.from({ length: 10 }, (_, i) => ({
      restaurantId,
      tableNumber: `S${i + 1}`,
      capacity: i % 3 === 0 ? 6 : i % 2 === 0 ? 4 : 2,
      location: i < 4 ? 'Sushi Bar' : i < 8 ? 'Main Dining' : 'Private Room',
      isActive: true,
      isOccupied: i < 2,
    }))
  );

  const customers = await Customer.insertMany([
    { restaurantId, email: 'kenji.sato@example.com', password: 'customer123', firstName: 'Kenji', lastName: 'Sato', phone: '+1 555-3001', isActive: true },
    { restaurantId, email: 'maya.kim@example.com', password: 'customer123', firstName: 'Maya', lastName: 'Kim', phone: '+1 555-3002', isActive: true },
    { restaurantId, email: 'ryan.chen@example.com', password: 'customer123', firstName: 'Ryan', lastName: 'Chen', phone: '+1 555-3003', isActive: true },
    { restaurantId, email: 'sophia.wang@example.com', password: 'customer123', firstName: 'Sophia', lastName: 'Wang', phone: '+1 555-3004', isActive: true },
    { restaurantId, email: 'james.park@example.com', password: 'customer123', firstName: 'James', lastName: 'Park', phone: '+1 555-3005', isActive: true },
  ]);

  const tables = await Table.find({ restaurantId });
  const menuItems = await MenuItem.find({ restaurantId });
  const statuses: Array<'received' | 'preparing' | 'ready' | 'served' | 'cancelled'> = ['received', 'preparing', 'ready', 'served', 'cancelled'];

  for (let i = 0; i < 15; i++) {
    const randomTable = tables[Math.floor(Math.random() * tables.length)];
    const randomCustomer = customers[Math.floor(Math.random() * customers.length)];
    const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
    const itemCount = Math.floor(Math.random() * 4) + 1;

    const orderItems = [];
    let subtotal = 0;

    for (let j = 0; j < itemCount; j++) {
      const randomItem = menuItems[Math.floor(Math.random() * menuItems.length)];
      const quantity = Math.floor(Math.random() * 2) + 1;
      const itemSubtotal = randomItem.price * quantity;

      orderItems.push({
        menuItemId: randomItem._id,
        name: randomItem.name,
        price: randomItem.price,
        quantity,
        subtotal: itemSubtotal,
      });

      subtotal += itemSubtotal;
    }

    const tax = subtotal * 0.101;
    const total = subtotal + tax;

    await Order.create({
      restaurantId,
      tableId: randomTable._id,
      tableNumber: randomTable.tableNumber,
      customerId: randomCustomer._id,
      items: orderItems,
      subtotal,
      tax,
      total,
      status: randomStatus,
      statusHistory: [{ status: randomStatus, timestamp: new Date() }],
      createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
    });
  }

  console.log('      ✓ Sushi Spot seeded');
}

// Export for use in other scripts
export default seedMultiTenant;

// Run if executed directly
if (require.main === module) {
  seedMultiTenant()
    .then(() => {
      console.log('✨ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Script failed:', error);
      process.exit(1);
    });
}
