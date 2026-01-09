import { Request, Response } from 'express';
import Order from '../../common/models/Order';
import Table from '../../common/models/Table';
import {
  calculateOrderTotals,
  calculateItemSubtotal,
  getActiveOrders,
  getOrdersByTable,
  updateOrderStatus as updateOrderStatusService,
  getDashboardStats,
} from '../../common/services/orderService';
import { getSocketService } from '../../common/services/socketService';

// @desc    Get all orders (tenant-scoped)
// @route   GET /api/orders
// @access  Private (Admin)
export const getOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, tableId, page = 1, limit = 50 } = req.query;

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

    const skip = (Number(page) - 1) * Number(limit);

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate('tableId', 'tableNumber location')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean()
        .exec(),
      Order.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: orders,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error: any) {
    console.error('Get orders error:', error);
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
    console.error('Get active orders error:', error);
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

    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error: any) {
    console.error('Get order by ID error:', error);
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
    console.error('Get table orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Create order (tenant-scoped)
// @route   POST /api/orders
// @access  Public (supports both authenticated customers and guests)
export const createOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tableId, items, notes } = req.body;

    // CRITICAL: Verify table exists and belongs to this restaurant
    const table = await Table.findOne({
      _id: tableId,
      restaurantId: req.restaurantId,
    }).lean().exec();

    if (!table) {
      res.status(404).json({
        success: false,
        message: 'Table not found',
      });
      return;
    }

    if (!table.isActive) {
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

    // Calculate totals
    const { subtotal, tax, total } = calculateOrderTotals(orderItems);

    // CRITICAL: Create order with restaurantId and optional customerId
    const orderData: any = {
      restaurantId: req.restaurantId,
      tableId,
      tableNumber: table.tableNumber,
      items: orderItems,
      subtotal,
      tax,
      total,
      notes,
      status: 'received',
    };

    // If customer is authenticated, add customerId to order
    if (req.customer) {
      orderData.customerId = req.customer._id;
      console.log(`✓ Order created by authenticated customer: ${req.customer.username}`);
    } else {
      console.log('✓ Order created by guest user');
    }

    const order = await Order.create(orderData);

    // Update table occupancy
    await Table.findByIdAndUpdate(tableId, {
      isOccupied: true,
      currentOrderId: order._id,
    });

    // Populate table info for response
    const populatedOrder = await Order.findById(order._id)
      .populate('tableId', 'tableNumber location')
      .populate('customerId', 'firstName lastName email')
      .lean()
      .exec();

    // CRITICAL: Emit new order event to restaurant namespace
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
      console.log('✓ New order emitted to admin room:', order.orderNumber);
    } catch (socketError) {
      console.error('Socket emit error (non-critical):', socketError);
      // Continue even if socket fails
    }

    res.status(201).json({
      success: true,
      data: populatedOrder,
    });
  } catch (error: any) {
    console.error('Create order error:', error);
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

    const populatedOrder = await Order.findById(order._id)
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

      console.log(`✓ Order status updated: ${order.orderNumber} -> ${status}`);
    } catch (socketError) {
      console.error('Socket emit error (non-critical):', socketError);
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

    console.error('Update order status error:', error);
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
      console.error('Socket emit error (non-critical):', socketError);
    }

    res.status(200).json({
      success: true,
      message: 'Order cancelled successfully',
      data: order,
    });
  } catch (error: any) {
    console.error('Cancel order error:', error);
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

    const skip = (Number(page) - 1) * Number(limit);

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate('tableId', 'tableNumber location')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean()
        .exec(),
      Order.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: orders,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error: any) {
    console.error('Get order history error:', error);
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
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};
