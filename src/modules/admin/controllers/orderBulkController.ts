import { Request, Response } from 'express';
import Order, { OrderStatus } from '../../common/models/Order';
import Table from '../../common/models/Table';
import { getSocketService } from '../../common/services/socketService';
import { Types } from 'mongoose';

// Valid order statuses
const VALID_STATUSES: OrderStatus[] = ['received', 'preparing', 'ready', 'served', 'cancelled'];
const ACTIVE_STATUSES: OrderStatus[] = ['preparing', 'ready'];

// @desc    Bulk update order status
// @route   PATCH /api/orders/bulk/update-status
// @access  Private (Admin)
export const bulkUpdateOrderStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderIds, status } = req.body;

    // Validate input
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Order IDs array is required and must not be empty',
      });
      return;
    }

    if (!status) {
      res.status(400).json({
        success: false,
        message: 'Status is required',
      });
      return;
    }

    // Validate status
    if (!VALID_STATUSES.includes(status as OrderStatus)) {
      res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
      });
      return;
    }

    // Validate all IDs are valid MongoDB ObjectIds
    const validOrderIds = orderIds.filter((id: string) => Types.ObjectId.isValid(id));
    if (validOrderIds.length !== orderIds.length) {
      res.status(400).json({
        success: false,
        message: 'One or more order IDs are invalid',
      });
      return;
    }

    const restaurantId = req.restaurantId!.toString();
    const adminId = req.admin?._id.toString();

    // Find all orders that belong to this restaurant
    const orders = await Order.find({
      _id: { $in: validOrderIds },
      restaurantId: req.restaurantId,
    }).lean().exec();

    if (orders.length === 0) {
      res.status(404).json({
        success: false,
        message: 'No orders found for the provided IDs',
      });
      return;
    }

    // Check if any orders found don't match the requested IDs (security check)
    if (orders.length !== validOrderIds.length) {
      const foundIds = orders.map(o => o._id.toString());
      const notFoundIds = validOrderIds.filter((id: string) => !foundIds.includes(id));
      console.warn(`Orders not found or not authorized: ${notFoundIds.join(', ')}`);
    }

    // Update all orders
    const statusHistoryEntry = {
      status: status as OrderStatus,
      timestamp: new Date(),
      updatedBy: adminId ? new Types.ObjectId(adminId) : undefined,
    };

    await Order.updateMany(
      {
        _id: { $in: orders.map(o => o._id) },
        restaurantId: req.restaurantId,
      },
      {
        $set: { status },
        $push: { statusHistory: statusHistoryEntry },
      }
    );

    // Update table occupancy if orders are marked as served or cancelled
    if (status === 'served' || status === 'cancelled') {
      const orderIds = orders.map(o => o._id);
      await Table.updateMany(
        {
          restaurantId: req.restaurantId,
          currentOrderId: { $in: orderIds },
        },
        {
          $set: { isOccupied: false },
          $unset: { currentOrderId: '' },
        }
      );
    }

    // Fetch updated orders with populated data for socket emission
    const updatedOrders = await Order.find({
      _id: { $in: orders.map(o => o._id) },
    })
      .populate('tableId', 'tableNumber location')
      .lean()
      .exec();

    // Emit socket events for each order
    try {
      const socketService = getSocketService();

      for (const order of updatedOrders) {
        // Emit to table room for customers
        socketService.emitOrderStatusUpdate(restaurantId, order.tableNumber, order);

        // Emit to admin room
        socketService.emitOrderStatusChange(restaurantId, order);
      }

      console.log(`✓ Bulk status update completed: ${updatedOrders.length} orders updated to ${status}`);
    } catch (socketError) {
      console.error('Socket emit error (non-critical):', socketError);
    }

    res.status(200).json({
      success: true,
      message: `Successfully updated ${updatedOrders.length} order(s) to status: ${status}`,
      data: {
        updated: updatedOrders.length,
        requested: validOrderIds.length,
        status,
        orders: updatedOrders,
      },
    });
  } catch (error: any) {
    console.error('Bulk update order status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Bulk delete orders
// @route   DELETE /api/orders/bulk/delete
// @access  Private (Admin)
export const bulkDeleteOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderIds, confirm } = req.body;

    // Validate input
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Order IDs array is required and must not be empty',
      });
      return;
    }

    // Require confirmation flag
    if (confirm !== true) {
      res.status(400).json({
        success: false,
        message: 'Confirmation required. Set confirm: true to proceed with deletion',
      });
      return;
    }

    // Validate all IDs are valid MongoDB ObjectIds
    const validOrderIds = orderIds.filter((id: string) => Types.ObjectId.isValid(id));
    if (validOrderIds.length !== orderIds.length) {
      res.status(400).json({
        success: false,
        message: 'One or more order IDs are invalid',
      });
      return;
    }

    const restaurantId = req.restaurantId!.toString();

    // Find all orders that belong to this restaurant
    const orders = await Order.find({
      _id: { $in: validOrderIds },
      restaurantId: req.restaurantId,
    }).lean().exec();

    if (orders.length === 0) {
      res.status(404).json({
        success: false,
        message: 'No orders found for the provided IDs',
      });
      return;
    }

    // Check if any orders are in active status (preparing, ready)
    const activeOrders = orders.filter(order =>
      ACTIVE_STATUSES.includes(order.status as OrderStatus)
    );

    if (activeOrders.length > 0) {
      res.status(400).json({
        success: false,
        message: `Cannot delete active orders. ${activeOrders.length} order(s) have status 'preparing' or 'ready'`,
        data: {
          activeOrders: activeOrders.map(o => ({
            _id: o._id,
            orderNumber: o.orderNumber,
            status: o.status,
            tableNumber: o.tableNumber,
          })),
        },
      });
      return;
    }

    // Delete orders
    const deleteResult = await Order.deleteMany({
      _id: { $in: orders.map(o => o._id) },
      restaurantId: req.restaurantId,
    });

    // Update table occupancy
    const orderIdsToDelete = orders.map(o => o._id);
    await Table.updateMany(
      {
        restaurantId: req.restaurantId,
        currentOrderId: { $in: orderIdsToDelete },
      },
      {
        $set: { isOccupied: false },
        $unset: { currentOrderId: '' },
      }
    );

    // Emit socket events for deletion
    try {
      const socketService = getSocketService();

      for (const order of orders) {
        // Emit to admin room
        socketService.emitOrderStatusChange(restaurantId, {
          ...order,
          status: 'deleted',
        });
      }

      console.log(`✓ Bulk delete completed: ${deleteResult.deletedCount} orders deleted`);
    } catch (socketError) {
      console.error('Socket emit error (non-critical):', socketError);
    }

    res.status(200).json({
      success: true,
      message: `Successfully deleted ${deleteResult.deletedCount} order(s)`,
      data: {
        deleted: deleteResult.deletedCount,
        requested: validOrderIds.length,
        orderNumbers: orders.map(o => o.orderNumber),
      },
    });
  } catch (error: any) {
    console.error('Bulk delete orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Export orders to CSV
// @route   GET /api/orders/bulk/export
// @access  Private (Admin)
export const exportOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate, status } = req.query;

    // Build filter query
    const filter: any = {
      restaurantId: req.restaurantId,
    };

    // Date range filter
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

    // Status filter
    if (status) {
      if (!VALID_STATUSES.includes(status as OrderStatus)) {
        res.status(400).json({
          success: false,
          message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
        });
        return;
      }
      filter.status = status;
    }

    // Fetch orders
    const orders = await Order.find(filter)
      .populate('tableId', 'tableNumber location')
      .populate('customerId', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    if (orders.length === 0) {
      res.status(404).json({
        success: false,
        message: 'No orders found for the specified criteria',
      });
      return;
    }

    // Generate CSV
    const csvRows: string[] = [];

    // CSV Header
    const headers = [
      'Order Number',
      'Date',
      'Time',
      'Table Number',
      'Table Location',
      'Customer Name',
      'Customer Email',
      'Status',
      'Items Count',
      'Items Details',
      'Subtotal',
      'Tax',
      'Total',
      'Notes',
      'Served At',
    ];
    csvRows.push(headers.join(','));

    // CSV Rows
    for (const order of orders) {
      const table = order.tableId as any;
      const customer = order.customerId as any;
      const createdAt = new Date(order.createdAt);

      // Format items details
      const itemsDetails = order.items
        .map((item: any) => {
          const customizations = item.customizations
            ? item.customizations
                .map((c: any) => `${c.name}:${c.options.join('|')}`)
                .join(';')
            : '';
          return `${item.quantity}x ${item.name}${customizations ? ` (${customizations})` : ''}`;
        })
        .join(' | ');

      const row = [
        order.orderNumber,
        createdAt.toLocaleDateString(),
        createdAt.toLocaleTimeString(),
        order.tableNumber,
        table?.location || '',
        customer ? `${customer.firstName} ${customer.lastName}` : 'Guest',
        customer?.email || '',
        order.status,
        order.items.length.toString(),
        `"${itemsDetails.replace(/"/g, '""')}"`, // Escape quotes in items details
        order.subtotal.toFixed(2),
        order.tax.toFixed(2),
        order.total.toFixed(2),
        order.notes ? `"${order.notes.replace(/"/g, '""')}"` : '', // Escape quotes in notes
        order.servedAt ? new Date(order.servedAt).toLocaleString() : '',
      ];
      csvRows.push(row.join(','));
    }

    const csv = csvRows.join('\n');

    // Generate filename
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `orders_export_${dateStr}.csv`;

    // Set headers for CSV download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Pragma', 'no-cache');

    console.log(`✓ Exported ${orders.length} orders to CSV`);

    res.status(200).send(csv);
  } catch (error: any) {
    console.error('Export orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};
