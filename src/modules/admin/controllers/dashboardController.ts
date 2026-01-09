import { Request, Response } from 'express';
import Order from '../../common/models/Order';
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
      preparationTimeResult,
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

      // Average preparation time (time from received to ready status)
      Order.aggregate([
        {
          $match: {
            restaurantId: new mongoose.Types.ObjectId(restaurantId.toString()),
            createdAt: { $gte: today, $lt: tomorrow },
            status: { $in: ['ready', 'served'] },
          },
        },
        {
          $addFields: {
            preparationTime: {
              $cond: {
                if: {
                  $and: [
                    { $isArray: '$statusHistory' },
                    { $gt: [{ $size: '$statusHistory' }, 0] },
                  ],
                },
                then: {
                  $subtract: [
                    {
                      $let: {
                        vars: {
                          readyStatus: {
                            $arrayElemAt: [
                              {
                                $filter: {
                                  input: '$statusHistory',
                                  as: 'history',
                                  cond: { $eq: ['$$history.status', 'ready'] },
                                },
                              },
                              0,
                            ],
                          },
                        },
                        in: { $ifNull: ['$$readyStatus.timestamp', '$createdAt'] },
                      },
                    },
                    '$createdAt',
                  ],
                },
                else: null,
              },
            },
          },
        },
        {
          $match: {
            preparationTime: { $ne: null },
          },
        },
        {
          $group: {
            _id: null,
            avgPrepTime: { $avg: '$preparationTime' },
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

    // Calculate average preparation time in minutes
    const avgPrepTimeMs = preparationTimeResult.length > 0 ? preparationTimeResult[0].avgPrepTime : 0;
    const averagePreparationTime = Math.round(avgPrepTimeMs / 60000); // Convert ms to minutes

    // Prepare response data (using frontend-expected field names)
    const stats = {
      // Overall metrics - matching frontend DashboardStats interface
      todayOrders: totalOrdersResult,
      todayRevenue: parseFloat(totalRevenue.toFixed(2)),
      activeOrders: activeOrdersResult,
      averagePreparationTime: averagePreparationTime,

      // Additional metrics
      averageOrderValue: parseFloat(averageOrderValue.toFixed(2)),

      // Status breakdown
      ordersByStatus: {
        received: statusBreakdown.received,
        preparing: statusBreakdown.preparing,
        ready: statusBreakdown.ready,
        served: statusBreakdown.served,
      },
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
