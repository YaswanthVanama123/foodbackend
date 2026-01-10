import { Request, Response } from 'express';
import Order, { OrderStatus } from '../../common/models/Order';
import Table from '../../common/models/Table';
import Customer from '../../common/models/Customer';
import Restaurant from '../../common/models/Restaurant';
import { getSocketService } from '../../common/services/socketService';
import { Types } from 'mongoose';
import mongoose from 'mongoose';
import notificationService from '../../../services/notification.service';

// Constants
const VALID_STATUSES: OrderStatus[] = ['received', 'preparing', 'ready', 'served', 'cancelled'];
const ACTIVE_STATUSES: OrderStatus[] = ['preparing', 'ready'];
const MAX_BATCH_SIZE = 100;
const CHUNK_SIZE = 100;

// Cache for validation data (5 minute TTL)
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const validationCache = new Map<string, CacheEntry<any>>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Helper: Get from cache or fetch
async function getCachedData<T>(
  key: string,
  fetcher: () => Promise<T>
): Promise<T> {
  const cached = validationCache.get(key);
  const now = Date.now();

  if (cached && (now - cached.timestamp) < CACHE_TTL) {
    return cached.data;
  }

  const data = await fetcher();
  validationCache.set(key, { data, timestamp: now });
  return data;
}

// Helper: Process array in chunks
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// Helper: Validate batch size
function validateBatchSize(items: any[], operation: string): void {
  if (items.length > MAX_BATCH_SIZE) {
    throw new Error(
      `Batch size exceeds maximum limit. Maximum ${MAX_BATCH_SIZE} ${operation} allowed per request. Received: ${items.length}`
    );
  }
}

// @desc    Bulk update order status
// @route   PATCH /api/orders/bulk/update-status
// @access  Private (Admin)
export const bulkUpdateOrderStatus = async (req: Request, res: Response): Promise<void> => {
  const session = await mongoose.startSession();

  try {
    const { orderIds, status } = req.body;

    // Fail fast validation
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

    // Validate status (fail fast)
    if (!VALID_STATUSES.includes(status as OrderStatus)) {
      res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
      });
      return;
    }

    // Validate batch size
    validateBatchSize(orderIds, 'orders');

    // Validate all IDs are valid MongoDB ObjectIds (fail fast)
    const invalidIds = orderIds.filter((id: string) => !Types.ObjectId.isValid(id));
    if (invalidIds.length > 0) {
      res.status(400).json({
        success: false,
        message: 'One or more order IDs are invalid',
        invalidIds,
      });
      return;
    }

    const restaurantId = req.restaurantId!.toString();
    const adminId = req.admin?._id.toString();

    // Start transaction for atomicity
    session.startTransaction();

    // Find all orders that belong to this restaurant (optimized with select)
    const orders = await Order.find({
      _id: { $in: orderIds },
      restaurantId: req.restaurantId,
    })
    .select('_id tableNumber status tableId')
    .lean()
    .session(session)
    .exec();

    if (orders.length === 0) {
      await session.abortTransaction();
      res.status(404).json({
        success: false,
        message: 'No orders found for the provided IDs',
      });
      return;
    }

    // Check if any orders found don't match the requested IDs (security check)
    if (orders.length !== orderIds.length) {
      const foundIds = orders.map(o => o._id.toString());
      const notFoundIds = orderIds.filter((id: string) => !foundIds.includes(id));
      console.warn(`Orders not found or not authorized: ${notFoundIds.join(', ')}`);
    }

    // Update all orders using bulkWrite for better performance
    const statusHistoryEntry = {
      status: status as OrderStatus,
      timestamp: new Date(),
      updatedBy: adminId ? new Types.ObjectId(adminId) : undefined,
    };

    const bulkOps = orders.map(o => ({
      updateOne: {
        filter: { _id: o._id, restaurantId: req.restaurantId },
        update: {
          $set: { status },
          $push: { statusHistory: statusHistoryEntry },
        },
      },
    }));

    await Order.bulkWrite(bulkOps, { ordered: false, session });

    // Update table occupancy if orders are marked as served or cancelled
    if (status === 'served' || status === 'cancelled') {
      const tableBulkOps = orders.map(o => ({
        updateOne: {
          filter: {
            restaurantId: req.restaurantId,
            currentOrderId: o._id,
          },
          update: {
            $set: { isOccupied: false },
            $unset: { currentOrderId: '' },
          },
        },
      }));

      if (tableBulkOps.length > 0) {
        await Table.bulkWrite(tableBulkOps, { ordered: false, session });
      }
    }

    await session.commitTransaction();

    // Fetch updated orders with populated data for socket emission
    const updatedOrders = await Order.find({
      _id: { $in: orders.map(o => o._id) },
    })
      .populate('tableId', 'tableNumber location')
      .lean()
      .exec();

    // Use Promise.allSettled for non-blocking socket emissions and notifications
    const socketService = getSocketService();

    // Parallel processing for socket emissions and FCM notifications
    await Promise.allSettled([
      // Socket emissions
      Promise.allSettled(
        updatedOrders.map(async (order) => {
          socketService.emitOrderStatusUpdate(restaurantId, order.tableNumber, order);
          socketService.emitOrderStatusChange(restaurantId, order);
        })
      ),
      // FCM notifications
      (async () => {
        const restaurant = await getCachedData(
          `restaurant:${restaurantId}`,
          () => Restaurant.findById(restaurantId).lean().exec()
        );

        if (!restaurant) {
          return;
        }

        // Process notifications in chunks for better performance
        const chunks = chunkArray(updatedOrders, 10);

        return Promise.allSettled(
          chunks.map(chunk =>
            Promise.allSettled(
              chunk.map(async (order) => {
                  if (order.customerId) {
                    const customer = await Customer.findById(order.customerId)
                      .select('fcmToken')
                      .lean()
                      .exec();

                    if (customer && customer.fcmToken) {
                      await notificationService.notifyOrderStatusChange(
                        customer.fcmToken,
                        order._id.toString(),
                        order.orderNumber,
                        status as string,
                        restaurant.name
                      );
                      console.log(`✓ FCM notification sent for order ${order.orderNumber}`);
                    }
                  }
                })
              )
            )
          );
      })(),
    ]);

    // CRITICAL: Auto-delete customer accounts when ALL their orders are served/cancelled
    // This runs for bulk status updates to "served"
    if (status === 'served') {
      try {
        // Get unique customer IDs from the updated orders
        const customerIds = [
          ...new Set(
            updatedOrders
              .filter((order) => order.customerId)
              .map((order) => order.customerId!.toString())
          ),
        ];

        console.log(
          `[Bulk Customer Auto-Delete] Checking ${customerIds.length} customers for deletion`
        );

        // Check each customer for active orders
        const deletionResults = await Promise.allSettled(
          customerIds.map(async (customerId) => {
            // Count active orders (not served/cancelled)
            const activeOrders = await Order.countDocuments({
              customerId: new Types.ObjectId(customerId),
              status: { $nin: ['served', 'cancelled'] },
            }).exec();

            if (activeOrders === 0) {
              // Delete customer permanently
              await Customer.findByIdAndDelete(customerId).exec();
              console.log(
                `[Bulk Customer Auto-Delete] ✓ Deleted customer ${customerId} - all orders completed`
              );
              return { customerId, deleted: true };
            } else {
              console.log(
                `[Bulk Customer Auto-Delete] Customer ${customerId} has ${activeOrders} active orders remaining`
              );
              return { customerId, deleted: false, activeOrders };
            }
          })
        );

        const deletedCount = deletionResults.filter(
          (result) => result.status === 'fulfilled' && result.value.deleted
        ).length;

        if (deletedCount > 0) {
          console.log(
            `[Bulk Customer Auto-Delete] ✓ Deleted ${deletedCount} customer account(s). Usernames now available for re-registration.`
          );
        }
      } catch (customerDeleteError) {
        console.error(
          '[Bulk Customer Auto-Delete] Error during customer deletion:',
          customerDeleteError
        );
      }
    }

    console.log(`✓ Bulk status update completed: ${updatedOrders.length} orders updated to ${status}`);

    res.status(200).json({
      success: true,
      message: `Successfully updated ${updatedOrders.length} order(s) to status: ${status}`,
      data: {
        updated: updatedOrders.length,
        requested: orderIds.length,
        status,
        orders: updatedOrders,
      },
    });
  } catch (error: any) {
    await session.abortTransaction();
    console.error('Bulk update order status error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

// @desc    Bulk delete orders
// @route   DELETE /api/orders/bulk/delete
// @access  Private (Admin)
export const bulkDeleteOrders = async (req: Request, res: Response): Promise<void> => {
  const session = await mongoose.startSession();

  try {
    const { orderIds, confirm } = req.body;

    // Fail fast validation
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

    // Validate batch size
    validateBatchSize(orderIds, 'orders');

    // Validate all IDs are valid MongoDB ObjectIds (fail fast)
    const invalidIds = orderIds.filter((id: string) => !Types.ObjectId.isValid(id));
    if (invalidIds.length > 0) {
      res.status(400).json({
        success: false,
        message: 'One or more order IDs are invalid',
        invalidIds,
      });
      return;
    }

    const restaurantId = req.restaurantId!.toString();

    // Start transaction for atomicity
    session.startTransaction();

    // Find all orders that belong to this restaurant (optimized with select)
    const orders = await Order.find({
      _id: { $in: orderIds },
      restaurantId: req.restaurantId,
    })
    .select('_id orderNumber status tableNumber')
    .lean()
    .session(session)
    .exec();

    if (orders.length === 0) {
      await session.abortTransaction();
      res.status(404).json({
        success: false,
        message: 'No orders found for the provided IDs',
      });
      return;
    }

    // Check if any orders are in active status (fail fast)
    const activeOrders = orders.filter(order =>
      ACTIVE_STATUSES.includes(order.status as OrderStatus)
    );

    if (activeOrders.length > 0) {
      await session.abortTransaction();
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
    const deleteResult = await Order.deleteMany(
      {
        _id: { $in: orders.map(o => o._id) },
        restaurantId: req.restaurantId,
      },
      { session }
    );

    // Update table occupancy using bulkWrite
    const orderIdsToDelete = orders.map(o => o._id);
    const tableBulkOps = orderIdsToDelete.map(orderId => ({
      updateOne: {
        filter: {
          restaurantId: req.restaurantId,
          currentOrderId: orderId,
        },
        update: {
          $set: { isOccupied: false },
          $unset: { currentOrderId: '' },
        },
      },
    }));

    if (tableBulkOps.length > 0) {
      await Table.bulkWrite(tableBulkOps, { ordered: false, session });
    }

    await session.commitTransaction();

    // Emit socket events for deletion (non-blocking)
    Promise.allSettled(
      orders.map(async (order) => {
        try {
          const socketService = getSocketService();
          socketService.emitOrderStatusChange(restaurantId, {
            ...order,
            status: 'deleted',
          });
        } catch (socketError) {
          console.error('Socket emit error (non-critical):', socketError);
        }
      })
    ).then(() => {
      console.log(`✓ Bulk delete completed: ${deleteResult.deletedCount} orders deleted`);
    });

    res.status(200).json({
      success: true,
      message: `Successfully deleted ${deleteResult.deletedCount} order(s)`,
      data: {
        deleted: deleteResult.deletedCount,
        requested: orderIds.length,
        orderNumbers: orders.map(o => o.orderNumber),
      },
    });
  } catch (error: any) {
    await session.abortTransaction();
    console.error('Bulk delete orders error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
      error: error.message,
    });
  } finally {
    session.endSession();
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

    // Status filter (fail fast)
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

    // Fetch orders with optimized select and lean
    const orders = await Order.find(filter)
      .populate('tableId', 'tableNumber location')
      .populate('customerId', 'firstName lastName email username')
      .select('orderNumber tableNumber createdAt items subtotal tax total status notes servedAt')
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

    // Generate CSV with parallel processing for large datasets
    const csvRows: string[] = [];

    // CSV Header
    const headers = [
      'Order Number',
      'Date',
      'Time',
      'Table Number',
      'Table Location',
      'Customer Name',
      'Customer Username',
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

    // Process in chunks for better performance
    const chunks = chunkArray(orders, CHUNK_SIZE);

    const chunkResults = await Promise.allSettled(
      chunks.map(async (chunk) => {
        return chunk.map((order) => {
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
            customer ? customer.username : 'Guest',
            customer?.username || '',
            order.status,
            order.items.length.toString(),
            `"${itemsDetails.replace(/"/g, '""')}"`, // Escape quotes in items details
            order.subtotal.toFixed(2),
            order.tax.toFixed(2),
            order.total.toFixed(2),
            order.notes ? `"${order.notes.replace(/"/g, '""')}"` : '', // Escape quotes in notes
            order.servedAt ? new Date(order.servedAt).toLocaleString() : '',
          ];
          return row.join(',');
        });
      })
    );

    // Flatten results
    chunkResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        csvRows.push(...result.value);
      }
    });

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
      message: error.message || 'Server error',
      error: error.message,
    });
  }
};
