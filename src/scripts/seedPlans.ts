import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Plan from '../modules/common/models/Plan';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/patlinks';

/**
 * Seed Subscription Plans
 *
 * Creates 3 subscription plans:
 * - Starter: $29/month for small restaurants
 * - Professional: $79/month for growing restaurants
 * - Enterprise: $199/month for large chains
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

async function seedPlans() {
  try {
    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║                                                           ║');
    console.log('║   💳 Seeding Subscription Plans                          ║');
    console.log('║   Patlinks Food Ordering System                           ║');
    console.log('║                                                           ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    await connectDB();

    // Clear existing plans
    console.log('🗑️  Clearing existing plans...');
    const deletedCount = await Plan.deleteMany({});
    console.log(`   ✓ Deleted ${deletedCount.deletedCount} existing plans\n`);

    // Define subscription plans
    const plans = [
      {
        name: 'Free',
        description: 'Perfect for trying out the platform. Get started with basic features at no cost for limited operations.',
        price: 0,
        currency: 'USD',
        billingCycle: 'monthly',
        features: [
          'Up to 5 tables',
          'Up to 20 menu items',
          '1 admin user',
          'Basic order management',
          'Email notifications',
          'Standard support (72h response)',
        ],
        limits: {
          maxTables: 5,
          maxMenuItems: 20,
          maxAdmins: 1,
          maxOrders: 100,
        },
        isActive: true,
        displayOrder: 0,
      },
      {
        name: 'Basic',
        description: 'Perfect for small restaurants just getting started with digital ordering. Includes essential features to manage your restaurant efficiently.',
        price: 29,
        currency: 'USD',
        billingCycle: 'monthly',
        features: [
          'Up to 20 tables',
          'Up to 100 menu items',
          'Up to 3 admin users',
          'Basic order management',
          'Real-time order tracking',
          'Email notifications',
          'Basic analytics dashboard',
          'Standard support (48h response)',
          'Mobile-responsive customer interface',
        ],
        limits: {
          maxTables: 20,
          maxMenuItems: 100,
          maxAdmins: 3,
          maxOrders: -1, // unlimited
        },
        isActive: true,
        displayOrder: 1,
      },
      {
        name: 'Pro',
        description: 'Ideal for growing restaurants that need advanced features and higher limits. Perfect for busy establishments with multiple staff members.',
        price: 79,
        currency: 'USD',
        billingCycle: 'monthly',
        features: [
          'Up to 50 tables',
          'Up to 300 menu items',
          'Up to 10 admin users',
          'All Basic features',
          'Advanced analytics & reports',
          'Kitchen display system',
          'Customer reviews & ratings',
          'Customizable branding',
          'Bulk operations',
          'Priority support (24h response)',
          'SMS notifications',
          'Export data (CSV, Excel)',
          'Inventory tracking',
        ],
        limits: {
          maxTables: 50,
          maxMenuItems: 300,
          maxAdmins: 10,
          maxOrders: -1, // unlimited
        },
        isActive: true,
        displayOrder: 2,
      },
      {
        name: 'Enterprise',
        description: 'Complete solution for large restaurant chains and enterprises. Unlimited resources with premium support and custom integrations.',
        price: 199,
        currency: 'USD',
        billingCycle: 'monthly',
        features: [
          'Unlimited tables',
          'Unlimited menu items',
          'Unlimited admin users',
          'All Pro features',
          'Multi-location management',
          'White-label solution',
          'Custom domain support',
          'Advanced security features',
          '99.9% uptime SLA',
          'Dedicated account manager',
          'Custom integrations',
          'API access',
          'Advanced reporting & business intelligence',
          'Training & onboarding',
          'Premium 24/7 support (2h response)',
          'Custom feature development',
        ],
        limits: {
          maxTables: 999999,
          maxMenuItems: 999999,
          maxAdmins: 999999,
          maxOrders: -1, // unlimited
        },
        isActive: true,
        displayOrder: 3,
      },
    ];

    // Insert plans
    console.log('💳 Creating subscription plans...\n');
    const createdPlans = await Plan.insertMany(plans);

    // Display created plans
    for (const plan of createdPlans) {
      console.log(`📦 ${plan.name} Plan`);
      console.log(`   💰 Price: $${plan.price}/${plan.billingCycle}`);
      console.log(`   📋 Description: ${plan.description.substring(0, 60)}...`);
      console.log(`   🏢 Tables: ${plan.limits.maxTables === 999999 ? 'Unlimited' : plan.limits.maxTables}`);
      console.log(`   🍽️  Menu Items: ${plan.limits.maxMenuItems === 999999 ? 'Unlimited' : plan.limits.maxMenuItems}`);
      console.log(`   👥 Admins: ${plan.limits.maxAdmins === 999999 ? 'Unlimited' : plan.limits.maxAdmins}`);
      console.log(`   ✨ Features: ${plan.features.length} features`);
      console.log(`   ✅ Status: ${plan.isActive ? 'Active' : 'Inactive'}`);
      console.log('');
    }

    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║                                                           ║');
    console.log('║   ✅ Plans Seeded Successfully!                          ║');
    console.log('║                                                           ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    console.log('📊 Summary:');
    console.log(`   Total Plans Created: ${createdPlans.length}`);
    console.log(`   Active Plans: ${createdPlans.filter(p => p.isActive).length}`);
    console.log(`   Price Range: $${Math.min(...createdPlans.map(p => p.price))} - $${Math.max(...createdPlans.map(p => p.price))} per month\n`);

    await mongoose.connection.close();
    console.log('🔌 Database connection closed\n');
  } catch (error) {
    console.error('\n❌ Error seeding plans:', error);
    throw error;
  }
}

// Export for use in other scripts
export default seedPlans;

// Run if executed directly
if (require.main === module) {
  seedPlans()
    .then(() => {
      console.log('✨ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Script failed:', error);
      process.exit(1);
    });
}
