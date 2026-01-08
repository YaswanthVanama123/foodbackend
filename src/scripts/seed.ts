import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Admin from '../models/Admin';
import Category from '../models/Category';
import MenuItem from '../models/MenuItem';
import Table from '../models/Table';
import connectDB from '../config/database';

dotenv.config();

const seedDatabase = async () => {
  try {
    await connectDB();

    console.log('Starting database seed...\n');

    // Clear existing data
    console.log('Clearing existing data...');
    await Admin.deleteMany({});
    await Category.deleteMany({});
    await MenuItem.deleteMany({});
    await Table.deleteMany({});

    // Create admin user
    console.log('Creating admin user...');
    const admin = await Admin.create({
      username: 'admin',
      email: 'admin@patlinks.com',
      password: 'admin123',
      role: 'admin',
    });
    console.log('✓ Admin created:', admin.username);

    // Create categories
    console.log('\nCreating categories...');
    const categories = await Category.insertMany([
      { name: 'Appetizers', description: 'Start your meal right', displayOrder: 1 },
      { name: 'Burgers', description: 'Classic American burgers', displayOrder: 2 },
      { name: 'Sandwiches', description: 'Hearty sandwiches', displayOrder: 3 },
      { name: 'Entrees', description: 'Main course dishes', displayOrder: 4 },
      { name: 'Salads', description: 'Fresh and healthy', displayOrder: 5 },
      { name: 'Desserts', description: 'Sweet endings', displayOrder: 6 },
      { name: 'Beverages', description: 'Drinks and refreshments', displayOrder: 7 },
    ]);
    console.log('✓ Created', categories.length, 'categories');

    // Get category IDs
    const appetizers = categories.find((c) => c.name === 'Appetizers')!;
    const burgers = categories.find((c) => c.name === 'Burgers')!;
    const sandwiches = categories.find((c) => c.name === 'Sandwiches')!;
    const entrees = categories.find((c) => c.name === 'Entrees')!;
    const salads = categories.find((c) => c.name === 'Salads')!;
    const desserts = categories.find((c) => c.name === 'Desserts')!;
    const beverages = categories.find((c) => c.name === 'Beverages')!;

    // Create menu items
    console.log('\nCreating menu items...');
    const menuItems = await MenuItem.insertMany([
      // Appetizers
      {
        name: 'Mozzarella Sticks',
        description: 'Crispy breaded mozzarella with marinara sauce',
        categoryId: appetizers._id,
        price: 8.99,
        isVegetarian: true,
        preparationTime: 10,
      },
      {
        name: 'Buffalo Wings',
        description: 'Spicy chicken wings with blue cheese dressing',
        categoryId: appetizers._id,
        price: 12.99,
        preparationTime: 15,
        customizationOptions: [
          {
            name: 'Sauce Level',
            type: 'single',
            required: true,
            options: [
              { label: 'Mild', priceModifier: 0 },
              { label: 'Medium', priceModifier: 0 },
              { label: 'Hot', priceModifier: 0 },
              { label: 'Extra Hot', priceModifier: 0 },
            ],
          },
        ],
      },
      {
        name: 'Onion Rings',
        description: 'Golden fried onion rings with ranch dressing',
        categoryId: appetizers._id,
        price: 7.99,
        isVegetarian: true,
        preparationTime: 8,
      },
      {
        name: 'Nachos Supreme',
        description: 'Tortilla chips with cheese, jalapeños, sour cream, and guacamole',
        categoryId: appetizers._id,
        price: 11.99,
        isVegetarian: true,
        preparationTime: 12,
      },
      {
        name: 'Spinach Artichoke Dip',
        description: 'Creamy dip served with tortilla chips',
        categoryId: appetizers._id,
        price: 9.99,
        isVegetarian: true,
        preparationTime: 10,
      },

      // Burgers
      {
        name: 'Classic Cheeseburger',
        description: 'Beef patty with cheese, lettuce, tomato, and pickles',
        categoryId: burgers._id,
        price: 13.99,
        preparationTime: 15,
        customizationOptions: [
          {
            name: 'Cooking Level',
            type: 'single',
            required: true,
            options: [
              { label: 'Rare', priceModifier: 0 },
              { label: 'Medium Rare', priceModifier: 0 },
              { label: 'Medium', priceModifier: 0 },
              { label: 'Well Done', priceModifier: 0 },
            ],
          },
          {
            name: 'Add-ons',
            type: 'multiple',
            required: false,
            options: [
              { label: 'Extra Cheese', priceModifier: 1.5 },
              { label: 'Bacon', priceModifier: 2.0 },
              { label: 'Avocado', priceModifier: 2.0 },
              { label: 'Fried Egg', priceModifier: 1.5 },
            ],
          },
        ],
      },
      {
        name: 'Bacon Burger',
        description: 'Beef patty with bacon, cheese, and BBQ sauce',
        categoryId: burgers._id,
        price: 15.99,
        preparationTime: 15,
      },
      {
        name: 'Mushroom Swiss Burger',
        description: 'Beef patty with sautéed mushrooms and Swiss cheese',
        categoryId: burgers._id,
        price: 14.99,
        preparationTime: 15,
      },
      {
        name: 'BBQ Burger',
        description: 'Beef patty with BBQ sauce, onion rings, and cheddar',
        categoryId: burgers._id,
        price: 15.49,
        preparationTime: 15,
      },

      // Sandwiches
      {
        name: 'Club Sandwich',
        description: 'Triple-decker with turkey, bacon, lettuce, and tomato',
        categoryId: sandwiches._id,
        price: 12.99,
        preparationTime: 12,
      },
      {
        name: 'Philly Cheesesteak',
        description: 'Sliced beef with peppers, onions, and melted cheese',
        categoryId: sandwiches._id,
        price: 14.99,
        preparationTime: 15,
      },
      {
        name: 'BLT',
        description: 'Classic bacon, lettuce, and tomato on toasted bread',
        categoryId: sandwiches._id,
        price: 10.99,
        preparationTime: 10,
      },
      {
        name: 'Grilled Chicken Sandwich',
        description: 'Marinated chicken breast with lettuce and mayo',
        categoryId: sandwiches._id,
        price: 13.49,
        preparationTime: 15,
      },

      // Entrees
      {
        name: 'Grilled Salmon',
        description: 'Fresh Atlantic salmon with lemon butter sauce',
        categoryId: entrees._id,
        price: 22.99,
        isGlutenFree: true,
        preparationTime: 20,
      },
      {
        name: 'NY Strip Steak',
        description: '12oz premium cut with garlic butter',
        categoryId: entrees._id,
        price: 28.99,
        isGlutenFree: true,
        preparationTime: 25,
        customizationOptions: [
          {
            name: 'Cooking Level',
            type: 'single',
            required: true,
            options: [
              { label: 'Rare', priceModifier: 0 },
              { label: 'Medium Rare', priceModifier: 0 },
              { label: 'Medium', priceModifier: 0 },
              { label: 'Well Done', priceModifier: 0 },
            ],
          },
        ],
      },
      {
        name: 'Chicken Parmesan',
        description: 'Breaded chicken breast with marinara and mozzarella',
        categoryId: entrees._id,
        price: 18.99,
        preparationTime: 20,
      },
      {
        name: 'Baby Back Ribs',
        description: 'Tender ribs with BBQ sauce',
        categoryId: entrees._id,
        price: 24.99,
        preparationTime: 30,
      },

      // Salads
      {
        name: 'Caesar Salad',
        description: 'Romaine lettuce with Caesar dressing and croutons',
        categoryId: salads._id,
        price: 9.99,
        isVegetarian: true,
        preparationTime: 8,
        customizationOptions: [
          {
            name: 'Add Protein',
            type: 'single',
            required: false,
            options: [
              { label: 'Grilled Chicken', priceModifier: 4.0 },
              { label: 'Grilled Salmon', priceModifier: 6.0 },
              { label: 'Grilled Shrimp', priceModifier: 5.0 },
            ],
          },
        ],
      },
      {
        name: 'Cobb Salad',
        description: 'Mixed greens with bacon, egg, avocado, and blue cheese',
        categoryId: salads._id,
        price: 13.99,
        isGlutenFree: true,
        preparationTime: 10,
      },
      {
        name: 'Greek Salad',
        description: 'Fresh vegetables with feta cheese and olives',
        categoryId: salads._id,
        price: 11.99,
        isVegetarian: true,
        isGlutenFree: true,
        preparationTime: 8,
      },
      {
        name: 'House Salad',
        description: 'Mixed greens with your choice of dressing',
        categoryId: salads._id,
        price: 7.99,
        isVegetarian: true,
        isVegan: true,
        isGlutenFree: true,
        preparationTime: 5,
      },

      // Desserts
      {
        name: 'New York Cheesecake',
        description: 'Classic creamy cheesecake with graham cracker crust',
        categoryId: desserts._id,
        price: 7.99,
        isVegetarian: true,
        preparationTime: 5,
      },
      {
        name: 'Chocolate Lava Cake',
        description: 'Warm chocolate cake with molten center',
        categoryId: desserts._id,
        price: 8.99,
        isVegetarian: true,
        preparationTime: 10,
      },
      {
        name: 'Apple Pie',
        description: 'Homemade apple pie with vanilla ice cream',
        categoryId: desserts._id,
        price: 6.99,
        isVegetarian: true,
        preparationTime: 8,
      },
      {
        name: 'Ice Cream Sundae',
        description: 'Three scoops with toppings and whipped cream',
        categoryId: desserts._id,
        price: 5.99,
        isVegetarian: true,
        preparationTime: 5,
      },

      // Beverages
      {
        name: 'Soft Drinks',
        description: 'Coke, Sprite, Fanta, or Root Beer',
        categoryId: beverages._id,
        price: 2.99,
        isVegetarian: true,
        isVegan: true,
        preparationTime: 2,
      },
      {
        name: 'Iced Tea',
        description: 'Freshly brewed sweet or unsweet',
        categoryId: beverages._id,
        price: 2.99,
        isVegetarian: true,
        isVegan: true,
        preparationTime: 2,
      },
      {
        name: 'Lemonade',
        description: 'Fresh squeezed lemonade',
        categoryId: beverages._id,
        price: 3.49,
        isVegetarian: true,
        isVegan: true,
        preparationTime: 2,
      },
      {
        name: 'Coffee',
        description: 'Regular or decaf',
        categoryId: beverages._id,
        price: 2.49,
        isVegetarian: true,
        isVegan: true,
        preparationTime: 2,
      },
      {
        name: 'Milkshake',
        description: 'Vanilla, chocolate, or strawberry',
        categoryId: beverages._id,
        price: 5.99,
        isVegetarian: true,
        preparationTime: 5,
      },
    ]);
    console.log('✓ Created', menuItems.length, 'menu items');

    // Create tables
    console.log('\nCreating tables...');
    const tables = await Table.insertMany([
      { tableNumber: '1', capacity: 2, location: 'Window Side' },
      { tableNumber: '2', capacity: 2, location: 'Window Side' },
      { tableNumber: '3', capacity: 4, location: 'Center' },
      { tableNumber: '4', capacity: 4, location: 'Center' },
      { tableNumber: '5', capacity: 4, location: 'Corner' },
      { tableNumber: '6', capacity: 6, location: 'Center' },
      { tableNumber: '7', capacity: 6, location: 'Back' },
      { tableNumber: '8', capacity: 2, location: 'Bar Area' },
      { tableNumber: '9', capacity: 2, location: 'Bar Area' },
      { tableNumber: '10', capacity: 8, location: 'Private Room' },
    ]);
    console.log('✓ Created', tables.length, 'tables');

    console.log('\n✓ Database seeded successfully!');
    console.log('\nDefault admin credentials:');
    console.log('  Username: admin');
    console.log('  Password: admin123');
    console.log('\n⚠️  Remember to change these credentials in production!\n');

    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();
