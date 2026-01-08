import { Request, Response } from 'express';
import Order from '../common/models/Order';
import MenuItem from '../common/models/MenuItem';
import Category from '../common/models/Category';
import Table from '../common/models/Table';
import mongoose from 'mongoose';

// @desc    Get revenue analytics (tenant-scoped)
// @route   GET /api/analytics/revenue
// @access  Private (Admin)
export const getRevenueAnalytics = async (req: Request, res: Response): Promise<void> => {
  try {
    const { period = 'today', startDate, endDate } = req.query;
    const restaurantId = req.restaurantId!;

    let dateFilter: any = {};
    const now = new Date();

    if (period === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      dateFilter = { createdAt: { $gte: today } };
    } else if (period === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(now.getDate() - 7);
      dateFilter = { createdAt: { $gte: weekAgo } };
    } else if (period === 'month') {
      const monthAgo = new Date();
      monthAgo.setMonth(now.getMonth() - 1);
      dateFilter = { createdAt: { $gte: monthAgo } };
    } else if (period === 'custom' && startDate && endDate) {
      dateFilter = {
        createdAt: {
          $gte: new Date(startDate as string),
          $lte: new Date(endDate as string),
        },
      };
    }

    const [totalRevenue, orderStats, dailyRevenue] = await Promise.all([
      // Total revenue
      Order.aggregate([
        { $match: { restaurantId, ...dateFilter, status: 'served' } },
        { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } },
      ]),

      // Order status breakdown
      Order.aggregate([
        { $match: { restaurantId, ...dateFilter } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            revenue: { $sum: { $cond: [{ $eq: ['$status', 'served'] }, '$total', 0] } },
          },
        },
      ]),

      // Daily revenue (last 7 days)
      Order.aggregate([
        {
          $match: {
            restaurantId,
            createdAt: { $gte: new Date(now.setDate(now.getDate() - 7)) },
            status: 'served',
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            revenue: { $sum: '$total' },
            orders: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalRevenue: totalRevenue[0]?.total || 0,
        totalOrders: totalRevenue[0]?.count || 0,
        averageOrderValue:
          totalRevenue[0]?.count > 0
            ? (totalRevenue[0]?.total / totalRevenue[0]?.count).toFixed(2)
            : 0,
        ordersByStatus: orderStats,
        dailyRevenue,
      },
    });
  } catch (error: any) {
    console.error('Get revenue analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get popular menu items (tenant-scoped)
// @route   GET /api/analytics/popular-items
// @access  Private (Admin)
export const getPopularItems = async (req: Request, res: Response): Promise<void> => {
  try {
    const { limit = 10, period = 'month' } = req.query;
    const restaurantId = req.restaurantId!;

    let dateFilter: any = {};
    const now = new Date();

    if (period === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      dateFilter = { createdAt: { $gte: today } };
    } else if (period === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(now.getDate() - 7);
      dateFilter = { createdAt: { $gte: weekAgo } };
    } else if (period === 'month') {
      const monthAgo = new Date();
      monthAgo.setMonth(now.getMonth() - 1);
      dateFilter = { createdAt: { $gte: monthAgo } };
    }

    const popularItems = await Order.aggregate([
      { $match: { restaurantId, ...dateFilter, status: 'served' } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.menuItemId',
          name: { $first: '$items.name' },
          totalOrders: { $sum: '$items.quantity' },
          totalRevenue: { $sum: '$items.subtotal' },
        },
      },
      { $sort: { totalOrders: -1 } },
      { $limit: Number(limit) },
    ]);

    res.status(200).json({
      success: true,
      period,
      count: popularItems.length,
      data: popularItems,
    });
  } catch (error: any) {
    console.error('Get popular items error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get category performance (tenant-scoped)
// @route   GET /api/analytics/category-performance
// @access  Private (Admin)
export const getCategoryPerformance = async (req: Request, res: Response): Promise<void> => {
  try {
    const { period = 'month' } = req.query;
    const restaurantId = req.restaurantId!;

    let dateFilter: any = {};
    const now = new Date();

    if (period === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      dateFilter = { createdAt: { $gte: today } };
    } else if (period === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(now.getDate() - 7);
      dateFilter = { createdAt: { $gte: weekAgo } };
    } else if (period === 'month') {
      const monthAgo = new Date();
      monthAgo.setMonth(now.getMonth() - 1);
      dateFilter = { createdAt: { $gte: monthAgo } };
    }

    // Get all menu items with their categories for this restaurant
    const menuItems = await MenuItem.find({ restaurantId }).select('_id categoryId').lean();
    const itemCategoryMap = new Map(menuItems.map((item) => [item._id.toString(), item.categoryId]));

    // Get order data
    const orders = await Order.find({ restaurantId, ...dateFilter, status: 'served' })
      .select('items')
      .lean();

    // Calculate category stats
    const categoryStats: any = {};

    orders.forEach((order) => {
      order.items.forEach((item: any) => {
        const categoryId = itemCategoryMap.get(item.menuItemId.toString());
        if (categoryId) {
          const catId = categoryId.toString();
          if (!categoryStats[catId]) {
            categoryStats[catId] = {
              categoryId: catId,
              totalOrders: 0,
              totalRevenue: 0,
              itemsSold: 0,
            };
          }
          categoryStats[catId].totalOrders += 1;
          categoryStats[catId].totalRevenue += item.subtotal;
          categoryStats[catId].itemsSold += item.quantity;
        }
      });
    });

    // Get category names
    const categoryIds = Object.keys(categoryStats);
    const categories = await Category.find({
      _id: { $in: categoryIds },
      restaurantId
    })
      .select('_id name')
      .lean();

    const result = categories.map((cat) => ({
      ...categoryStats[cat._id.toString()],
      categoryName: cat.name,
    }));

    res.status(200).json({
      success: true,
      period,
      data: result.sort((a, b) => b.totalRevenue - a.totalRevenue),
    });
  } catch (error: any) {
    console.error('Get category performance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get peak hours analysis (tenant-scoped)
// @route   GET /api/analytics/peak-hours
// @access  Private (Admin)
export const getPeakHours = async (req: Request, res: Response): Promise<void> => {
  try {
    const { period = 'week' } = req.query;
    const restaurantId = req.restaurantId!;

    let dateFilter: any = {};
    const now = new Date();

    if (period === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      dateFilter = { createdAt: { $gte: today } };
    } else if (period === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(now.getDate() - 7);
      dateFilter = { createdAt: { $gte: weekAgo } };
    } else if (period === 'month') {
      const monthAgo = new Date();
      monthAgo.setMonth(now.getMonth() - 1);
      dateFilter = { createdAt: { $gte: monthAgo } };
    }

    const hourlyOrders = await Order.aggregate([
      { $match: { restaurantId, ...dateFilter } },
      {
        $group: {
          _id: { $hour: '$createdAt' },
          orderCount: { $sum: 1 },
          revenue: { $sum: { $cond: [{ $eq: ['$status', 'served'] }, '$total', 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.status(200).json({
      success: true,
      period,
      data: hourlyOrders.map((h) => ({
        hour: h._id,
        orderCount: h.orderCount,
        revenue: h.revenue,
      })),
    });
  } catch (error: any) {
    console.error('Get peak hours error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get table performance (tenant-scoped)
// @route   GET /api/analytics/table-performance
// @access  Private (Admin)
export const getTablePerformance = async (req: Request, res: Response): Promise<void> => {
  try {
    const { period = 'month' } = req.query;
    const restaurantId = req.restaurantId!;

    let dateFilter: any = {};
    const now = new Date();

    if (period === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      dateFilter = { createdAt: { $gte: today } };
    } else if (period === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(now.getDate() - 7);
      dateFilter = { createdAt: { $gte: weekAgo } };
    } else if (period === 'month') {
      const monthAgo = new Date();
      monthAgo.setMonth(now.getMonth() - 1);
      dateFilter = { createdAt: { $gte: monthAgo } };
    }

    const tableStats = await Order.aggregate([
      { $match: { restaurantId, ...dateFilter, status: 'served' } },
      {
        $group: {
          _id: '$tableNumber',
          orderCount: { $sum: 1 },
          totalRevenue: { $sum: '$total' },
          avgOrderValue: { $avg: '$total' },
        },
      },
      { $sort: { totalRevenue: -1 } },
    ]);

    res.status(200).json({
      success: true,
      period,
      data: tableStats,
    });
  } catch (error: any) {
    console.error('Get table performance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get average preparation time (tenant-scoped)
// @route   GET /api/analytics/preparation-time
// @access  Private (Admin)
export const getPreparationTime = async (req: Request, res: Response): Promise<void> => {
  try {
    const { period = 'week' } = req.query;
    const restaurantId = req.restaurantId!;

    let dateFilter: any = {};
    const now = new Date();

    if (period === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      dateFilter = { createdAt: { $gte: today } };
    } else if (period === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(now.getDate() - 7);
      dateFilter = { createdAt: { $gte: weekAgo } };
    } else if (period === 'month') {
      const monthAgo = new Date();
      monthAgo.setMonth(now.getMonth() - 1);
      dateFilter = { createdAt: { $gte: monthAgo } };
    }

    const orders = await Order.find({
      restaurantId,
      ...dateFilter,
      status: 'served',
      servedAt: { $exists: true }
    })
      .select('createdAt servedAt statusHistory')
      .lean();

    const timings = orders.map((order) => {
      const created = new Date(order.createdAt).getTime();
      const served = order.servedAt ? new Date(order.servedAt).getTime() : created;
      const totalTime = Math.round((served - created) / 1000 / 60); // minutes

      // Calculate time for each status
      const statusTimes: any = {};
      for (let i = 0; i < order.statusHistory.length - 1; i++) {
        const current = order.statusHistory[i];
        const next = order.statusHistory[i + 1];
        const duration = Math.round(
          (new Date(next.timestamp).getTime() - new Date(current.timestamp).getTime()) / 1000 / 60
        );
        statusTimes[current.status] = duration;
      }

      return {
        totalTime,
        statusTimes,
      };
    });

    const avgTotalTime = timings.length > 0
      ? timings.reduce((sum, t) => sum + t.totalTime, 0) / timings.length
      : 0;

    res.status(200).json({
      success: true,
      period,
      data: {
        averageTotalTime: Math.round(avgTotalTime),
        totalOrders: timings.length,
        timings: timings.slice(0, 10), // Last 10 for details
      },
    });
  } catch (error: any) {
    console.error('Get preparation time error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get comprehensive dashboard analytics (tenant-scoped)
// @route   GET /api/analytics/dashboard
// @access  Private (Admin)
export const getDashboardAnalytics = async (req: Request, res: Response): Promise<void> => {
  try {
    const restaurantId = req.restaurantId!;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      todayStats,
      activeOrders,
      popularItems,
      recentOrders,
      categoryBreakdown,
    ] = await Promise.all([
      // Today's stats
      Order.aggregate([
        { $match: { restaurantId, createdAt: { $gte: today } } },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            completedOrders: {
              $sum: { $cond: [{ $eq: ['$status', 'served'] }, 1, 0] },
            },
            totalRevenue: {
              $sum: { $cond: [{ $eq: ['$status', 'served'] }, '$total', 0] },
            },
            avgOrderValue: {
              $avg: { $cond: [{ $eq: ['$status', 'served'] }, '$total', null] },
            },
          },
        },
      ]),

      // Active orders count
      Order.countDocuments({
        restaurantId,
        status: { $in: ['received', 'preparing', 'ready'] }
      }),

      // Popular items today
      Order.aggregate([
        { $match: { restaurantId, createdAt: { $gte: today }, status: 'served' } },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.name',
            count: { $sum: '$items.quantity' },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),

      // Recent orders
      Order.find({ restaurantId })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('orderNumber tableNumber total status createdAt')
        .lean(),

      // Category breakdown
      Order.aggregate([
        { $match: { restaurantId, createdAt: { $gte: today }, status: 'served' } },
        { $unwind: '$items' },
        {
          $group: {
            _id: null,
            totalItems: { $sum: '$items.quantity' },
          },
        },
      ]),
    ]);

    res.status(200).json({
      success: true,
      data: {
        today: todayStats[0] || {
          totalOrders: 0,
          completedOrders: 0,
          totalRevenue: 0,
          avgOrderValue: 0,
        },
        activeOrders,
        popularItems,
        recentOrders,
        categoryBreakdown: categoryBreakdown[0] || { totalItems: 0 },
      },
    });
  } catch (error: any) {
    console.error('Get dashboard analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};
