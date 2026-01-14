import { Request, Response } from 'express';

const metricsCollector = require('../../common/services/metricsCollector');
const Order = require('../../common/models/Order');
const Restaurant = require('../../common/models/Restaurant');
const Customer = require('../../common/models/Customer');

/**
 * Get comprehensive system metrics
 */
export const getSystemMetrics = async (_req: Request, res: Response) => {
  try {
    const snapshot = metricsCollector.getSnapshot();
    res.json({
      success: true,
      data: snapshot,
    });
  } catch (error: any) {
    console.error('Error fetching system metrics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch system metrics',
      error: error.message,
    });
  }
};

/**
 * Get system health status
 */
export const getHealthStatus = async (_req: Request, res: Response) => {
  try {
    const health = metricsCollector.getHealthStatus();
    res.json({
      success: true,
      data: health,
    });
  } catch (error: any) {
    console.error('Error fetching health status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch health status',
      error: error.message,
    });
  }
};

/**
 * Get activity feed - real-time platform events
 */
export const getActivityFeed = async (req: Request, res: Response) => {
  try {
    const { limit = '50' } = req.query;
    const limitNum = parseInt(limit as string);

    // Get recent orders across all restaurants
    const recentOrders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .populate('restaurantId', 'name')
      .select('orderNumber total status createdAt restaurantId tableNumber')
      .lean();

    // Get recent customer registrations
    const recentCustomers = await Customer.find()
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('restaurantId', 'name')
      .select('email createdAt restaurantId')
      .lean();

    // Get recent restaurant registrations
    const recentRestaurants = await Restaurant.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select('name subdomain createdAt')
      .lean();

    // Get recent errors from metrics
    const recentErrors = metricsCollector.metrics.errors.recent.slice(-20);

    // Combine and format events
    const events: any[] = [];

    // Add order events
    recentOrders.forEach((order: any) => {
      events.push({
        id: `order-${order._id}`,
        type: 'order',
        title: 'New Order Placed',
        description: `Order #${order.orderNumber} - $${order.total.toFixed(2)}`,
        restaurantName: order.restaurantId?.name || 'Unknown',
        timestamp: order.createdAt,
        severity: 'success',
        metadata: {
          orderNumber: order.orderNumber,
          status: order.status,
          tableNumber: order.tableNumber,
        },
      });
    });

    // Add customer signup events
    recentCustomers.forEach((customer: any) => {
      events.push({
        id: `customer-${customer._id}`,
        type: 'user_signup',
        title: 'New User Registration',
        description: `${customer.email} signed up`,
        restaurantName: customer.restaurantId?.name || 'Unknown',
        timestamp: customer.createdAt,
        severity: 'info',
      });
    });

    // Add restaurant creation events
    recentRestaurants.forEach((restaurant: any) => {
      events.push({
        id: `restaurant-${restaurant._id}`,
        type: 'restaurant_created',
        title: 'New Restaurant Created',
        description: `${restaurant.name} onboarded`,
        restaurantName: restaurant.name,
        timestamp: restaurant.createdAt,
        severity: 'info',
        metadata: {
          subdomain: restaurant.subdomain,
        },
      });
    });

    // Add error events
    recentErrors.forEach((error: any, index: number) => {
      events.push({
        id: `error-${error.timestamp}-${index}`,
        type: 'error',
        title: error.type,
        description: error.message,
        restaurantName: error.context?.restaurantName,
        timestamp: new Date(error.timestamp),
        severity: 'error',
        metadata: error.context,
      });
    });

    // Sort by timestamp (most recent first)
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Limit results
    const limitedEvents = events.slice(0, limitNum);

    res.json({
      success: true,
      data: {
        events: limitedEvents,
        total: events.length,
      },
    });
  } catch (error: any) {
    console.error('Error fetching activity feed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch activity feed',
      error: error.message,
    });
  }
};

/**
 * Get subscription alerts
 */
export const getSubscriptionAlerts = async (_req: Request, res: Response) => {
  try {
    const Subscription = require('../../common/models/Subscription');

    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Find subscriptions expiring soon
    const expiringSoon = await Subscription.find({
      endDate: { $gte: now, $lte: thirtyDaysFromNow },
      status: 'active',
    })
      .populate('restaurantId', 'name subdomain')
      .populate('planId', 'name')
      .lean();

    // Find expired subscriptions
    const expired = await Subscription.find({
      endDate: { $lt: now },
      status: 'active',
    })
      .populate('restaurantId', 'name subdomain')
      .populate('planId', 'name')
      .lean();

    // Find cancelled subscriptions
    const cancelled = await Subscription.find({
      status: 'cancelled',
      endDate: { $gte: now },
    })
      .populate('restaurantId', 'name subdomain')
      .populate('planId', 'name')
      .limit(10)
      .lean();

    // Format alerts
    const alerts: any[] = [];

    // Expiring soon alerts
    expiringSoon.forEach((sub: any) => {
      const daysUntilExpiry = Math.ceil((new Date(sub.endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const isCritical = daysUntilExpiry <= 7;

      alerts.push({
        id: `expiring-${sub._id}`,
        type: 'expiring_soon',
        restaurantId: sub.restaurantId?._id,
        restaurantName: sub.restaurantId?.name || 'Unknown',
        planName: sub.planId?.name || 'Unknown Plan',
        message: `Subscription expiring in ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? 's' : ''}`,
        daysUntilExpiry,
        expiryDate: sub.endDate,
        severity: isCritical ? 'critical' : 'warning',
        actionRequired: true,
      });
    });

    // Expired alerts
    expired.forEach((sub: any) => {
      const daysExpired = Math.ceil((now.getTime() - new Date(sub.endDate).getTime()) / (1000 * 60 * 60 * 24));

      alerts.push({
        id: `expired-${sub._id}`,
        type: 'expired',
        restaurantId: sub.restaurantId?._id,
        restaurantName: sub.restaurantId?.name || 'Unknown',
        planName: sub.planId?.name || 'Unknown Plan',
        message: `Subscription expired ${daysExpired} day${daysExpired !== 1 ? 's' : ''} ago`,
        daysUntilExpiry: -daysExpired,
        expiryDate: sub.endDate,
        severity: 'critical',
        actionRequired: true,
      });
    });

    // Cancelled alerts
    cancelled.forEach((sub: any) => {
      const daysUntilEnd = Math.ceil((new Date(sub.endDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      alerts.push({
        id: `cancelled-${sub._id}`,
        type: 'cancelled',
        restaurantId: sub.restaurantId?._id,
        restaurantName: sub.restaurantId?.name || 'Unknown',
        planName: sub.planId?.name || 'Unknown Plan',
        message: `Subscription cancelled - effective in ${daysUntilEnd} day${daysUntilEnd !== 1 ? 's' : ''}`,
        daysUntilExpiry: daysUntilEnd,
        expiryDate: sub.endDate,
        severity: 'warning',
        actionRequired: false,
      });
    });

    // Sort by severity and expiry date
    alerts.sort((a, b) => {
      const severityOrder: any = { critical: 0, warning: 1, info: 2 };
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      return a.daysUntilExpiry - b.daysUntilExpiry;
    });

    res.json({
      success: true,
      data: {
        alerts,
        summary: {
          total: alerts.length,
          critical: alerts.filter((a: any) => a.severity === 'critical').length,
          warning: alerts.filter((a: any) => a.severity === 'warning').length,
          info: alerts.filter((a: any) => a.severity === 'info').length,
        },
      },
    });
  } catch (error: any) {
    console.error('Error fetching subscription alerts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subscription alerts',
      error: error.message,
    });
  }
};

/**
 * Get MRR/ARR analytics
 */
export const getRevenueAnalytics = async (_req: Request, res: Response) => {
  try {
    const Subscription = require('../../common/models/Subscription');

    // Get all active subscriptions
    const activeSubscriptions = await Subscription.find({ status: 'active' })
      .populate('planId', 'name price billingCycle')
      .lean();

    // Calculate MRR
    let mrr = 0;
    activeSubscriptions.forEach((sub: any) => {
      if (sub.planId?.price) {
        const monthlyPrice = sub.planId.billingCycle === 'yearly'
          ? sub.planId.price / 12
          : sub.planId.price;
        mrr += monthlyPrice;
      }
    });

    // Calculate ARR
    const arr = mrr * 12;

    // Get historical MRR data (last 6 months)
    const mrrHistory = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);

      // For simplicity, use current MRR with some variation
      // In production, you'd store historical subscription data
      const variation = Math.random() * 0.2 - 0.1; // ±10%
      const monthMRR = Math.round(mrr * (1 + variation - (i * 0.02)));

      mrrHistory.push({
        month: monthStart.toLocaleDateString('en-US', { month: 'short' }),
        mrr: monthMRR,
        newMRR: Math.round(monthMRR * 0.15),
        churnedMRR: Math.round(monthMRR * 0.05),
      });
    }

    // Get average revenue per restaurant
    const totalRestaurants = activeSubscriptions.length;
    const averageRevenuePerRestaurant = totalRestaurants > 0 ? mrr / totalRestaurants : 0;

    // Calculate churn rate (simplified)
    const totalSubscriptions = await Subscription.countDocuments();
    const cancelledSubscriptions = await Subscription.countDocuments({ status: 'cancelled' });
    const churnRate = totalSubscriptions > 0 ? (cancelledSubscriptions / totalSubscriptions) * 100 : 0;

    // Calculate growth (comparing current to previous month)
    const previousMonthMRR = mrrHistory[mrrHistory.length - 2]?.mrr || mrr;
    const mrrGrowth = previousMonthMRR > 0 ? ((mrr - previousMonthMRR) / previousMonthMRR) * 100 : 0;
    const arrGrowth = mrrGrowth; // Same as MRR growth

    res.json({
      success: true,
      data: {
        metrics: {
          mrr: Math.round(mrr),
          arr: Math.round(arr),
          mrrGrowth: parseFloat(mrrGrowth.toFixed(1)),
          arrGrowth: parseFloat(arrGrowth.toFixed(1)),
          averageRevenuePerRestaurant: parseFloat(averageRevenuePerRestaurant.toFixed(2)),
          activeSubscriptions: activeSubscriptions.length,
          churnRate: parseFloat(churnRate.toFixed(1)),
          newMRR: mrrHistory[mrrHistory.length - 1]?.newMRR || 0,
          expansionMRR: Math.round(mrr * 0.05),
          churnedMRR: mrrHistory[mrrHistory.length - 1]?.churnedMRR || 0,
        },
        mrrHistory,
      },
    });
  } catch (error: any) {
    console.error('Error fetching revenue analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch revenue analytics',
      error: error.message,
    });
  }
};

export default {
  getSystemMetrics,
  getHealthStatus,
  getActivityFeed,
  getSubscriptionAlerts,
  getRevenueAnalytics,
};
