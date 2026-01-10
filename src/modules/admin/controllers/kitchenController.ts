import { Request, Response } from 'express';
import Order from '../../common/models/Order';
import Customer from '../../common/models/Customer';
import Restaurant from '../../common/models/Restaurant';
import { getSocketService } from '../../common/services/socketService';
import notificationService from '../../../services/notification.service';
import {
  cacheManager,
  CacheKeys,
} from '../../common/utils/cacheUtils';

// @desc    Get kitchen display orders (tenant-scoped) - OPTIMIZED
// @route   GET /api/kitchen/orders
// @access  Private (Admin)
export const getKitchenOrders = async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  let cacheCheckTime = 0;
  let dbQueryTime = 0;

  try {
    const restaurantId = req.restaurantId!.toString();
    const cacheKey = CacheKeys.kitchenOrders(restaurantId);

    // Try cache (10 second TTL for real-time kitchen updates)
    const cacheStart = Date.now();
    const cached = await cacheManager.get<any>(cacheKey);
    cacheCheckTime = Date.now() - cacheStart;

    if (cached) {
      console.log(`[KITCHEN API] Cache HIT - took ${cacheCheckTime}ms`);
      const totalTime = Date.now() - startTime;
      res.status(200).json({
        ...cached,
        cached: true,
        _perf: {
          total: totalTime,
          cache: cacheCheckTime,
          db: 0,
        },
      });
      return;
    }

    console.log(`[KITCHEN API] Cache MISS - querying database`);

    const dbStart = Date.now();

    const orders = await Order.find(
      {
        restaurantId: req.restaurantId,
        status: { $in: ['received', 'preparing', 'ready'] },
      },
      {
        // Select only required fields for kitchen display
        orderNumber: 1,
        tableNumber: 1,
        tableId: 1,
        items: 1,
        total: 1,
        status: 1,
        notes: 1,
        createdAt: 1,
      }
    )
      .populate('tableId', 'tableNumber location')
      .sort({ createdAt: 1 }) // Oldest first (FIFO)
      .lean()
      .exec();

    dbQueryTime = Date.now() - dbStart;

    // Group by status for better kitchen display
    const grouped = {
      received: orders.filter((o) => o.status === 'received'),
      preparing: orders.filter((o) => o.status === 'preparing'),
      ready: orders.filter((o) => o.status === 'ready'),
    };

    const responseData = {
      success: true,
      data: grouped,
      total: orders.length,
    };

    // Cache for 10 seconds (real-time updates important for kitchen)
    await cacheManager.set(cacheKey, responseData, 10000);

    const totalTime = Date.now() - startTime;
    console.log(
      `[KITCHEN API] ✅ TOTAL TIME: ${totalTime}ms (cache: ${cacheCheckTime}ms, db: ${dbQueryTime}ms)`
    );

    res.status(200).json({
      ...responseData,
      cached: false,
      _perf: {
        total: totalTime,
        cache: cacheCheckTime,
        db: dbQueryTime,
      },
    });
  } catch (error: any) {
    console.error('Get kitchen orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Mark order as started (received -> preparing) (tenant-scoped)
// @route   PATCH /api/kitchen/orders/:id/start
// @access  Private (Admin)
export const startOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      restaurantId: req.restaurantId,
    });

    if (!order) {
      res.status(404).json({
        success: false,
        message: 'Order not found',
      });
      return;
    }

    if (order.status !== 'received') {
      res.status(400).json({
        success: false,
        message: `Cannot start order with status: ${order.status}`,
      });
      return;
    }

    order.status = 'preparing';
    order.statusHistory.push({
      status: 'preparing',
      timestamp: new Date(),
      updatedBy: req.admin?._id,
    });

    await order.save();

    // Invalidate kitchen orders cache
    const restaurantId = req.restaurantId!.toString();
    await cacheManager.delete(CacheKeys.kitchenOrders(restaurantId));
    await cacheManager.delete(CacheKeys.activeOrders(restaurantId));
    await cacheManager.delete(CacheKeys.dashboardPageData(restaurantId));

    // Emit Socket.io event to restaurant namespace
    try {
      const socketService = getSocketService();
      socketService.emitOrderStatusUpdate(restaurantId, order.tableNumber, order);
      socketService.emitOrderStatusChange(restaurantId, order);
    } catch (socketError) {
      console.error('Socket emit error (non-critical):', socketError);
    }

    // Send FCM notification to customer if order belongs to authenticated customer
    try {
      if (order.customerId) {
        const customer = await Customer.findById(order.customerId).lean().exec();
        const restaurant = await Restaurant.findById(req.restaurantId).lean().exec();

        if (customer && customer.fcmToken && restaurant) {
          await notificationService.notifyOrderStatusChange(
            customer.fcmToken,
            order._id.toString(),
            order.orderNumber,
            'preparing',
            restaurant.name
          );
          console.log(`✓ FCM notification sent to customer: order ${order.orderNumber} preparing`);
        }
      }
    } catch (fcmError) {
      console.error('FCM notification error (non-critical):', fcmError);
    }

    res.status(200).json({
      success: true,
      message: 'Order started',
      data: order,
    });
  } catch (error: any) {
    console.error('Start order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Mark order as ready (preparing -> ready) (tenant-scoped)
// @route   PATCH /api/kitchen/orders/:id/ready
// @access  Private (Admin)
export const markOrderReady = async (req: Request, res: Response): Promise<void> => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      restaurantId: req.restaurantId,
    });

    if (!order) {
      res.status(404).json({
        success: false,
        message: 'Order not found',
      });
      return;
    }

    if (order.status !== 'preparing') {
      res.status(400).json({
        success: false,
        message: `Cannot mark as ready. Current status: ${order.status}`,
      });
      return;
    }

    order.status = 'ready';
    order.statusHistory.push({
      status: 'ready',
      timestamp: new Date(),
      updatedBy: req.admin?._id,
    });

    await order.save();

    // Invalidate kitchen orders cache
    const restaurantId = req.restaurantId!.toString();
    await cacheManager.delete(CacheKeys.kitchenOrders(restaurantId));
    await cacheManager.delete(CacheKeys.activeOrders(restaurantId));
    await cacheManager.delete(CacheKeys.dashboardPageData(restaurantId));

    // Emit Socket.io event to restaurant namespace
    try {
      const socketService = getSocketService();
      socketService.emitOrderStatusUpdate(restaurantId, order.tableNumber, order);
      socketService.emitOrderStatusChange(restaurantId, order);
    } catch (socketError) {
      console.error('Socket emit error (non-critical):', socketError);
    }

    // Send FCM notification to customer if order belongs to authenticated customer
    try {
      if (order.customerId) {
        const customer = await Customer.findById(order.customerId).lean().exec();
        const restaurant = await Restaurant.findById(req.restaurantId).lean().exec();

        if (customer && customer.fcmToken && restaurant) {
          await notificationService.notifyOrderStatusChange(
            customer.fcmToken,
            order._id.toString(),
            order.orderNumber,
            'ready',
            restaurant.name
          );
          console.log(`✓ FCM notification sent to customer: order ${order.orderNumber} ready`);
        }
      }
    } catch (fcmError) {
      console.error('FCM notification error (non-critical):', fcmError);
    }

    res.status(200).json({
      success: true,
      message: 'Order marked as ready',
      data: order,
    });
  } catch (error: any) {
    console.error('Mark order ready error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get kitchen statistics (tenant-scoped)
// @route   GET /api/kitchen/stats
// @access  Private (Admin)
export const getKitchenStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const restaurantId = req.restaurantId!;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      pendingOrders,
      preparingOrders,
      completedToday,
      avgPrepTime,
    ] = await Promise.all([
      Order.countDocuments({ restaurantId, status: 'received' }),
      Order.countDocuments({ restaurantId, status: 'preparing' }),
      Order.countDocuments({ restaurantId, createdAt: { $gte: today }, status: 'served' }),
      // Calculate average preparation time
      Order.aggregate([
        {
          $match: {
            restaurantId,
            createdAt: { $gte: today },
            status: 'served',
            servedAt: { $exists: true },
          },
        },
        {
          $project: {
            prepTime: {
              $divide: [
                { $subtract: ['$servedAt', '$createdAt'] },
                60000, // Convert to minutes
              ],
            },
          },
        },
        {
          $group: {
            _id: null,
            avgPrepTime: { $avg: '$prepTime' },
          },
        },
      ]),
    ]);

    res.status(200).json({
      success: true,
      data: {
        pendingOrders,
        preparingOrders,
        completedToday,
        averagePreparationTime: avgPrepTime[0]?.avgPrepTime
          ? Math.round(avgPrepTime[0].avgPrepTime)
          : 0,
      },
    });
  } catch (error: any) {
    console.error('Get kitchen stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get order details for kitchen display (tenant-scoped)
// @route   GET /api/kitchen/orders/:id
// @access  Private (Admin)
export const getKitchenOrderDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      restaurantId: req.restaurantId,
    })
      .populate('tableId', 'tableNumber location')
      .lean()
      .exec();

    if (!order) {
      res.status(404).json({
        success: false,
        message: 'Order not found',
      });
      return;
    }

    // Calculate time since order was placed
    const timeSinceOrder = Math.round(
      (Date.now() - new Date(order.createdAt).getTime()) / 1000 / 60
    );

    res.status(200).json({
      success: true,
      data: {
        ...order,
        timeSinceOrder, // in minutes
      },
    });
  } catch (error: any) {
    console.error('Get kitchen order details error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};
