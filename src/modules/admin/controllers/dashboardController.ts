import { Request, Response } from 'express';
import Order from '../common/models/Order';
import mongoose from 'mongoose';

/**
 * Dashboard Controller
 * Handles dashboard statistics and active orders for the admin panel
 * All queries are tenant-scoped using req.restaurantId
 */

/**
 * @desc    Get dashboard statistics for today
 * @route   GET /api/dashboard/stats
 * @access  Private (Admin)
 *
 * Returns comprehensive statistics including:
 * - Total orders, active orders, revenue, average order value
 * - Status breakdown (pending, preparing, ready, served, cancelled)
 */
export const getDashboardStats = async (req: Request, res: Response): Promise<void> => {
  try {
    // CRITICAL: Ensure restaurantId is available
    if (!req.restaurantId) {
      res.status(400).json({
        success: false,
        message: 'Restaurant ID is required',
      });
      return;
    }

    // Get today's date range (start of day to current time)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const restaurantId = req.restaurantId;

    // Run all queries in parallel for better performance
    const [
      totalOrdersResult,
      activeOrdersResult,
      statusBreakdownResult,
      revenueResult,
    ] = await Promise.all([
      // Total orders today
      Order.countDocuments({
        restaurantId,
        createdAt: { $gte: today, $lt: tomorrow },
      }),

      // Active orders (received, preparing, ready)
      Order.countDocuments({
        restaurantId,
        status: { $in: ['received', 'preparing', 'ready'] },
      }),

      // Status breakdown for today
      Order.aggregate([
        {
          $match: {
            restaurantId: new mongoose.Types.ObjectId(restaurantId.toString()),
            createdAt: { $gte: today, $lt: tomorrow },
          },
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]),

      // Revenue calculation (only served orders)
      Order.aggregate([
        {
          $match: {
            restaurantId: new mongoose.Types.ObjectId(restaurantId.toString()),
            createdAt: { $gte: today, $lt: tomorrow },
            status: 'served',
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$total' },
            orderCount: { $sum: 1 },
          },
        },
      ]),
    ]);

    // Process status breakdown into individual counters
    const statusBreakdown: Record<string, number> = {
      received: 0,
      preparing: 0,
      ready: 0,
      served: 0,
      cancelled: 0,
    };

    statusBreakdownResult.forEach((item: any) => {
      if (item._id in statusBreakdown) {
        statusBreakdown[item._id] = item.count;
      }
    });

    // Calculate revenue and average order value
    const totalRevenue = revenueResult.length > 0 ? revenueResult[0].totalRevenue : 0;
    const servedOrdersCount = revenueResult.length > 0 ? revenueResult[0].orderCount : 0;
    const averageOrderValue = servedOrdersCount > 0 ? totalRevenue / servedOrdersCount : 0;

    // Prepare response data
    const stats = {
      // Overall metrics
      totalOrders: totalOrdersResult,
      activeOrders: activeOrdersResult,
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      averageOrderValue: parseFloat(averageOrderValue.toFixed(2)),

      // Status breakdown
      pendingOrders: statusBreakdown.received,
      preparingOrders: statusBreakdown.preparing,
      readyOrders: statusBreakdown.ready,
      servedOrders: statusBreakdown.served,
      cancelledOrders: statusBreakdown.cancelled,
    };

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

/**
 * @desc    Get active orders for the dashboard
 * @route   GET /api/dashboard/active-orders
 * @access  Private (Admin)
 *
 * Returns orders with status: received, preparing, or ready
 * Sorted by creation time (oldest first) to prioritize urgent orders
 * Includes table and menu item details
 * Limited to 20 most recent active orders
 */
export const getActiveOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    // CRITICAL: Ensure restaurantId is available
    if (!req.restaurantId) {
      res.status(400).json({
        success: false,
        message: 'Restaurant ID is required',
      });
      return;
    }

    const restaurantId = req.restaurantId;

    // Fetch active orders with populated details
    const orders = await Order.find({
      restaurantId,
      status: { $in: ['received', 'preparing', 'ready'] },
    })
      .populate('tableId', 'tableNumber location') // Populate table details
      .populate({
        path: 'items.menuItemId',
        select: 'name price',
      }) // Populate menu item details
      .sort({ createdAt: 1 }) // Oldest first (FIFO - First In, First Out)
      .limit(20) // Limit to 20 orders for dashboard performance
      .lean()
      .exec();

    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (error: any) {
    console.error('Get active orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};
