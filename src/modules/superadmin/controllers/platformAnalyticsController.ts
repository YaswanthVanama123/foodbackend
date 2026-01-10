import { Request, Response } from 'express';
import Restaurant from '../../common/models/Restaurant';
import Order from '../../common/models/Order';
import Customer from '../../common/models/Customer';

// Subscription plan pricing (monthly)
const SUBSCRIPTION_PRICING = {
  trial: 0,
  basic: 29,
  pro: 79,
  enterprise: 199,
};

/**
 * @desc    Get platform revenue analytics
 * @route   GET /api/superadmin/analytics/revenue
 * @access  Private (Super Admin)
 */
export const getPlatformRevenue = async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate } = req.query;

    // Parse dates or use defaults (last 30 days)
    const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate
      ? new Date(startDate as string)
      : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Ensure end of day for endDate
    end.setHours(23, 59, 59, 999);
    start.setHours(0, 0, 0, 0);

    // Calculate previous period dates for growth comparison
    const periodDuration = end.getTime() - start.getTime();
    const previousEnd = new Date(start.getTime() - 1);
    const previousStart = new Date(previousEnd.getTime() - periodDuration);

    // Get all active subscriptions with their billing data
    const currentPeriodSubscriptions = await Restaurant.aggregate([
      {
        $match: {
          'subscription.status': 'active',
          'subscription.startDate': { $lte: end },
          $or: [
            { 'subscription.endDate': { $gte: start } },
            { 'subscription.endDate': { $exists: false } }
          ]
        }
      },
      {
        $group: {
          _id: '$subscription.plan',
          count: { $sum: 1 },
        }
      }
    ]);

    const previousPeriodSubscriptions = await Restaurant.aggregate([
      {
        $match: {
          'subscription.status': 'active',
          'subscription.startDate': { $lte: previousEnd },
          $or: [
            { 'subscription.endDate': { $gte: previousStart } },
            { 'subscription.endDate': { $exists: false } }
          ]
        }
      },
      {
        $group: {
          _id: '$subscription.plan',
          count: { $sum: 1 },
        }
      }
    ]);

    // Calculate current period revenue
    let periodRevenue = 0;
    currentPeriodSubscriptions.forEach((sub) => {
      const plan = sub._id as keyof typeof SUBSCRIPTION_PRICING;
      const pricing = SUBSCRIPTION_PRICING[plan] || 0;
      periodRevenue += pricing * sub.count;
    });

    // Calculate previous period revenue
    let previousPeriodRevenue = 0;
    previousPeriodSubscriptions.forEach((sub) => {
      const plan = sub._id as keyof typeof SUBSCRIPTION_PRICING;
      const pricing = SUBSCRIPTION_PRICING[plan] || 0;
      previousPeriodRevenue += pricing * sub.count;
    });

    // Calculate total all-time revenue
    const allTimeSubscriptions = await Restaurant.aggregate([
      {
        $match: {
          'subscription.status': { $in: ['active', 'expired', 'cancelled'] },
        }
      },
      {
        $group: {
          _id: '$subscription.plan',
          count: { $sum: 1 },
        }
      }
    ]);

    let totalRevenue = 0;
    allTimeSubscriptions.forEach((sub) => {
      const plan = sub._id as keyof typeof SUBSCRIPTION_PRICING;
      const pricing = SUBSCRIPTION_PRICING[plan] || 0;
      totalRevenue += pricing * sub.count;
    });

    // Calculate growth rate
    const growthRate = previousPeriodRevenue > 0
      ? ((periodRevenue - previousPeriodRevenue) / previousPeriodRevenue) * 100
      : periodRevenue > 0 ? 100 : 0;

    // Get daily revenue data for the period (simplified - just group by plan for now)
    const subscriptionsByPlan = await Restaurant.aggregate([
      {
        $match: {
          'subscription.status': 'active',
          'subscription.startDate': { $lte: end },
          $or: [
            { 'subscription.endDate': { $gte: start } },
            { 'subscription.endDate': { $exists: false } }
          ]
        }
      },
      {
        $group: {
          _id: '$subscription.plan',
          count: { $sum: 1 }
        }
      }
    ]);

    // Generate daily data points for the chart
    const dailyData: any[] = [];
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    for (let i = 0; i <= daysDiff; i++) {
      const currentDate = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
      const dateStr = currentDate.toISOString().split('T')[0];

      // Calculate revenue for this date based on active subscriptions
      let dailyRevenue = 0;
      const subscriptionsByPlanMap: any = {};

      subscriptionsByPlan.forEach((sub) => {
        const plan = sub._id as keyof typeof SUBSCRIPTION_PRICING;
        const pricing = SUBSCRIPTION_PRICING[plan] || 0;
        dailyRevenue += (pricing / 30) * sub.count; // Daily revenue (monthly / 30)
        subscriptionsByPlanMap[plan] = sub.count;
      });

      dailyData.push({
        date: dateStr,
        revenue: Math.round(dailyRevenue * 100) / 100,
        subscriptionCount: subscriptionsByPlan.reduce((sum, sub) => sum + sub.count, 0),
        subscriptionsByPlan: subscriptionsByPlanMap
      });
    }

    res.status(200).json({
      success: true,
      data: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        periodRevenue: Math.round(periodRevenue * 100) / 100,
        previousPeriodRevenue: Math.round(previousPeriodRevenue * 100) / 100,
        growthRate: Math.round(growthRate * 100) / 100,
        period: {
          startDate: start.toISOString(),
          endDate: end.toISOString(),
        },
        data: dailyData,
      },
    });
  } catch (error: any) {
    console.error('Get platform revenue error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

/**
 * @desc    Get restaurant growth analytics
 * @route   GET /api/superadmin/analytics/growth
 * @access  Private (Super Admin)
 */
export const getRestaurantGrowth = async (_req: Request, res: Response): Promise<void> => {
  try {
    // Calculate last 12 months date range
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    startDate.setHours(0, 0, 0, 0);

    // Generate array of last 12 months
    const months = [];
    for (let i = 0; i < 12; i++) {
      const monthDate = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999);

      months.push({
        start: monthDate,
        end: monthEnd,
        label: monthDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
      });
    }

    // Get monthly growth data
    const growthData = await Promise.all(
      months.map(async (month) => {
        // New restaurants created in this month
        const newRestaurants = await Restaurant.countDocuments({
          createdAt: { $gte: month.start, $lte: month.end }
        });

        // Active restaurants at end of month
        const activeRestaurants = await Restaurant.countDocuments({
          createdAt: { $lte: month.end },
          isActive: true,
          'subscription.status': 'active'
        });

        // Churned restaurants (deactivated during this month)
        const churnedRestaurants = await Restaurant.countDocuments({
          updatedAt: { $gte: month.start, $lte: month.end },
          $or: [
            { isActive: false },
            { 'subscription.status': { $in: ['cancelled', 'expired', 'suspended'] } }
          ]
        });

        return {
          month: month.label,
          newRestaurants,
          activeRestaurants,
          churnedRestaurants,
        };
      })
    );

    // Calculate total growth
    const firstMonthActive = growthData[0]?.activeRestaurants || 0;
    const lastMonthActive = growthData[growthData.length - 1]?.activeRestaurants || 0;
    const totalGrowth = firstMonthActive > 0
      ? ((lastMonthActive - firstMonthActive) / firstMonthActive) * 100
      : lastMonthActive > 0 ? 100 : 0;

    // Calculate average monthly growth
    let totalMonthlyGrowth = 0;
    let monthsWithGrowth = 0;

    for (let i = 1; i < growthData.length; i++) {
      const previous = growthData[i - 1].activeRestaurants;
      const current = growthData[i].activeRestaurants;

      if (previous > 0) {
        totalMonthlyGrowth += ((current - previous) / previous) * 100;
        monthsWithGrowth++;
      }
    }

    const monthlyGrowth = monthsWithGrowth > 0
      ? totalMonthlyGrowth / monthsWithGrowth
      : 0;

    res.status(200).json({
      success: true,
      data: {
        totalGrowth: Math.round(totalGrowth * 100) / 100,
        monthlyGrowth: Math.round(monthlyGrowth * 100) / 100,
        data: growthData,
      },
    });
  } catch (error: any) {
    console.error('Get restaurant growth error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

/**
 * @desc    Get top performing restaurants
 * @route   GET /api/superadmin/analytics/top-restaurants
 * @access  Private (Super Admin)
 */
export const getTopRestaurants = async (_req: Request, res: Response): Promise<void> => {
  try {
    // Get top restaurants by order revenue
    const topByRevenue = await Order.aggregate([
      {
        $match: {
          status: { $in: ['served', 'ready', 'preparing'] }
        }
      },
      {
        $group: {
          _id: '$restaurantId',
          totalRevenue: { $sum: '$total' },
          orderCount: { $sum: 1 }
        }
      },
      {
        $sort: { totalRevenue: -1 }
      },
      {
        $limit: 10
      },
      {
        $lookup: {
          from: 'restaurants',
          localField: '_id',
          foreignField: '_id',
          as: 'restaurant'
        }
      },
      {
        $unwind: '$restaurant'
      },
      {
        $project: {
          _id: '$restaurant._id',
          name: '$restaurant.name',
          subdomain: '$restaurant.subdomain',
          subscriptionPlan: '$restaurant.subscription.plan',
          totalRevenue: 1,
          orderCount: 1,
          isActive: '$restaurant.isActive'
        }
      }
    ]);

    // Get top restaurants by active customers
    const topByCustomers = await Customer.aggregate([
      {
        $match: {
          isActive: true
        }
      },
      {
        $group: {
          _id: '$restaurantId',
          activeCustomers: { $sum: 1 }
        }
      },
      {
        $sort: { activeCustomers: -1 }
      },
      {
        $limit: 10
      },
      {
        $lookup: {
          from: 'restaurants',
          localField: '_id',
          foreignField: '_id',
          as: 'restaurant'
        }
      },
      {
        $unwind: '$restaurant'
      },
      {
        $project: {
          _id: '$restaurant._id',
          name: '$restaurant.name',
          subdomain: '$restaurant.subdomain',
          subscriptionPlan: '$restaurant.subscription.plan',
          activeCustomers: 1,
          isActive: '$restaurant.isActive'
        }
      }
    ]);

    // Get top restaurants by order count
    const topByOrders = await Order.aggregate([
      {
        $group: {
          _id: '$restaurantId',
          orderCount: { $sum: 1 },
          totalRevenue: { $sum: '$total' }
        }
      },
      {
        $sort: { orderCount: -1 }
      },
      {
        $limit: 10
      },
      {
        $lookup: {
          from: 'restaurants',
          localField: '_id',
          foreignField: '_id',
          as: 'restaurant'
        }
      },
      {
        $unwind: '$restaurant'
      },
      {
        $project: {
          _id: '$restaurant._id',
          name: '$restaurant.name',
          subdomain: '$restaurant.subdomain',
          subscriptionPlan: '$restaurant.subscription.plan',
          orderCount: 1,
          totalRevenue: 1,
          isActive: '$restaurant.isActive'
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        topByRevenue: topByRevenue.map(r => ({
          ...r,
          totalRevenue: Math.round(r.totalRevenue * 100) / 100
        })),
        topByCustomers,
        topByOrders: topByOrders.map(r => ({
          ...r,
          totalRevenue: Math.round(r.totalRevenue * 100) / 100
        })),
      },
    });
  } catch (error: any) {
    console.error('Get top restaurants error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

/**
 * @desc    Get platform overview statistics
 * @route   GET /api/superadmin/analytics/stats
 * @access  Private (Super Admin)
 */
export const getPlatformStats = async (_req: Request, res: Response): Promise<void> => {
  try {
    // Get restaurant statistics
    const [
      totalRestaurants,
      activeRestaurants,
      inactiveRestaurants,
      subscriptionsByStatus,
      subscriptionsByPlan,
      totalCustomers,
      activeCustomers
    ] = await Promise.all([
      Restaurant.countDocuments(),
      Restaurant.countDocuments({
        isActive: true,
        'subscription.status': 'active'
      }),
      Restaurant.countDocuments({
        $or: [
          { isActive: false },
          { 'subscription.status': { $ne: 'active' } }
        ]
      }),
      Restaurant.aggregate([
        {
          $group: {
            _id: '$subscription.status',
            count: { $sum: 1 }
          }
        }
      ]),
      Restaurant.aggregate([
        {
          $group: {
            _id: '$subscription.plan',
            count: { $sum: 1 }
          }
        }
      ]),
      Customer.countDocuments(),
      Customer.countDocuments({ isActive: true })
    ]);

    // Calculate total subscription revenue (monthly recurring)
    const revenueByPlan = subscriptionsByPlan.reduce((acc: Record<string, number>, item: any) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    let totalMonthlyRevenue = 0;
    Object.entries(revenueByPlan).forEach(([plan, count]) => {
      const pricing = SUBSCRIPTION_PRICING[plan as keyof typeof SUBSCRIPTION_PRICING] || 0;
      totalMonthlyRevenue += pricing * (count as number);
    });

    // Calculate total order revenue (all-time)
    const orderRevenueData = await Order.aggregate([
      {
        $match: {
          status: { $in: ['served', 'ready', 'preparing'] }
        }
      },
      {
        $group: {
          _id: null,
          totalOrderRevenue: { $sum: '$total' },
          totalOrders: { $sum: 1 },
          averageOrderValue: { $avg: '$total' }
        }
      }
    ]);

    const orderStats = orderRevenueData[0] || {
      totalOrderRevenue: 0,
      totalOrders: 0,
      averageOrderValue: 0
    };

    // Format subscription status
    const subscriptionStatusMap = subscriptionsByStatus.reduce((acc: Record<string, number>, item: any) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    // Format subscription plans
    const subscriptionPlanMap = subscriptionsByPlan.reduce((acc: Record<string, number>, item: any) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      data: {
        restaurants: {
          total: totalRestaurants,
          active: activeRestaurants,
          inactive: inactiveRestaurants,
        },
        subscriptions: {
          byStatus: subscriptionStatusMap,
          byPlan: subscriptionPlanMap,
        },
        revenue: {
          totalMonthlyRecurring: Math.round(totalMonthlyRevenue * 100) / 100,
          totalOrderRevenue: Math.round(orderStats.totalOrderRevenue * 100) / 100,
          averageOrderValue: Math.round(orderStats.averageOrderValue * 100) / 100,
          totalRevenue: Math.round((totalMonthlyRevenue + orderStats.totalOrderRevenue) * 100) / 100,
        },
        users: {
          totalCustomers,
          activeCustomers,
          inactiveCustomers: totalCustomers - activeCustomers,
        },
        orders: {
          total: orderStats.totalOrders,
        }
      },
    });
  } catch (error: any) {
    console.error('Get platform stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

/**
 * @desc    Get dashboard page data (stats + recent activity) - OPTIMIZED (SINGLE REQUEST)
 * @route   GET /api/superadmin/dashboard/page-data
 * @access  Private (Super Admin)
 */
export const getDashboardPageData = async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  let statsTime = 0;
  let auditLogsTime = 0;

  try {
    const { limit = '10' } = req.query;
    const activityLimit = Math.min(parseInt(limit as string, 10), 100);

    // Import audit service
    const auditService = (await import('../../common/services/auditService')).default;

    // Fetch both stats and audit logs in parallel
    const statsStart = Date.now();
    const [
      totalRestaurants,
      activeRestaurants,
      inactiveRestaurants,
      subscriptionsByStatus,
      subscriptionsByPlan,
      totalCustomers,
      activeCustomers,
      orderRevenueData
    ] = await Promise.all([
      Restaurant.countDocuments(),
      Restaurant.countDocuments({
        isActive: true,
        'subscription.status': 'active'
      }),
      Restaurant.countDocuments({
        $or: [
          { isActive: false },
          { 'subscription.status': { $ne: 'active' } }
        ]
      }),
      Restaurant.aggregate([
        {
          $group: {
            _id: '$subscription.status',
            count: { $sum: 1 }
          }
        }
      ]),
      Restaurant.aggregate([
        {
          $group: {
            _id: '$subscription.plan',
            count: { $sum: 1 }
          }
        }
      ]),
      Customer.countDocuments(),
      Customer.countDocuments({ isActive: true }),
      Order.aggregate([
        {
          $match: {
            status: { $in: ['served', 'ready', 'preparing'] }
          }
        },
        {
          $group: {
            _id: null,
            totalOrderRevenue: { $sum: '$total' },
            totalOrders: { $sum: 1 },
            averageOrderValue: { $avg: '$total' }
          }
        }
      ])
    ]);
    statsTime = Date.now() - statsStart;

    // Fetch audit logs
    const auditStart = Date.now();
    const auditResult = await auditService.getAuditLogs({}, {
      page: 1,
      limit: activityLimit,
      sort: '-timestamp'
    });
    auditLogsTime = Date.now() - auditStart;

    // Calculate subscription revenue
    const revenueByPlan = subscriptionsByPlan.reduce((acc: Record<string, number>, item: any) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    let totalMonthlyRevenue = 0;
    Object.entries(revenueByPlan).forEach(([plan, count]) => {
      const pricing = SUBSCRIPTION_PRICING[plan as keyof typeof SUBSCRIPTION_PRICING] || 0;
      totalMonthlyRevenue += pricing * (count as number);
    });

    const orderStats = orderRevenueData[0] || {
      totalOrderRevenue: 0,
      totalOrders: 0,
      averageOrderValue: 0
    };

    // Format subscription maps
    const subscriptionStatusMap = subscriptionsByStatus.reduce((acc: Record<string, number>, item: any) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    const subscriptionPlanMap = subscriptionsByPlan.reduce((acc: Record<string, number>, item: any) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    const totalTime = Date.now() - startTime;
    console.log(
      `[SUPERADMIN DASHBOARD] ✅ TOTAL TIME: ${totalTime}ms (stats: ${statsTime}ms, audit: ${auditLogsTime}ms)`
    );

    res.status(200).json({
      success: true,
      data: {
        stats: {
          restaurants: {
            total: totalRestaurants,
            active: activeRestaurants,
            inactive: inactiveRestaurants,
          },
          subscriptions: {
            byStatus: subscriptionStatusMap,
            byPlan: subscriptionPlanMap,
          },
          revenue: {
            totalMonthlyRecurring: Math.round(totalMonthlyRevenue * 100) / 100,
            totalOrderRevenue: Math.round(orderStats.totalOrderRevenue * 100) / 100,
            averageOrderValue: Math.round(orderStats.averageOrderValue * 100) / 100,
            totalRevenue: Math.round((totalMonthlyRevenue + orderStats.totalOrderRevenue) * 100) / 100,
          },
          users: {
            totalCustomers,
            activeCustomers,
            inactiveCustomers: totalCustomers - activeCustomers,
          },
          orders: {
            total: orderStats.totalOrders,
          }
        },
        recentActivity: {
          activities: auditResult.logs || [],
          total: auditResult.pagination?.total || 0,
        },
      },
      _perf: {
        total: totalTime,
        stats: statsTime,
        audit: auditLogsTime,
      },
    });
  } catch (error: any) {
    console.error('Get dashboard page data error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

/**
 * @desc    Get analytics page data (revenue + growth + top restaurants + stats) - OPTIMIZED (SINGLE REQUEST)
 * @route   GET /api/superadmin/analytics/page-data
 * @access  Private (Super Admin)
 */
export const getAnalyticsPageData = async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  let revenueTime = 0;
  let growthTime = 0;
  let topRestaurantsTime = 0;
  let statsTime = 0;

  try {
    const { startDate, endDate } = req.query;

    // Parse dates for revenue (or use defaults - last 30 days)
    const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate
      ? new Date(startDate as string)
      : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    end.setHours(23, 59, 59, 999);
    start.setHours(0, 0, 0, 0);

    // 1. GET REVENUE DATA
    const revenueStart = Date.now();

    const periodDuration = end.getTime() - start.getTime();
    const previousEnd = new Date(start.getTime() - 1);
    const previousStart = new Date(previousEnd.getTime() - periodDuration);

    const [currentPeriodSubscriptions, previousPeriodSubscriptions, allTimeSubscriptions] = await Promise.all([
      Restaurant.aggregate([
        {
          $match: {
            'subscription.status': 'active',
            'subscription.startDate': { $lte: end },
            $or: [
              { 'subscription.endDate': { $gte: start } },
              { 'subscription.endDate': { $exists: false } }
            ]
          }
        },
        {
          $group: {
            _id: '$subscription.plan',
            count: { $sum: 1 },
          }
        }
      ]),
      Restaurant.aggregate([
        {
          $match: {
            'subscription.status': 'active',
            'subscription.startDate': { $lte: previousEnd },
            $or: [
              { 'subscription.endDate': { $gte: previousStart } },
              { 'subscription.endDate': { $exists: false } }
            ]
          }
        },
        {
          $group: {
            _id: '$subscription.plan',
            count: { $sum: 1 },
          }
        }
      ]),
      Restaurant.aggregate([
        {
          $match: {
            'subscription.status': { $in: ['active', 'expired', 'cancelled'] },
          }
        },
        {
          $group: {
            _id: '$subscription.plan',
            count: { $sum: 1 },
          }
        }
      ])
    ]);

    let periodRevenue = 0;
    currentPeriodSubscriptions.forEach((sub) => {
      const plan = sub._id as keyof typeof SUBSCRIPTION_PRICING;
      const pricing = SUBSCRIPTION_PRICING[plan] || 0;
      periodRevenue += pricing * sub.count;
    });

    let previousPeriodRevenue = 0;
    previousPeriodSubscriptions.forEach((sub) => {
      const plan = sub._id as keyof typeof SUBSCRIPTION_PRICING;
      const pricing = SUBSCRIPTION_PRICING[plan] || 0;
      previousPeriodRevenue += pricing * sub.count;
    });

    let totalRevenue = 0;
    allTimeSubscriptions.forEach((sub) => {
      const plan = sub._id as keyof typeof SUBSCRIPTION_PRICING;
      const pricing = SUBSCRIPTION_PRICING[plan] || 0;
      totalRevenue += pricing * sub.count;
    });

    const growthRate = previousPeriodRevenue > 0
      ? ((periodRevenue - previousPeriodRevenue) / previousPeriodRevenue) * 100
      : periodRevenue > 0 ? 100 : 0;

    // Generate daily data points
    const dailyData: any[] = [];
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    for (let i = 0; i <= daysDiff; i++) {
      const currentDate = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
      const dateStr = currentDate.toISOString().split('T')[0];

      let dailyRevenue = 0;
      currentPeriodSubscriptions.forEach((sub) => {
        const plan = sub._id as keyof typeof SUBSCRIPTION_PRICING;
        const pricing = SUBSCRIPTION_PRICING[plan] || 0;
        dailyRevenue += (pricing / 30) * sub.count;
      });

      dailyData.push({
        date: dateStr,
        revenue: Math.round(dailyRevenue * 100) / 100,
        subscriptions: currentPeriodSubscriptions.reduce((sum, sub) => sum + sub.count, 0)
      });
    }

    const revenueData = {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      periodRevenue: Math.round(periodRevenue * 100) / 100,
      growthRate: Math.round(growthRate * 100) / 100,
      data: dailyData,
    };

    revenueTime = Date.now() - revenueStart;

    // 2. GET GROWTH DATA
    const growthStart = Date.now();

    const now = new Date();
    const growthStartDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    growthStartDate.setHours(0, 0, 0, 0);

    const months = [];
    for (let i = 0; i < 12; i++) {
      const monthDate = new Date(growthStartDate.getFullYear(), growthStartDate.getMonth() + i, 1);
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999);

      months.push({
        start: monthDate,
        end: monthEnd,
        label: monthDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
      });
    }

    const growthData = await Promise.all(
      months.map(async (month) => {
        const [newRestaurants, activeRestaurants, churnedRestaurants] = await Promise.all([
          Restaurant.countDocuments({
            createdAt: { $gte: month.start, $lte: month.end }
          }),
          Restaurant.countDocuments({
            createdAt: { $lte: month.end },
            isActive: true,
            'subscription.status': 'active'
          }),
          Restaurant.countDocuments({
            updatedAt: { $gte: month.start, $lte: month.end },
            $or: [
              { isActive: false },
              { 'subscription.status': { $in: ['cancelled', 'expired', 'suspended'] } }
            ]
          })
        ]);

        return {
          month: month.label,
          newRestaurants,
          activeRestaurants,
          churnedRestaurants,
        };
      })
    );

    const firstMonthActive = growthData[0]?.activeRestaurants || 0;
    const lastMonthActive = growthData[growthData.length - 1]?.activeRestaurants || 0;
    const totalGrowth = firstMonthActive > 0
      ? ((lastMonthActive - firstMonthActive) / firstMonthActive) * 100
      : lastMonthActive > 0 ? 100 : 0;

    let totalMonthlyGrowth = 0;
    let monthsWithGrowth = 0;

    for (let i = 1; i < growthData.length; i++) {
      const previous = growthData[i - 1].activeRestaurants;
      const current = growthData[i].activeRestaurants;

      if (previous > 0) {
        totalMonthlyGrowth += ((current - previous) / previous) * 100;
        monthsWithGrowth++;
      }
    }

    const monthlyGrowth = monthsWithGrowth > 0
      ? totalMonthlyGrowth / monthsWithGrowth
      : 0;

    const growthDataResponse = {
      totalGrowth: Math.round(totalGrowth * 100) / 100,
      monthlyGrowth: Math.round(monthlyGrowth * 100) / 100,
      data: growthData,
    };

    growthTime = Date.now() - growthStart;

    // 3. GET TOP RESTAURANTS
    const topRestaurantsStart = Date.now();

    const topRestaurants = await Order.aggregate([
      {
        $match: {
          status: { $in: ['served', 'ready', 'preparing'] }
        }
      },
      {
        $group: {
          _id: '$restaurantId',
          revenue: { $sum: '$total' },
          ordersCount: { $sum: 1 }
        }
      },
      {
        $sort: { revenue: -1 }
      },
      {
        $limit: 10
      },
      {
        $lookup: {
          from: 'restaurants',
          localField: '_id',
          foreignField: '_id',
          as: 'restaurant'
        }
      },
      {
        $unwind: '$restaurant'
      },
      {
        $lookup: {
          from: 'customers',
          let: { restaurantId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$restaurantId', '$$restaurantId'] },
                isActive: true
              }
            },
            {
              $count: 'count'
            }
          ],
          as: 'customerCount'
        }
      },
      {
        $project: {
          id: '$restaurant._id',
          name: '$restaurant.name',
          revenue: 1,
          subscriptionPlan: '$restaurant.subscription.plan',
          activeUsers: { $ifNull: [{ $arrayElemAt: ['$customerCount.count', 0] }, 0] },
          ordersCount: 1
        }
      }
    ]);

    const topRestaurantsResponse = {
      restaurants: topRestaurants.map(r => ({
        ...r,
        revenue: Math.round(r.revenue * 100) / 100
      })),
      total: topRestaurants.length
    };

    topRestaurantsTime = Date.now() - topRestaurantsStart;

    // 4. GET PLATFORM STATS
    const statsStart = Date.now();

    const [
      totalRestaurants,
      activeRestaurants,
      subscriptionsByPlan,
      totalCustomers,
      orderRevenueData
    ] = await Promise.all([
      Restaurant.countDocuments(),
      Restaurant.countDocuments({
        isActive: true,
        'subscription.status': 'active'
      }),
      Restaurant.aggregate([
        {
          $group: {
            _id: '$subscription.plan',
            count: { $sum: 1 }
          }
        }
      ]),
      Customer.countDocuments(),
      Order.aggregate([
        {
          $match: {
            status: { $in: ['served', 'ready', 'preparing'] }
          }
        },
        {
          $group: {
            _id: null,
            totalOrderRevenue: { $sum: '$total' },
            totalOrders: { $sum: 1 },
            averageOrderValue: { $avg: '$total' }
          }
        }
      ])
    ]);

    const revenueByPlan = subscriptionsByPlan.reduce((acc: Record<string, number>, item: any) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    let totalMonthlyRevenue = 0;
    Object.entries(revenueByPlan).forEach(([plan, count]) => {
      const pricing = SUBSCRIPTION_PRICING[plan as keyof typeof SUBSCRIPTION_PRICING] || 0;
      totalMonthlyRevenue += pricing * (count as number);
    });

    const orderStats = orderRevenueData[0] || {
      totalOrderRevenue: 0,
      totalOrders: 0,
      averageOrderValue: 0
    };

    const statsData = {
      restaurants: {
        total: totalRestaurants,
        active: activeRestaurants,
      },
      revenue: {
        totalRevenue: Math.round((totalMonthlyRevenue + orderStats.totalOrderRevenue) * 100) / 100,
      },
      users: {
        totalCustomers,
      },
      orders: {
        total: orderStats.totalOrders,
      }
    };

    statsTime = Date.now() - statsStart;

    const totalTime = Date.now() - startTime;

    res.status(200).json({
      success: true,
      data: {
        revenue: revenueData,
        growth: growthDataResponse,
        topRestaurants: topRestaurantsResponse,
        stats: statsData,
      },
      _perf: {
        total: totalTime,
        revenue: revenueTime,
        growth: growthTime,
        topRestaurants: topRestaurantsTime,
        stats: statsTime,
      },
    });
  } catch (error: any) {
    console.error('Get analytics page data error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};
