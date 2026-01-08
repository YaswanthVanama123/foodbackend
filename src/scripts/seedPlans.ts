import dotenv from 'dotenv';
import connectDB from '../config/database';
import Plan from '../models/Plan';

dotenv.config();

/**
 * Plans Seed Script
 *
 * Creates 4 default subscription plans:
 * 1. Free - Limited features for trial users
 * 2. Basic - Small restaurants
 * 3. Pro - Medium to large restaurants
 * 4. Enterprise - Large chains with custom requirements
 */

const seedPlans = async () => {
  try {
    await connectDB();

    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║                                                           ║');
    console.log('║   🌱 Plans Seed Script                                   ║');
    console.log('║   Patlinks Food Ordering System                           ║');
    console.log('║                                                           ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    // Clear existing plans
    console.log('🗑️  Clearing existing plans...');
    await Plan.deleteMany({});
    console.log('   ✓ Existing plans cleared\n');

    // Create plans
    console.log('📋 Creating subscription plans...\n');

    const plans = [
      {
        name: 'Free',
        description: 'Perfect for getting started with basic restaurant management. Includes essential features to test the platform.',
        price: 0,
        currency: 'USD',
        billingCycle: 'monthly',
        features: [
          'Up to 5 tables',
          'Up to 20 menu items',
          '1 admin user',
          'Basic order management',
          'Up to 100 orders per month',
          'Standard support',
          'Basic analytics',
        ],
        limits: {
          maxTables: 5,
          maxMenuItems: 20,
          maxAdmins: 1,
          maxOrders: 100,
        },
        isActive: true,
        displayOrder: 1,
      },
      {
        name: 'Basic',
        description: 'Great for small restaurants looking to digitize their operations. Get more tables, menu items, and premium features.',
        price: 29.99,
        currency: 'USD',
        billingCycle: 'monthly',
        features: [
          'Up to 15 tables',
          'Up to 50 menu items',
          'Up to 3 admin users',
          'Advanced order management',
          'Unlimited orders',
          'Priority support',
          'Advanced analytics',
          'Kitchen display system',
          'Customer reviews',
          'Custom branding',
        ],
        limits: {
          maxTables: 15,
          maxMenuItems: 50,
          maxAdmins: 3,
          maxOrders: -1, // Unlimited
        },
        isActive: true,
        displayOrder: 2,
      },
      {
        name: 'Pro',
        description: 'Ideal for medium to large restaurants with multiple locations or high order volume. Includes all features plus advanced capabilities.',
        price: 79.99,
        currency: 'USD',
        billingCycle: 'monthly',
        features: [
          'Up to 50 tables',
          'Up to 200 menu items',
          'Up to 10 admin users',
          'All Basic features',
          'Multi-location support',
          'Advanced analytics & reporting',
          'Bulk operations',
          'Export functionality',
          'API access',
          'Dedicated account manager',
          'Custom integrations',
          'Priority 24/7 support',
        ],
        limits: {
          maxTables: 50,
          maxMenuItems: 200,
          maxAdmins: 10,
          maxOrders: -1, // Unlimited
        },
        isActive: true,
        displayOrder: 3,
      },
      {
        name: 'Enterprise',
        description: 'For large restaurant chains and enterprises requiring unlimited resources, custom features, and white-label solutions.',
        price: 199.99,
        currency: 'USD',
        billingCycle: 'monthly',
        features: [
          'Unlimited tables',
          'Unlimited menu items',
          'Unlimited admin users',
          'All Pro features',
          'White-label solution',
          'Custom domain',
          'Advanced security features',
          'SLA guarantee',
          'Custom development',
          'On-premise deployment option',
          'Training & onboarding',
          'Dedicated support team',
          'Custom contract terms',
        ],
        limits: {
          maxTables: 999999,
          maxMenuItems: 999999,
          maxAdmins: 999999,
          maxOrders: -1, // Unlimited
        },
        isActive: true,
        displayOrder: 4,
      },
    ];

    const createdPlans = await Plan.insertMany(plans);

    console.log('✅ Plans created successfully:\n');

    createdPlans.forEach((plan) => {
      console.log(`📦 ${plan.name} Plan`);
      console.log(`   Price: $${plan.price}/${plan.billingCycle}`);
      console.log(`   Tables: ${plan.limits.maxTables === 999999 ? 'Unlimited' : plan.limits.maxTables}`);
      console.log(`   Menu Items: ${plan.limits.maxMenuItems === 999999 ? 'Unlimited' : plan.limits.maxMenuItems}`);
      console.log(`   Admins: ${plan.limits.maxAdmins === 999999 ? 'Unlimited' : plan.limits.maxAdmins}`);
      console.log(`   Orders: ${plan.limits.maxOrders === -1 ? 'Unlimited' : plan.limits.maxOrders}`);
      console.log(`   Features: ${plan.features.length} features`);
      console.log(`   Status: ${plan.isActive ? 'Active' : 'Inactive'}`);
      console.log('');
    });

    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║                                                           ║');
    console.log('║   ✅ Plans Seed Completed Successfully!                  ║');
    console.log('║                                                           ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    console.log('📊 Summary:');
    console.log(`   Total Plans: ${createdPlans.length}`);
    console.log(`   Active Plans: ${createdPlans.filter(p => p.isActive).length}`);
    console.log(`   Price Range: $${Math.min(...createdPlans.map(p => p.price))} - $${Math.max(...createdPlans.map(p => p.price))}\n`);

    console.log('🔗 API Endpoints:');
    console.log('   GET    /api/superadmin/plans           - List all plans');
    console.log('   GET    /api/superadmin/plans/:id       - Get plan by ID');
    console.log('   POST   /api/superadmin/plans           - Create new plan');
    console.log('   PUT    /api/superadmin/plans/:id       - Update plan');
    console.log('   DELETE /api/superadmin/plans/:id       - Delete plan');
    console.log('   PATCH  /api/superadmin/plans/:id/status - Toggle plan status\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding plans:', error);
    process.exit(1);
  }
};

// Run seed
seedPlans();
