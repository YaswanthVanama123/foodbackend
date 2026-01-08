import { Request, Response } from 'express';
import Order from '../../common/models/Order';
import { calculateItemSubtotal, calculateOrderTotals } from '../../common/services/orderService';
import { getSocketService } from '../../common/services/socketService';

// @desc    Add items to existing order (tenant-scoped)
// @route   POST /api/orders/:id/items
// @access  Private (Admin) or Public (before preparing)
export const addItemsToOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { items } = req.body; // Array of items to add

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Items array is required',
      });
      return;
    }

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

    // Can only add items if order is not yet served or cancelled
    if (order.status === 'served' || order.status === 'cancelled') {
      res.status(400).json({
        success: false,
        message: `Cannot add items to order with status: ${order.status}`,
      });
      return;
    }

    // Calculate subtotals for new items
    const newItems = items.map((item: any) => ({
      ...item,
      subtotal: calculateItemSubtotal(item.price, item.quantity, item.customizations),
    }));

    // Add new items to existing order
    order.items.push(...newItems);

    // Recalculate totals
    const { subtotal, tax, total } = calculateOrderTotals(order.items);
    order.subtotal = subtotal;
    order.tax = tax;
    order.total = total;

    await order.save();

    // Emit Socket.io event to restaurant namespace
    try {
      const socketService = getSocketService();
      const restaurantId = req.restaurantId!.toString();
      socketService.emitOrderUpdate(restaurantId, order._id.toString(), order);
      socketService.emitOrderStatusChange(restaurantId, order);
    } catch (socketError) {
      console.error('Socket emit error (non-critical):', socketError);
    }

    res.status(200).json({
      success: true,
      message: `${newItems.length} items added to order`,
      data: order,
    });
  } catch (error: any) {
    console.error('Add items to order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Remove item from order (tenant-scoped)
// @route   DELETE /api/orders/:id/items/:itemIndex
// @access  Private (Admin)
export const removeItemFromOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { itemIndex } = req.params;

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

    // Can only remove items if order is not yet preparing
    if (order.status !== 'received') {
      res.status(400).json({
        success: false,
        message: `Cannot remove items. Order is already ${order.status}`,
      });
      return;
    }

    const index = parseInt(itemIndex);
    if (index < 0 || index >= order.items.length) {
      res.status(400).json({
        success: false,
        message: 'Invalid item index',
      });
      return;
    }

    // Remove item
    order.items.splice(index, 1);

    // If no items left, cancel the order
    if (order.items.length === 0) {
      order.status = 'cancelled';
      order.statusHistory.push({
        status: 'cancelled',
        timestamp: new Date(),
        updatedBy: req.admin?._id,
      });
    } else {
      // Recalculate totals
      const { subtotal, tax, total } = calculateOrderTotals(order.items);
      order.subtotal = subtotal;
      order.tax = tax;
      order.total = total;
    }

    await order.save();

    // Emit Socket.io event to restaurant namespace
    try {
      const socketService = getSocketService();
      const restaurantId = req.restaurantId!.toString();
      socketService.emitOrderUpdate(restaurantId, order._id.toString(), order);
      socketService.emitOrderStatusChange(restaurantId, order);
    } catch (socketError) {
      console.error('Socket emit error (non-critical):', socketError);
    }

    res.status(200).json({
      success: true,
      message: 'Item removed from order',
      data: order,
    });
  } catch (error: any) {
    console.error('Remove item from order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Update item quantity in order (tenant-scoped)
// @route   PATCH /api/orders/:id/items/:itemIndex/quantity
// @access  Private (Admin)
export const updateItemQuantity = async (req: Request, res: Response): Promise<void> => {
  try {
    const { itemIndex } = req.params;
    const { quantity } = req.body;

    if (!quantity || quantity < 1) {
      res.status(400).json({
        success: false,
        message: 'Valid quantity is required (min: 1)',
      });
      return;
    }

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

    // Can only update quantity if order is not yet preparing
    if (order.status !== 'received') {
      res.status(400).json({
        success: false,
        message: `Cannot update quantity. Order is already ${order.status}`,
      });
      return;
    }

    const index = parseInt(itemIndex);
    if (index < 0 || index >= order.items.length) {
      res.status(400).json({
        success: false,
        message: 'Invalid item index',
      });
      return;
    }

    // Update quantity and recalculate subtotal
    const item = order.items[index];
    item.quantity = quantity;
    item.subtotal = calculateItemSubtotal(
      item.price,
      item.quantity,
      item.customizations as any
    );

    // Recalculate order totals
    const { subtotal, tax, total } = calculateOrderTotals(order.items);
    order.subtotal = subtotal;
    order.tax = tax;
    order.total = total;

    await order.save();

    // Emit Socket.io event to restaurant namespace
    try {
      const socketService = getSocketService();
      const restaurantId = req.restaurantId!.toString();
      socketService.emitOrderUpdate(restaurantId, order._id.toString(), order);
      socketService.emitOrderStatusChange(restaurantId, order);
    } catch (socketError) {
      console.error('Socket emit error (non-critical):', socketError);
    }

    res.status(200).json({
      success: true,
      message: 'Item quantity updated',
      data: order,
    });
  } catch (error: any) {
    console.error('Update item quantity error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Add note to order (tenant-scoped)
// @route   PATCH /api/orders/:id/notes
// @access  Private (Admin) or Public
export const addOrderNote = async (req: Request, res: Response): Promise<void> => {
  try {
    const { notes } = req.body;

    if (!notes || typeof notes !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Notes are required',
      });
      return;
    }

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

    order.notes = notes;
    await order.save();

    // Emit Socket.io event to restaurant namespace
    try {
      const socketService = getSocketService();
      const restaurantId = req.restaurantId!.toString();
      socketService.emitOrderUpdate(restaurantId, order._id.toString(), order);
    } catch (socketError) {
      console.error('Socket emit error (non-critical):', socketError);
    }

    res.status(200).json({
      success: true,
      message: 'Notes updated',
      data: order,
    });
  } catch (error: any) {
    console.error('Add order note error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Duplicate order (reorder) (tenant-scoped)
// @route   POST /api/orders/:id/duplicate
// @access  Public
export const duplicateOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tableId } = req.body;

    if (!tableId) {
      res.status(400).json({
        success: false,
        message: 'Table ID is required',
      });
      return;
    }

    const originalOrder = await Order.findOne({
      _id: req.params.id,
      restaurantId: req.restaurantId,
    }).lean().exec();

    if (!originalOrder) {
      res.status(404).json({
        success: false,
        message: 'Original order not found',
      });
      return;
    }

    // Create new order with same items
    const newOrder = await Order.create({
      restaurantId: req.restaurantId,
      tableId,
      tableNumber: originalOrder.tableNumber,
      items: originalOrder.items,
      subtotal: originalOrder.subtotal,
      tax: originalOrder.tax,
      total: originalOrder.total,
      notes: `Reorder of ${originalOrder.orderNumber}`,
      status: 'received',
    });

    // Populate table info
    await newOrder.populate('tableId', 'tableNumber location');

    // Emit Socket.io event to restaurant namespace
    try {
      const socketService = getSocketService();
      const restaurantId = req.restaurantId!.toString();
      socketService.emitNewOrder(restaurantId, {
        orderId: newOrder._id,
        orderNumber: newOrder.orderNumber,
        tableNumber: newOrder.tableNumber,
        items: newOrder.items,
        total: newOrder.total,
        status: newOrder.status,
        createdAt: newOrder.createdAt,
      });
    } catch (socketError) {
      console.error('Socket emit error (non-critical):', socketError);
    }

    res.status(201).json({
      success: true,
      message: 'Order duplicated successfully',
      data: newOrder,
    });
  } catch (error: any) {
    console.error('Duplicate order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get order modification history (tenant-scoped)
// @route   GET /api/orders/:id/modifications
// @access  Private (Admin)
export const getOrderModifications = async (req: Request, res: Response): Promise<void> => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      restaurantId: req.restaurantId,
    })
      .select('statusHistory createdAt updatedAt')
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
      data: {
        statusHistory: order.statusHistory,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      },
    });
  } catch (error: any) {
    console.error('Get order modifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};
