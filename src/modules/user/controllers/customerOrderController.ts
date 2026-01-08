import { Request, Response } from 'express';
import Order from '../../common/models/Order';
import MenuItem, { IMenuItem } from '../../common/models/MenuItem';
import Table from '../../common/models/Table';
import { calculateOrderTotals, calculateItemSubtotal } from '../../common/services/orderService';
import { Types } from 'mongoose';

/**
 * @desc    Get customer's order history
 * @route   GET /api/customers/orders
 * @access  Private (Customer)
 */
export const getOrderHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const customerId = req.customer?._id;
    const restaurantId = req.restaurantId;
    const { page = 1, limit = 20, status } = req.query;

    if (!customerId) {
      res.status(401).json({
        success: false,
        message: 'Customer authentication required',
      });
      return;
    }

    // Build filter
    const filter: any = {
      restaurantId,
      customerId,
    };

    // Add status filter if provided
    if (status) {
      const statusArray = (status as string).split(',');
      const validStatuses = ['received', 'preparing', 'ready', 'served', 'cancelled'];
      const filteredStatuses = statusArray.filter((s) => validStatuses.includes(s));

      if (filteredStatuses.length > 0) {
        filter.status = { $in: filteredStatuses };
      }
    }

    const skip = (Number(page) - 1) * Number(limit);

    // Fetch orders with pagination
    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate('tableId', 'tableNumber location')
        .populate('items.menuItemId', 'name image isAvailable')
        .sort({ createdAt: -1 }) // Newest first
        .skip(skip)
        .limit(Number(limit))
        .lean()
        .exec(),
      Order.countDocuments(filter),
    ]);

    const hasMore = total > skip + orders.length;

    res.status(200).json({
      success: true,
      data: {
        orders,
        page: Number(page),
        limit: Number(limit),
        total,
        hasMore,
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

/**
 * @desc    Get single order details
 * @route   GET /api/customers/orders/:orderId
 * @access  Private (Customer)
 */
export const getOrderDetails = async (req: Request, res: Response): Promise<void> => {
  try {
    const customerId = req.customer?._id;
    const restaurantId = req.restaurantId;
    const { orderId } = req.params;

    if (!customerId) {
      res.status(401).json({
        success: false,
        message: 'Customer authentication required',
      });
      return;
    }

    // Validate orderId format
    if (!Types.ObjectId.isValid(orderId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid order ID format',
      });
      return;
    }

    // Fetch order with full details
    const order = await Order.findOne({
      _id: orderId,
      restaurantId,
      customerId, // Ensure order belongs to customer
    })
      .populate('tableId', 'tableNumber location capacity')
      .populate('items.menuItemId', 'name description image price isAvailable categoryId')
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
    console.error('Get order details error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

/**
 * @desc    Create new order from previous order (Reorder)
 * @route   POST /api/customers/orders/:orderId/reorder
 * @access  Private (Customer)
 */
export const reorder = async (req: Request, res: Response): Promise<void> => {
  try {
    const customerId = req.customer?._id;
    const restaurantId = req.restaurantId;
    const { orderId } = req.params;
    const { tableId, notes } = req.body;

    if (!customerId) {
      res.status(401).json({
        success: false,
        message: 'Customer authentication required',
      });
      return;
    }

    // Validate orderId format
    if (!Types.ObjectId.isValid(orderId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid order ID format',
      });
      return;
    }

    // Fetch original order and verify ownership
    const originalOrder = await Order.findOne({
      _id: orderId,
      restaurantId,
      customerId, // Verify order belongs to customer
    })
      .lean()
      .exec();

    if (!originalOrder) {
      res.status(404).json({
        success: false,
        message: 'Original order not found or does not belong to you',
      });
      return;
    }

    // Determine tableId to use
    let targetTableId: Types.ObjectId;

    if (tableId) {
      // Use provided tableId
      if (!Types.ObjectId.isValid(tableId)) {
        res.status(400).json({
          success: false,
          message: 'Invalid table ID format',
        });
        return;
      }
      targetTableId = new Types.ObjectId(tableId);
    } else {
      // Use original order's table as fallback
      targetTableId = originalOrder.tableId;
    }

    // Verify table exists and belongs to restaurant
    const table = await Table.findOne({
      _id: targetTableId,
      restaurantId,
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

    // Extract menu item IDs from original order
    const menuItemIds = originalOrder.items.map((item) => item.menuItemId);

    // Fetch current menu items to validate availability and get current prices
    const menuItems = await MenuItem.find({
      _id: { $in: menuItemIds },
      restaurantId,
    })
      .lean()
      .exec();

    if (menuItems.length === 0) {
      res.status(400).json({
        success: false,
        message: 'No items from original order are currently available',
      });
      return;
    }

    // Create a map of menu items for quick lookup
    const menuItemMap = new Map<string, IMenuItem>(
      menuItems.map((item: any) => [item._id.toString(), item])
    );

    // Validate all items and check availability
    const unavailableItems: string[] = [];
    const priceChanges: Array<{ name: string; oldPrice: number; newPrice: number }> = [];
    const newOrderItems: any[] = [];

    for (const originalItem of originalOrder.items) {
      const menuItemIdStr = originalItem.menuItemId.toString();
      const currentMenuItem = menuItemMap.get(menuItemIdStr);

      if (!currentMenuItem) {
        unavailableItems.push(originalItem.name);
        continue;
      }

      if (!currentMenuItem.isAvailable) {
        unavailableItems.push(currentMenuItem.name);
        continue;
      }

      // Check for price changes
      if (currentMenuItem.price !== originalItem.price) {
        priceChanges.push({
          name: currentMenuItem.name,
          oldPrice: originalItem.price,
          newPrice: currentMenuItem.price,
        });
      }

      // Create new order item with current price
      const newItem = {
        menuItemId: currentMenuItem._id,
        name: currentMenuItem.name,
        price: currentMenuItem.price, // Use current price
        quantity: originalItem.quantity,
        customizations: originalItem.customizations,
        specialInstructions: originalItem.specialInstructions,
        subtotal: calculateItemSubtotal(
          currentMenuItem.price,
          originalItem.quantity,
          originalItem.customizations
        ),
      };

      newOrderItems.push(newItem);
    }

    // If no items are available, return error
    if (newOrderItems.length === 0) {
      res.status(400).json({
        success: false,
        message: 'None of the items from the original order are currently available',
        unavailableItems,
      });
      return;
    }

    // Calculate totals for new order
    const { subtotal, tax, total } = calculateOrderTotals(newOrderItems);

    // Create new order
    const newOrder = await Order.create({
      restaurantId,
      tableId: targetTableId,
      tableNumber: table.tableNumber,
      customerId,
      items: newOrderItems,
      subtotal,
      tax,
      total,
      notes: notes || originalOrder.notes,
      status: 'received',
    });

    // Update table occupancy if needed
    if (!table.isOccupied) {
      await Table.findByIdAndUpdate(targetTableId, {
        isOccupied: true,
        currentOrderId: newOrder._id,
      });
    }

    // Populate order details for response
    const populatedOrder = await Order.findById(newOrder._id)
      .populate('tableId', 'tableNumber location')
      .populate('items.menuItemId', 'name description image')
      .lean()
      .exec();

    // Prepare response with warnings if applicable
    const response: any = {
      success: true,
      data: populatedOrder,
    };

    if (unavailableItems.length > 0) {
      response.warnings = {
        unavailableItems,
        message: `${unavailableItems.length} item(s) from the original order were not available and were excluded`,
      };
    }

    if (priceChanges.length > 0) {
      response.priceChanges = priceChanges;
      response.warnings = {
        ...response.warnings,
        priceMessage: `${priceChanges.length} item(s) have price changes`,
      };
    }

    res.status(201).json(response);
  } catch (error: any) {
    console.error('Reorder error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};
