import Plan from '../modules/common/models/Plan';

/**
 * Seed plans via running server (uses existing DB connection)
 * Call this from a controller endpoint
 */
export async function seedPlansViaAPI() {
  try {
    console.log('🗑️  Clearing existing plans...');
    const deletedCount = await Plan.deleteMany({});
    console.log(`   ✓ Deleted ${deletedCount.deletedCount} existing plans`);

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
          maxOrders: -1,
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
          maxOrders: -1,
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
          maxOrders: -1,
        },
        isActive: true,
        displayOrder: 3,
      },
    ];

    console.log('💳 Creating subscription plans...');
    const createdPlans = await Plan.insertMany(plans);

    console.log(`✅ Successfully created ${createdPlans.length} plans`);

    return {
      success: true,
      message: `Successfully seeded ${createdPlans.length} plans`,
      plans: createdPlans,
    };
  } catch (error: any) {
    console.error('❌ Error seeding plans:', error);
    throw error;
  }
}
