import dotenv from 'dotenv';
import mongoose from 'mongoose';
import SuperAdmin from '../models/SuperAdmin';
import Restaurant from '../models/Restaurant';
import Admin from '../models/Admin';
import Category from '../models/Category';
import MenuItem from '../models/MenuItem';
import Table from '../models/Table';
import Order from '../models/Order';
import connectDB from '../config/database';

dotenv.config();

/**
 * Multi-Tenant Seed Script
 *
 * Creates complete demo data for all 3 frontend apps:
 * 1. Super Admin App - Platform management
 * 2. Restaurant Admin App - Restaurant management
 * 3. User App - Customer ordering
 *
 * Creates:
 * - 1 Super Admin
 * - 3 Demo Restaurants (pizzahut, burgerking, tacobell)
 * - Admins for each restaurant
 * - Full menu data for each restaurant
 * - Tables for each restaurant
 * - Sample orders
 */

const seedMultiTenant = async () => {
  try {
    await connectDB();

    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║                                                           ║');
    console.log('║   🌱 Multi-Tenant Seed Script                            ║');
    console.log('║   Patlinks Food Ordering System                           ║');
    console.log('║                                                           ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    // STEP 1: Create Super Admin
    console.log('1️⃣  Creating Super Admin...');
    await SuperAdmin.deleteMany({});

    const superAdmin = await SuperAdmin.create({
      username: 'superadmin',
      email: 'superadmin@patlinks.com',
      password: 'SuperAdmin@123',
      firstName: 'Platform',
      lastName: 'Administrator',
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
    console.log('   ✓ Super Admin created:', superAdmin.username);

    // STEP 2: Create Restaurants
    console.log('\n2️⃣  Creating Restaurants...');
    await Restaurant.deleteMany({});

    const restaurants = await Restaurant.insertMany([
      {
        subdomain: 'pizzahut',
        name: 'Pizza Hut Demo',
        slug: 'pizzahut-demo',
        email: 'contact@pizzahut-demo.com',
        phone: '+1-555-0101',
        address: {
          street: '123 Pizza Street',
          city: 'New York',
          state: 'NY',
          zipCode: '10001',
          country: 'US',
        },
        branding: {
          logo: '',
          primaryColor: '#E60000',
          secondaryColor: '#FFFFFF',
          accentColor: '#FFD700',
          fontFamily: 'Arial',
          theme: 'light',
        },
        settings: {
          currency: 'USD',
          taxRate: 8.875,
          serviceChargeRate: 0,
          timezone: 'America/New_York',
          locale: 'en-US',
          orderNumberPrefix: 'PH',
        },
        subscription: {
          plan: 'pro',
          status: 'active',
          startDate: new Date(),
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          billingCycle: 'monthly',
          maxTables: 50,
          maxMenuItems: 200,
          maxAdmins: 10,
        },
        isActive: true,
        isOnboarded: true,
        onboardingStep: 10,
        createdBy: superAdmin._id,
      },
      {
        subdomain: 'burgerking',
        name: 'Burger King Demo',
        slug: 'burgerking-demo',
        email: 'contact@burgerking-demo.com',
        phone: '+1-555-0102',
        address: {
          street: '456 Burger Avenue',
          city: 'Los Angeles',
          state: 'CA',
          zipCode: '90001',
          country: 'US',
        },
        branding: {
          logo: '',
          primaryColor: '#512F2E',
          secondaryColor: '#F59E0B',
          accentColor: '#EF4444',
          fontFamily: 'Verdana',
          theme: 'light',
        },
        settings: {
          currency: 'USD',
          taxRate: 9.5,
          serviceChargeRate: 0,
          timezone: 'America/Los_Angeles',
          locale: 'en-US',
          orderNumberPrefix: 'BK',
        },
        subscription: {
          plan: 'basic',
          status: 'active',
          startDate: new Date(),
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          billingCycle: 'monthly',
          maxTables: 30,
          maxMenuItems: 100,
          maxAdmins: 5,
        },
        isActive: true,
        isOnboarded: true,
        onboardingStep: 10,
        createdBy: superAdmin._id,
      },
      {
        subdomain: 'tacobell',
        name: 'Taco Bell Demo',
        slug: 'tacobell-demo',
        email: 'contact@tacobell-demo.com',
        phone: '+1-555-0103',
        address: {
          street: '789 Taco Boulevard',
          city: 'Austin',
          state: 'TX',
          zipCode: '78701',
          country: 'US',
        },
        branding: {
          logo: '',
          primaryColor: '#702082',
          secondaryColor: '#FFC900',
          accentColor: '#EC008C',
          fontFamily: 'Helvetica',
          theme: 'light',
        },
        settings: {
          currency: 'USD',
          taxRate: 8.25,
          serviceChargeRate: 0,
          timezone: 'America/Chicago',
          locale: 'en-US',
          orderNumberPrefix: 'TB',
        },
        subscription: {
          plan: 'trial',
          status: 'active',
          startDate: new Date(),
          endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          billingCycle: 'monthly',
          maxTables: 20,
          maxMenuItems: 50,
          maxAdmins: 3,
        },
        isActive: true,
        isOnboarded: true,
        onboardingStep: 10,
        createdBy: superAdmin._id,
      },
    ]);
    console.log(`   ✓ Created ${restaurants.length} restaurants`);

    const [pizzahut, burgerking, tacobell] = restaurants;

    // STEP 3: Create Admins for each restaurant
    console.log('\n3️⃣  Creating Restaurant Admins...');
    await Admin.deleteMany({});

    const admins = await Admin.insertMany([
      {
        restaurantId: pizzahut._id,
        username: 'pizzahut_admin',
        email: 'admin@pizzahut-demo.com',
        password: 'Pizza@123',
        firstName: 'John',
        lastName: 'Pizza',
        role: 'admin',
        permissions: [],
        isActive: true,
      },
      {
        restaurantId: burgerking._id,
        username: 'burgerking_admin',
        email: 'admin@burgerking-demo.com',
        password: 'Burger@123',
        firstName: 'Mike',
        lastName: 'Burger',
        role: 'admin',
        permissions: [],
        isActive: true,
      },
      {
        restaurantId: tacobell._id,
        username: 'tacobell_admin',
        email: 'admin@tacobell-demo.com',
        password: 'Taco@123',
        firstName: 'Sarah',
        lastName: 'Taco',
        role: 'admin',
        permissions: [],
        isActive: true,
      },
    ]);
    console.log(`   ✓ Created ${admins.length} restaurant admins`);

    // STEP 4: Seed Pizza Hut
    console.log('\n4️⃣  Seeding Pizza Hut...');
    const pizzaHutData = await seedRestaurant(pizzahut._id, 'pizzahut');
    console.log(`   ✓ Pizza Hut: ${pizzaHutData.categories} categories, ${pizzaHutData.menuItems} items, ${pizzaHutData.tables} tables`);

    // STEP 5: Seed Burger King
    console.log('\n5️⃣  Seeding Burger King...');
    const burgerKingData = await seedRestaurant(burgerking._id, 'burgerking');
    console.log(`   ✓ Burger King: ${burgerKingData.categories} categories, ${burgerKingData.menuItems} items, ${burgerKingData.tables} tables`);

    // STEP 6: Seed Taco Bell
    console.log('\n6️⃣  Seeding Taco Bell...');
    const tacoBellData = await seedRestaurant(tacobell._id, 'tacobell');
    console.log(`   ✓ Taco Bell: ${tacoBellData.categories} categories, ${tacoBellData.menuItems} items, ${tacoBellData.tables} tables`);

    // STEP 7: Display Summary
    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║                                                           ║');
    console.log('║   ✅ Multi-Tenant Seed Completed Successfully!           ║');
    console.log('║                                                           ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    console.log('🔐 Super Admin Credentials:');
    console.log('   Endpoint: POST http://localhost:5000/api/super-admin/auth/login');
    console.log('   Username: superadmin');
    console.log('   Password: SuperAdmin@123\n');

    console.log('🏪 Restaurant Admin Credentials:\n');
    console.log('   Pizza Hut:');
    console.log('   - Subdomain: pizzahut.localhost:5000');
    console.log('   - Username: pizzahut_admin');
    console.log('   - Password: Pizza@123\n');

    console.log('   Burger King:');
    console.log('   - Subdomain: burgerking.localhost:5000');
    console.log('   - Username: burgerking_admin');
    console.log('   - Password: Burger@123\n');

    console.log('   Taco Bell:');
    console.log('   - Subdomain: tacobell.localhost:5000');
    console.log('   - Username: tacobell_admin');
    console.log('   - Password: Taco@123\n');

    console.log('👥 User App Access:');
    console.log('   Pizza Hut: http://pizzahut.localhost:5173');
    console.log('   Burger King: http://burgerking.localhost:5173');
    console.log('   Taco Bell: http://tacobell.localhost:5173\n');

    console.log('⚙️  Development Tips:');
    console.log('   - Use x-restaurant-id header for API testing');
    console.log('   - Each restaurant has isolated data');
    console.log('   - Socket.io uses namespaces per restaurant\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
};

// Helper function to seed a restaurant with data
async function seedRestaurant(restaurantId: mongoose.Types.ObjectId, type: 'pizzahut' | 'burgerking' | 'tacobell') {
  // Create categories
  const categoryData = getCategories(type);
  const categories = await Category.insertMany(
    categoryData.map((cat) => ({ ...cat, restaurantId }))
  );

  // Get category IDs
  const categoryMap: Record<string, mongoose.Types.ObjectId> = {};
  categories.forEach((cat) => {
    categoryMap[cat.name] = cat._id;
  });

  // Create menu items
  const menuItemData = getMenuItems(type, categoryMap);
  const menuItems = await MenuItem.insertMany(
    menuItemData.map((item) => ({ ...item, restaurantId }))
  );

  // Create tables
  const tableData = getTables(type);
  const tables = await Table.insertMany(
    tableData.map((table) => ({ ...table, restaurantId }))
  );

  return {
    categories: categories.length,
    menuItems: menuItems.length,
    tables: tables.length,
  };
}

// Category data for each restaurant type
function getCategories(type: string) {
  if (type === 'pizzahut') {
    return [
      { name: 'Pizzas', description: 'Hand-tossed pizzas', displayOrder: 1 },
      { name: 'Sides', description: 'Appetizers and sides', displayOrder: 2 },
      { name: 'Wings', description: 'Chicken wings', displayOrder: 3 },
      { name: 'Pasta', description: 'Italian pasta dishes', displayOrder: 4 },
      { name: 'Desserts', description: 'Sweet treats', displayOrder: 5 },
      { name: 'Drinks', description: 'Beverages', displayOrder: 6 },
    ];
  } else if (type === 'burgerking') {
    return [
      { name: 'Burgers', description: 'Flame-grilled burgers', displayOrder: 1 },
      { name: 'Chicken', description: 'Chicken sandwiches', displayOrder: 2 },
      { name: 'Sides', description: 'Fries and sides', displayOrder: 3 },
      { name: 'Salads', description: 'Fresh salads', displayOrder: 4 },
      { name: 'Desserts', description: 'Sweet endings', displayOrder: 5 },
      { name: 'Beverages', description: 'Drinks', displayOrder: 6 },
    ];
  } else {
    return [
      { name: 'Tacos', description: 'Authentic tacos', displayOrder: 1 },
      { name: 'Burritos', description: 'Loaded burritos', displayOrder: 2 },
      { name: 'Quesadillas', description: 'Grilled quesadillas', displayOrder: 3 },
      { name: 'Sides', description: 'Nachos and more', displayOrder: 4 },
      { name: 'Desserts', description: 'Sweet treats', displayOrder: 5 },
      { name: 'Drinks', description: 'Refreshing beverages', displayOrder: 6 },
    ];
  }
}

// Menu items for each restaurant type
function getMenuItems(type: string, categoryMap: Record<string, mongoose.Types.ObjectId>) {
  if (type === 'pizzahut') {
    return [
      // Pizzas
      {
        name: 'Pepperoni Pizza',
        description: 'Classic pepperoni with mozzarella',
        categoryId: categoryMap['Pizzas'],
        price: 14.99,
        preparationTime: 20,
      },
      {
        name: 'Margherita Pizza',
        description: 'Fresh tomatoes, mozzarella, and basil',
        categoryId: categoryMap['Pizzas'],
        price: 12.99,
        isVegetarian: true,
        preparationTime: 20,
      },
      {
        name: 'Supreme Pizza',
        description: 'Loaded with pepperoni, sausage, peppers, and onions',
        categoryId: categoryMap['Pizzas'],
        price: 17.99,
        preparationTime: 25,
      },
      {
        name: 'Veggie Lovers Pizza',
        description: 'Mushrooms, peppers, onions, olives, and tomatoes',
        categoryId: categoryMap['Pizzas'],
        price: 15.99,
        isVegetarian: true,
        preparationTime: 20,
      },
      // Sides
      {
        name: 'Breadsticks',
        description: 'Garlic breadsticks with marinara sauce',
        categoryId: categoryMap['Sides'],
        price: 6.99,
        isVegetarian: true,
        preparationTime: 10,
      },
      {
        name: 'Mozzarella Sticks',
        description: 'Breaded mozzarella with marinara',
        categoryId: categoryMap['Sides'],
        price: 7.99,
        isVegetarian: true,
        preparationTime: 12,
      },
      // Wings
      {
        name: 'Buffalo Wings',
        description: 'Spicy buffalo chicken wings',
        categoryId: categoryMap['Wings'],
        price: 12.99,
        preparationTime: 18,
      },
      {
        name: 'BBQ Wings',
        description: 'Sweet BBQ glazed wings',
        categoryId: categoryMap['Wings'],
        price: 12.99,
        preparationTime: 18,
      },
      // Drinks
      {
        name: 'Pepsi',
        description: 'Cold Pepsi',
        categoryId: categoryMap['Drinks'],
        price: 2.99,
        isVegan: true,
        preparationTime: 2,
      },
      {
        name: 'Mountain Dew',
        description: 'Cold Mountain Dew',
        categoryId: categoryMap['Drinks'],
        price: 2.99,
        isVegan: true,
        preparationTime: 2,
      },
    ];
  } else if (type === 'burgerking') {
    return [
      // Burgers
      {
        name: 'Whopper',
        description: 'Flame-grilled beef patty with lettuce, tomato, pickles',
        categoryId: categoryMap['Burgers'],
        price: 6.99,
        preparationTime: 12,
      },
      {
        name: 'Double Whopper',
        description: 'Two flame-grilled beef patties',
        categoryId: categoryMap['Burgers'],
        price: 8.99,
        preparationTime: 15,
      },
      {
        name: 'Bacon King',
        description: 'Double patty with bacon and cheese',
        categoryId: categoryMap['Burgers'],
        price: 9.99,
        preparationTime: 15,
      },
      // Chicken
      {
        name: 'Chicken Sandwich',
        description: 'Crispy chicken with lettuce and mayo',
        categoryId: categoryMap['Chicken'],
        price: 6.49,
        preparationTime: 12,
      },
      {
        name: 'Spicy Chicken',
        description: 'Spicy crispy chicken sandwich',
        categoryId: categoryMap['Chicken'],
        price: 6.99,
        preparationTime: 12,
      },
      // Sides
      {
        name: 'French Fries',
        description: 'Crispy golden fries',
        categoryId: categoryMap['Sides'],
        price: 2.99,
        isVegetarian: true,
        preparationTime: 5,
      },
      {
        name: 'Onion Rings',
        description: 'Crispy onion rings',
        categoryId: categoryMap['Sides'],
        price: 3.49,
        isVegetarian: true,
        preparationTime: 7,
      },
      // Beverages
      {
        name: 'Coca-Cola',
        description: 'Cold Coca-Cola',
        categoryId: categoryMap['Beverages'],
        price: 2.49,
        isVegan: true,
        preparationTime: 2,
      },
      {
        name: 'Sprite',
        description: 'Cold Sprite',
        categoryId: categoryMap['Beverages'],
        price: 2.49,
        isVegan: true,
        preparationTime: 2,
      },
    ];
  } else {
    return [
      // Tacos
      {
        name: 'Crunchy Taco',
        description: 'Seasoned beef in a crunchy shell',
        categoryId: categoryMap['Tacos'],
        price: 1.99,
        preparationTime: 8,
      },
      {
        name: 'Soft Taco',
        description: 'Seasoned beef in a soft flour tortilla',
        categoryId: categoryMap['Tacos'],
        price: 1.99,
        preparationTime: 8,
      },
      {
        name: 'Doritos Locos Tacos',
        description: 'Taco in a Doritos shell',
        categoryId: categoryMap['Tacos'],
        price: 2.49,
        preparationTime: 10,
      },
      // Burritos
      {
        name: 'Bean Burrito',
        description: 'Beans, cheese, and red sauce',
        categoryId: categoryMap['Burritos'],
        price: 3.99,
        isVegetarian: true,
        preparationTime: 10,
      },
      {
        name: 'Beef Burrito',
        description: 'Seasoned beef burrito',
        categoryId: categoryMap['Burritos'],
        price: 4.99,
        preparationTime: 12,
      },
      {
        name: 'Burrito Supreme',
        description: 'Loaded with beef, beans, sour cream',
        categoryId: categoryMap['Burritos'],
        price: 5.99,
        preparationTime: 12,
      },
      // Quesadillas
      {
        name: 'Cheese Quesadilla',
        description: 'Grilled flour tortilla with melted cheese',
        categoryId: categoryMap['Quesadillas'],
        price: 4.49,
        isVegetarian: true,
        preparationTime: 10,
      },
      {
        name: 'Chicken Quesadilla',
        description: 'Grilled chicken and cheese',
        categoryId: categoryMap['Quesadillas'],
        price: 5.99,
        preparationTime: 12,
      },
      // Drinks
      {
        name: 'Pepsi',
        description: 'Cold Pepsi',
        categoryId: categoryMap['Drinks'],
        price: 2.29,
        isVegan: true,
        preparationTime: 2,
      },
      {
        name: 'Baja Blast',
        description: 'Mountain Dew Baja Blast',
        categoryId: categoryMap['Drinks'],
        price: 2.49,
        isVegan: true,
        preparationTime: 2,
      },
    ];
  }
}

// Tables for each restaurant
function getTables(type: string) {
  const count = type === 'pizzahut' ? 15 : type === 'burgerking' ? 12 : 10;
  const tables = [];

  for (let i = 1; i <= count; i++) {
    tables.push({
      tableNumber: i.toString(),
      capacity: i % 4 === 0 ? 6 : i % 3 === 0 ? 4 : 2,
      location: i <= count / 3 ? 'Window' : i <= (count * 2) / 3 ? 'Center' : 'Back',
      isActive: true,
      isOccupied: false,
    });
  }

  return tables;
}

// Run seed
seedMultiTenant();
