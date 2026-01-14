import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Order from '../../common/models/Order';
import Table from '../../common/models/Table';
import Customer from '../../common/models/Customer';
import Restaurant from '../../common/models/Restaurant';
import Admin from '../../common/models/Admin';
import SuperAdmin from '../../common/models/SuperAdmin';
import {
  calculateOrderTotals,
  calculateItemSubtotal,
  getActiveOrders,
  getOrdersByTable,
  updateOrderStatus as updateOrderStatusService,
  getDashboardStats,
} from '../../common/services/orderService';
import { getSocketService } from '../../common/services/socketService';
import notificationService from '../../../services/notification.service';
import firebaseService from '../../../services/firebase.service';
import {
  cacheManager,
  CacheKeys,
} from '../../common/utils/cacheUtils';

// @desc    Get all orders (tenant-scoped) - OPTIMIZED
// @route   GET /api/orders
// @access  Private (Admin)
export const getOrders = async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  let cacheCheckTime = 0;
  let dbQueryTime = 0;

  try {
    const { status, tableId, page = 1, limit = 50 } = req.query;
    const restaurantId = req.restaurantId!.toString();

    // Enforce max pagination limit
    const safeLimit = Math.min(Number(limit), 100);

    // Create cache key based on filters
    const filterKey = `p:${page}_l:${safeLimit}_s:${status || 'all'}_t:${tableId || 'all'}`;
    const cacheKey = CacheKeys.ordersList(restaurantId, filterKey);

    // Try cache (15 second TTL for orders list)
    const cacheStart = Date.now();
    const cached = await cacheManager.get<any>(cacheKey);
    cacheCheckTime = Date.now() - cacheStart;

    if (cached) {
      console.log(`[ORDERS API] Cache HIT - took ${cacheCheckTime}ms`);
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

    console.log(`[ORDERS API] Cache MISS - querying database`);

    const dbStart = Date.now();

    // CRITICAL: Filter by restaurant
    const filter: any = {
      restaurantId: req.restaurantId,
    };

    if (status) {
      filter.status = status;
    }

    if (tableId) {
      filter.tableId = tableId;
    }

    const skip = (Number(page) - 1) * safeLimit;

    const [orders, total] = await Promise.all([
      Order.find(
        filter,
        {
          // Select only required fields for performance
          orderNumber: 1,
          tableNumber: 1,
          tableId: 1,
          items: 1,
          subtotal: 1,
          tax: 1,
          total: 1,
          status: 1,
          createdAt: 1,
          notes: 1,
        }
      )
        .populate('tableId', 'tableNumber location')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .lean()
        .exec(),
      Order.countDocuments(filter),
    ]);

    dbQueryTime = Date.now() - dbStart;

    const responseData = {
      success: true,
      data: orders,
      pagination: {
        page: Number(page),
        limit: safeLimit,
        total,
        pages: Math.ceil(total / safeLimit),
      },
    };

    // Cache for 15 seconds
    await cacheManager.set(cacheKey, responseData, 15000);

    const totalTime = Date.now() - startTime;
    console.log(
      `[ORDERS API] ✅ TOTAL TIME: ${totalTime}ms (cache: ${cacheCheckTime}ms, db: ${dbQueryTime}ms)`
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
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get active orders (tenant-scoped)
// @route   GET /api/orders/active
// @access  Private (Admin)
export const getActiveOrdersController = async (req: Request, res: Response): Promise<void> => {
  try {
    const orders = await getActiveOrders(req.restaurantId!.toString());

    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get order by ID (tenant-scoped)
// @route   GET /api/orders/:id
// @access  Public
export const getOrderById = async (req: Request, res: Response): Promise<void> => {
  try {
    // CRITICAL: Include restaurantId in query
    const order = await Order.findOne(
      {
        _id: req.params.id,
        restaurantId: req.restaurantId,
      },
      {
        // Select fields for single order view
        orderNumber: 1,
        tableNumber: 1,
        tableId: 1,
        items: 1,
        subtotal: 1,
        tax: 1,
        total: 1,
        status: 1,
        statusHistory: 1,
        notes: 1,
        createdAt: 1,
        updatedAt: 1,
        servedAt: 1,
      }
    )
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

    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get orders for specific table (tenant-scoped)
// @route   GET /api/orders/table/:tableId
// @access  Public
export const getTableOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const orders = await getOrdersByTable(req.params.tableId, req.restaurantId!.toString());

    res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Create order (tenant-scoped) - OPTIMIZED
// @route   POST /api/orders
// @access  Public (supports both authenticated customers and guests)
//
// OPTIMIZATIONS:
// - Transaction for atomic order creation + table update
// - Fire-and-forget notifications (socket + FCM)
// - Fixed customer populate (username only)
// - Performance monitoring
// Target: <80ms (down from 425ms)
export const createOrder = async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  let dbQueryTime = 0;

  try {
    const { tableId, items, notes, tip = 0 } = req.body;

    // OPTIMIZATION: Retry logic for race conditions
    let order: any;
    let retries = 0;
    const maxRetries = 5;

    while (retries < maxRetries) {
      // Start new transaction for each attempt
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const dbStart = Date.now();

        // CRITICAL: Verify table exists and belongs to this restaurant
        const table = await Table.findOne(
          {
            _id: tableId,
            restaurantId: req.restaurantId,
          },
          { tableNumber: 1, isActive: 1 }
        )
          .lean()
          .session(session)
          .exec();

        if (!table) {
          await session.abortTransaction();
          session.endSession();
          res.status(404).json({
            success: false,
            message: 'Table not found',
          });
          return;
        }

        if (!table.isActive) {
          await session.abortTransaction();
          session.endSession();
          res.status(400).json({
            success: false,
            message: 'Table is not active',
          });
          return;
        }

        // Calculate item subtotals
        const orderItems = items.map((item: any) => ({
          ...item,
          subtotal: calculateItemSubtotal(item.price, item.quantity, item.customizations),
        }));

        // Calculate totals with tip
        const { subtotal, tax, total } = calculateOrderTotals(orderItems, tip);

        // CRITICAL: Create order with restaurantId and optional customerId
        const orderData: any = {
          restaurantId: req.restaurantId,
          tableId,
          tableNumber: table.tableNumber,
          items: orderItems,
          subtotal,
          tax,
          tip,
          total,
          notes,
          status: 'received',
        };

        // If customer is authenticated, add customerId to order
        if (req.customer) {
          orderData.customerId = req.customer._id;
        }

        // Create order within transaction
        [order] = await Order.create([orderData], { session });

        await Table.findByIdAndUpdate(
          tableId,
          {
            isOccupied: true,
            currentOrderId: order._id,
          },
          { session }
        );

        // Commit transaction
        await session.commitTransaction();
        session.endSession();
        dbQueryTime = Date.now() - dbStart;
        break; // Success - exit retry loop
      } catch (error: any) {
        // Abort transaction on error
        await session.abortTransaction();
        session.endSession();

        // Check if it's a duplicate key error on orderNumber
        if (error.code === 11000 && error.keyPattern?.orderNumber) {
          retries++;
          if (retries >= maxRetries) {
            throw new Error(`Failed to create order after ${maxRetries} retries due to orderNumber conflicts`);
          }
          console.log(`[ORDER API] Duplicate orderNumber detected, retrying (${retries}/${maxRetries})...`);
          // Wait a bit before retry with exponential backoff
          await new Promise(resolve => setTimeout(resolve, 50 * Math.pow(2, retries)));
          continue; // Retry with new transaction
        }
        // If it's not a duplicate key error, throw it
        throw error;
      }
    }

    if (!order) {
      throw new Error('Failed to create order');
    }

    // OPTIMIZATION: Populate order details AFTER transaction (only for response)
    const populatedOrder = await Order.findById(
      order._id,
      {
        orderNumber: 1,
        tableNumber: 1,
        tableId: 1,
        customerId: 1,
        items: 1,
        subtotal: 1,
        tax: 1,
        total: 1,
        status: 1,
        createdAt: 1,
      }
    )
      .populate('tableId', 'tableNumber location')
      .populate('customerId', 'username') // FIXED: Customer only has username
      .lean()
      .exec();

    const totalTime = Date.now() - startTime;
    console.log(`[ORDER API] ✅ Order created in ${totalTime}ms (db: ${dbQueryTime}ms)`);

    // OPTIMIZATION: Fire-and-forget socket and FCM notifications (don't await)
    setImmediate(() => {
      // Socket notification
      try {
        const socketService = getSocketService();
        socketService.emitNewOrder(req.restaurantId!.toString(), {
          orderId: order._id,
          orderNumber: order.orderNumber,
          tableNumber: order.tableNumber,
          items: order.items,
          total: order.total,
          status: order.status,
          createdAt: order.createdAt,
          customerId: order.customerId,
        });
      } catch (socketError) {
        console.error('[ORDER API] Socket emit failed:', socketError);
      }

      // FCM notification (async, don't block response)
      (async () => {
        try {
          const restaurantId = req.restaurantId!.toString();
          const [admins, restaurant] = await Promise.all([
            Admin.find(
              {
                restaurantId: req.restaurantId,
                isActive: true,
                fcmTokens: { $exists: true, $ne: [] }, // Check for non-empty array
              },
              { fcmTokens: 1 }
            )
              .lean()
              .exec(),
            Restaurant.findById(restaurantId, { name: 1 })
              .lean()
              .exec(),
          ]);

          if (admins.length > 0) {
            // Flatten all tokens from all admins
            const adminTokens = admins.flatMap((admin) => admin.fcmTokens || []).filter(Boolean);

            if (adminTokens.length > 0 && restaurant) {
              await firebaseService.sendActiveNotification(
                adminTokens,
                {
                  title: 'New Order Received',
                  body: `Order #${order.orderNumber} from Table ${order.tableNumber} - Total: $${order.total.toFixed(2)}`,
                },
                {
                  orderId: order._id.toString(),
                  orderNumber: order.orderNumber,
                  tableNumber: order.tableNumber.toString(),
                  total: order.total.toString(),
                  status: order.status,
                  restaurantId,
                  restaurantName: restaurant.name,
                }
              );
            }
          }

          // Send FCM notification to ALL super admins (fire-and-forget)
          try {
            const superAdmins = await SuperAdmin.find(
              {
                isActive: true,
                fcmTokens: { $exists: true, $ne: [] },
              },
              { fcmTokens: 1 }
            )
              .lean()
              .exec();

            if (superAdmins.length > 0) {
              const superAdminTokens = superAdmins.flatMap((sa) => sa.fcmTokens || []).filter(Boolean);

              if (superAdminTokens.length > 0 && restaurant) {
                await firebaseService.sendActiveNotification(
                  superAdminTokens,
                  {
                    title: `New Order - ${restaurant.name}`,
                    body: `Order #${order.orderNumber} from Table ${order.tableNumber} - Total: $${order.total.toFixed(2)}`,
                  },
                  {
                    orderId: order._id.toString(),
                    orderNumber: order.orderNumber,
                    tableNumber: order.tableNumber.toString(),
                    total: order.total.toString(),
                    status: order.status,
                    restaurantId,
                    restaurantName: restaurant.name,
                    type: 'new_order',
                  }
                );
                console.log(`✅ Notification sent to ${superAdmins.length} super admin(s) for new order`);
              }
            }
          } catch (superAdminFcmError) {
            console.error('[ORDER API] Super admin FCM notification failed:', superAdminFcmError);
          }
        } catch (fcmError) {
          console.error('[ORDER API] FCM notification failed:', fcmError);
        }
      })();
    });

    res.status(201).json({
      success: true,
      data: populatedOrder,
      _perf: {
        total: totalTime,
        db: dbQueryTime,
      },
    });
  } catch (error: any) {
    console.error('[ORDER API] Create order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Update order status (tenant-scoped)
// @route   PATCH /api/orders/:id/status
// @access  Private (Admin)
export const updateOrderStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status } = req.body;
    const adminId = req.admin?._id.toString();
    const restaurantId = req.restaurantId!.toString();

    const order = await updateOrderStatusService(
      req.params.id,
      status,
      restaurantId,
      adminId
    );

    const populatedOrder = await Order.findById(
      order._id,
      {
        orderNumber: 1,
        tableNumber: 1,
        tableId: 1,
        customerId: 1,
        items: 1,
        subtotal: 1,
        tax: 1,
        total: 1,
        status: 1,
        statusHistory: 1,
        createdAt: 1,
      }
    )
      .populate('tableId', 'tableNumber location')
      .lean()
      .exec();

    // CRITICAL: Emit status update to restaurant namespace
    try {
      const socketService = getSocketService();

      // Emit to table room for customers
      socketService.emitOrderStatusUpdate(
        restaurantId,
        order.tableNumber,
        populatedOrder!
      );

      // Emit to admin room for all admins
      socketService.emitOrderStatusChange(restaurantId, populatedOrder!);
    } catch (socketError) {
      // Continue even if socket fails
    }

    // Send FCM notification to customer if order belongs to authenticated customer
    try {
      if (order.customerId) {
        const [customer, restaurant] = await Promise.all([
          Customer.findById(order.customerId, { fcmToken: 1 })
            .lean()
            .exec(),
          Restaurant.findById(restaurantId, { name: 1 })
            .lean()
            .exec(),
        ]);

        if (customer && customer.fcmToken && restaurant) {
          await notificationService.notifyOrderStatusChange(
            customer.fcmToken,
            order._id.toString(),
            order.orderNumber,
            status,
            restaurant.name
          );
        }
      }
    } catch (fcmError) {
      // Continue even if FCM fails
    }

    // Send active FCM notifications to all admins in the restaurant
    try {
      const [admins, restaurant] = await Promise.all([
        Admin.find(
          {
            restaurantId: req.restaurantId,
            isActive: true,
            fcmTokens: { $exists: true, $ne: [] }, // Check for non-empty array
          },
          { fcmTokens: 1 }
        )
          .lean()
          .exec(),
        Restaurant.findById(restaurantId, { name: 1 })
          .lean()
          .exec(),
      ]);

      if (admins.length > 0 && restaurant) {
        // Flatten all tokens from all admins
        const adminTokens = admins.flatMap((admin) => admin.fcmTokens || []).filter(Boolean);

        if (adminTokens.length > 0) {
          // Map status to user-friendly message
          const statusMessages: Record<string, string> = {
            received: 'has been received',
            preparing: 'is being prepared',
            ready: 'is ready',
            served: 'has been served',
            completed: 'has been completed',
            cancelled: 'has been cancelled',
          };

          const statusMessage = statusMessages[status] || `status changed to ${status}`;

          await firebaseService.sendActiveNotification(
            adminTokens,
            {
              title: 'Order Status Update',
              body: `Order #${order.orderNumber} from Table ${order.tableNumber} ${statusMessage}`,
            },
            {
              orderId: order._id.toString(),
              orderNumber: order.orderNumber,
              tableNumber: order.tableNumber.toString(),
              status,
              restaurantId,
              restaurantName: restaurant.name,
            }
          );
        }
      }
    } catch (adminFcmError) {
      // Continue even if FCM fails
    }

    // Send FCM notification to ALL super admins for "served" status
    if (status === 'served') {
      try {
        const [superAdmins, restaurant] = await Promise.all([
          SuperAdmin.find(
            {
              isActive: true,
              fcmTokens: { $exists: true, $ne: [] },
            },
            { fcmTokens: 1 }
          )
            .lean()
            .exec(),
          Restaurant.findById(restaurantId, { name: 1 })
            .lean()
            .exec(),
        ]);

        if (superAdmins.length > 0 && restaurant) {
          const superAdminTokens = superAdmins.flatMap((sa) => sa.fcmTokens || []).filter(Boolean);

          if (superAdminTokens.length > 0) {
            await firebaseService.sendActiveNotification(
              superAdminTokens,
              {
                title: `Order Served - ${restaurant.name}`,
                body: `Order #${order.orderNumber} from Table ${order.tableNumber} has been served`,
              },
              {
                orderId: order._id.toString(),
                orderNumber: order.orderNumber,
                tableNumber: order.tableNumber.toString(),
                status,
                restaurantId,
                restaurantName: restaurant.name,
                type: 'order_served',
              }
            );
            console.log(`✅ Notification sent to ${superAdmins.length} super admin(s) for order served`);
          }
        }
      } catch (superAdminFcmError) {
        console.error('[ORDER API] Super admin FCM notification failed:', superAdminFcmError);
      }
    }

    // CRITICAL: Auto-delete customer account when ALL orders are served/cancelled
    // This allows username to be reused for new registrations
    try {
      if (status === 'served' && order.customerId) {
        const customerId = order.customerId.toString();

        // Check if customer has any other active orders (not served/cancelled)
        const activeOrders = await Order.countDocuments({
          customerId: order.customerId,
          status: { $nin: ['served', 'cancelled'] },
        }).exec();

        console.log(
          `[Customer Auto-Delete] Customer ${customerId} has ${activeOrders} active orders remaining`
        );

        // If no active orders remain, permanently delete the customer
        if (activeOrders === 0) {
          console.log(
            `[Customer Auto-Delete] Deleting customer ${customerId} - all orders completed`
          );

          // Delete customer permanently (this frees up the username)
          await Customer.findByIdAndDelete(customerId).exec();

          console.log(
            `[Customer Auto-Delete] ✓ Customer ${customerId} deleted successfully. Username is now available for re-registration.`
          );
        }
      }
    } catch (customerDeleteError) {
      // Log error but don't fail the request
      console.error('[Customer Auto-Delete] Error during customer deletion:', customerDeleteError);
    }

    res.status(200).json({
      success: true,
      data: populatedOrder,
    });
  } catch (error: any) {
    if (error.message === 'Order not found') {
      res.status(404).json({
        success: false,
        message: error.message,
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Cancel order (tenant-scoped)
// @route   DELETE /api/orders/:id
// @access  Private (Admin)
export const cancelOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    // CRITICAL: Find order with restaurantId validation
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

    if (order.status === 'served' || order.status === 'cancelled') {
      res.status(400).json({
        success: false,
        message: `Cannot cancel order with status: ${order.status}`,
      });
      return;
    }

    order.status = 'cancelled';
    order.statusHistory.push({
      status: 'cancelled',
      timestamp: new Date(),
      updatedBy: req.admin?._id,
    });

    await order.save();

    // Update table occupancy
    await Table.findByIdAndUpdate(order.tableId, {
      isOccupied: false,
      currentOrderId: undefined,
    });

    // CRITICAL: Emit cancellation to restaurant namespace
    try {
      const socketService = getSocketService();
      const restaurantId = req.restaurantId!.toString();

      socketService.emitOrderStatusUpdate(restaurantId, order.tableNumber, order);
      socketService.emitOrderStatusChange(restaurantId, order);
    } catch (socketError) {
      // Continue even if socket fails
    }

    // Send FCM notification to customer if order belongs to authenticated customer
    try {
      if (order.customerId) {
        const [customer, restaurant] = await Promise.all([
          Customer.findById(order.customerId, { fcmToken: 1 })
            .lean()
            .exec(),
          Restaurant.findById(req.restaurantId, { name: 1 })
            .lean()
            .exec(),
        ]);

        if (customer && customer.fcmToken && restaurant) {
          await notificationService.notifyOrderStatusChange(
            customer.fcmToken,
            order._id.toString(),
            order.orderNumber,
            'cancelled',
            restaurant.name
          );
        }
      }
    } catch (fcmError) {
      // Continue even if FCM fails
    }

    res.status(200).json({
      success: true,
      message: 'Order cancelled successfully',
      data: order,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get order history (tenant-scoped)
// @route   GET /api/orders/history
// @access  Private (Admin)
export const getOrderHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = 1, limit = 20, startDate, endDate } = req.query;

    // Enforce max pagination limit
    const safeLimit = Math.min(Number(limit), 100);

    // CRITICAL: Filter by restaurant
    const filter: any = {
      restaurantId: req.restaurantId,
      status: { $in: ['served', 'cancelled'] },
    };

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate as string);
      }
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    const skip = (Number(page) - 1) * safeLimit;

    const [orders, total] = await Promise.all([
      Order.find(
        filter,
        {
          // Select only required fields for performance
          orderNumber: 1,
          tableNumber: 1,
          tableId: 1,
          items: 1,
          subtotal: 1,
          tax: 1,
          total: 1,
          status: 1,
          createdAt: 1,
          servedAt: 1,
        }
      )
        .populate('tableId', 'tableNumber location')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .lean()
        .exec(),
      Order.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: orders,
      pagination: {
        page: Number(page),
        limit: safeLimit,
        total,
        pages: Math.ceil(total / safeLimit),
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get dashboard stats (tenant-scoped)
// @route   GET /api/dashboard/stats
// @access  Private (Admin)
export const getDashboardStatsController = async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = await getDashboardStats(req.restaurantId!.toString());

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};
