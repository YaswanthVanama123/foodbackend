import { Request, Response } from 'express';
import Order from '../../common/models/Order';
import MenuItem from '../../common/models/MenuItem';
import Table from '../../common/models/Table';
import { calculateOrderTotals, calculateItemSubtotal } from '../../common/services/orderService';
import { Types } from 'mongoose';
import mongoose from 'mongoose';

/**
 * @desc    Get customer's order history
 * @route   GET /api/customers/orders
 * @access  Private (Customer)
 * @optimization Added .select() to minimize payload, optimized for <50ms target
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

    // OPTIMIZATION: Fetch orders with pagination, minimal payload, and lean queries
    const [orders, total] = await Promise.all([
      Order.find(filter)
        .select('orderNumber tableNumber status items subtotal tax total createdAt notes')
        .populate('tableId', 'tableNumber location')
        .populate('items.menuItemId', 'name images.small isAvailable') // Use small image variant
        .sort({ createdAt: -1 }) // Newest first - uses index
        .skip(skip)
        .limit(Number(limit))
        .lean() // CRITICAL: Returns plain JS objects, 5-10x faster
        .exec(),
      Order.countDocuments(filter).hint({ restaurantId: 1, customerId: 1, createdAt: -1 }),
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
 * @optimization Added .select() and used smaller image variant
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

    // OPTIMIZATION: Fail fast validation - validate before DB query
    if (!Types.ObjectId.isValid(orderId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid order ID format',
      });
      return;
    }

    // OPTIMIZATION: Fetch order with selective fields and lean query
    const order = await Order.findOne({
      _id: orderId,
      restaurantId,
      customerId, // Ensure order belongs to customer
    })
      .select('orderNumber tableNumber tableId status items subtotal tax total createdAt notes statusHistory')
      .populate('tableId', 'tableNumber location capacity')
      .populate('items.menuItemId', 'name description images.medium price isAvailable categoryId') // Use medium image
      .lean() // CRITICAL: Returns plain JS objects
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
 * @optimization Added transaction support, fail-fast validation, price caching, single query stock validation
 */
export const reorder = async (req: Request, res: Response): Promise<void> => {
  // OPTIMIZATION: Start transaction for atomicity and prevent race conditions
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const customerId = req.customer?._id;
    const restaurantId = req.restaurantId;
    const { orderId } = req.params;
    const { tableId, notes } = req.body;

    // OPTIMIZATION: Fail fast - validate auth first
    if (!customerId) {
      await session.abortTransaction();
      session.endSession();
      res.status(401).json({
        success: false,
        message: 'Customer authentication required',
      });
      return;
    }

    // OPTIMIZATION: Fail fast - validate orderId format before DB query
    if (!Types.ObjectId.isValid(orderId)) {
      await session.abortTransaction();
      session.endSession();
      res.status(400).json({
        success: false,
        message: 'Invalid order ID format',
      });
      return;
    }

    // OPTIMIZATION: Fetch original order with minimal fields using lean
    const originalOrder = await Order.findOne({
      _id: orderId,
      restaurantId,
      customerId, // Verify order belongs to customer
    })
      .select('tableId items notes') // Only fetch required fields
      .lean()
      .session(session)
      .exec();

    if (!originalOrder) {
      await session.abortTransaction();
      session.endSession();
      res.status(404).json({
        success: false,
        message: 'Original order not found or does not belong to you',
      });
      return;
    }

    // Determine tableId to use
    let targetTableId: Types.ObjectId;

    if (tableId) {
      // OPTIMIZATION: Fail fast - validate tableId format
      if (!Types.ObjectId.isValid(tableId)) {
        await session.abortTransaction();
        session.endSession();
        res.status(400).json({
          success: false,
          message: 'Invalid table ID format',
        });
        return;
      }
      targetTableId = new Types.ObjectId(tableId);
    } else {
      targetTableId = originalOrder.tableId;
    }

    // OPTIMIZATION: Verify table with selective fields and lean query
    const table = await Table.findOne({
      _id: targetTableId,
      restaurantId,
    })
      .select('tableNumber isActive')
      .lean()
      .session(session)
      .exec();

    // OPTIMIZATION: Fail fast - table validation
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

    // Extract menu item IDs from original order
    const menuItemIds = originalOrder.items.map((item) => item.menuItemId);

    // OPTIMIZATION: Fetch menu items in single query with only required fields
    // Cache prices during order creation
    const menuItems = await MenuItem.find({
      _id: { $in: menuItemIds },
      restaurantId,
    })
      .select('_id name price isAvailable') // Minimal fields for price caching
      .lean()
      .session(session)
      .exec();

    // OPTIMIZATION: Fail fast - check if any items available
    if (menuItems.length === 0) {
      await session.abortTransaction();
      session.endSession();
      res.status(400).json({
        success: false,
        message: 'No items from original order are currently available',
      });
      return;
    }

    // OPTIMIZATION: Create a Map for O(1) lookup instead of array iteration
    const menuItemMap = new Map<string, any>(
      menuItems.map((item: any) => [item._id.toString(), item])
    );

    // OPTIMIZATION: Single-pass validation and order item creation
    const unavailableItems: string[] = [];
    const priceChanges: Array<{ name: string; oldPrice: number; newPrice: number }> = [];
    const newOrderItems: any[] = [];

    for (const originalItem of originalOrder.items) {
      const menuItemIdStr = originalItem.menuItemId.toString();
      const currentMenuItem = menuItemMap.get(menuItemIdStr);

      // OPTIMIZATION: Validate stock availability in single query (already done above)
      if (!currentMenuItem) {
        unavailableItems.push(originalItem.name);
        continue;
      }

      if (!currentMenuItem.isAvailable) {
        unavailableItems.push(currentMenuItem.name);
        continue;
      }

      // Track price changes
      if (currentMenuItem.price !== originalItem.price) {
        priceChanges.push({
          name: currentMenuItem.name,
          oldPrice: originalItem.price,
          newPrice: currentMenuItem.price,
        });
      }

      // OPTIMIZATION: Cache current prices in order item
      const newItem = {
        menuItemId: currentMenuItem._id,
        name: currentMenuItem.name,
        price: currentMenuItem.price, // Cached price at order time
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

    // OPTIMIZATION: Fail fast - if no items available after validation
    if (newOrderItems.length === 0) {
      await session.abortTransaction();
      session.endSession();
      res.status(400).json({
        success: false,
        message: 'None of the items from the original order are currently available',
        unavailableItems,
      });
      return;
    }

    // Calculate totals for new order
    const { subtotal, tax, total } = calculateOrderTotals(newOrderItems);

    // OPTIMIZATION: Create new order within transaction
    const [newOrder] = await Order.create(
      [
        {
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
        },
      ],
      { session }
    );

    // OPTIMIZATION: Update table occupancy within same transaction
    if (!table.isOccupied) {
      await Table.findByIdAndUpdate(
        targetTableId,
        {
          isOccupied: true,
          currentOrderId: newOrder._id,
        },
        { session }
      );
    }

    // OPTIMIZATION: Commit transaction before expensive populate operations
    await session.commitTransaction();
    session.endSession();

    // OPTIMIZATION: Populate order details AFTER transaction for response only
    const populatedOrder = await Order.findById(newOrder._id)
      .select('orderNumber tableNumber tableId status items subtotal tax total createdAt notes')
      .populate('tableId', 'tableNumber location')
      .populate('items.menuItemId', 'name description images.small')
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
    // OPTIMIZATION: Rollback transaction on any error
    await session.abortTransaction();
    session.endSession();

    console.error('Reorder error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};
