import { Request, Response } from 'express';
import MenuItem from '../../common/models/MenuItem';
import Category from '../../common/models/Category';
import Table from '../../common/models/Table';
import Order from '../../common/models/Order';
import mongoose from 'mongoose';

// Constants
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

// @desc    Bulk update menu item availability (tenant-scoped)
// @route   PATCH /api/bulk/menu/availability
// @access  Private (Admin)
export const bulkUpdateAvailability = async (req: Request, res: Response): Promise<void> => {
  try {
    const { itemIds, isAvailable } = req.body;

    // Fail fast validation
    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Item IDs array is required',
      });
      return;
    }

    if (typeof isAvailable !== 'boolean') {
      res.status(400).json({
        success: false,
        message: 'isAvailable must be a boolean',
      });
      return;
    }

    // Validate batch size
    validateBatchSize(itemIds, 'items');

    // Use bulkWrite for better performance
    const bulkOps = itemIds.map(id => ({
      updateOne: {
        filter: { _id: id, restaurantId: req.restaurantId },
        update: { $set: { isAvailable, updatedAt: new Date() } },
      },
    }));

    const result = await MenuItem.bulkWrite(bulkOps, { ordered: false });

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} items updated`,
      data: {
        matched: result.matchedCount,
        modified: result.modifiedCount,
      },
    });
  } catch (error: any) {
    console.error('Bulk update availability error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
      error: error.message,
    });
  }
};

// @desc    Bulk update menu item prices (tenant-scoped)
// @route   PATCH /api/bulk/menu/prices
// @access  Private (Admin)
export const bulkUpdatePrices = async (req: Request, res: Response): Promise<void> => {
  const session = await mongoose.startSession();

  try {
    const { updates } = req.body; // [{ itemId, price }, ...]

    // Fail fast validation
    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Updates array is required',
      });
      return;
    }

    // Validate batch size
    validateBatchSize(updates, 'price updates');

    // Fail fast: validate all prices upfront
    for (const update of updates) {
      if (!update.itemId) {
        throw new Error('All updates must include itemId');
      }
      if (typeof update.price !== 'number' || update.price < 0) {
        throw new Error(`Invalid price for item ${update.itemId}: ${update.price}`);
      }
    }

    // Use transaction for atomicity
    session.startTransaction();

    const bulkOps = updates.map((update) => ({
      updateOne: {
        filter: { _id: update.itemId, restaurantId: req.restaurantId },
        update: { $set: { price: update.price, updatedAt: new Date() } },
      },
    }));

    // Use ordered: false for parallel execution
    const result = await MenuItem.bulkWrite(bulkOps, {
      ordered: false,
      session
    });

    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} prices updated`,
      data: {
        matched: result.matchedCount,
        modified: result.modifiedCount,
        requested: updates.length,
      },
    });
  } catch (error: any) {
    await session.abortTransaction();
    console.error('Bulk update prices error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

// @desc    Bulk update menu item categories (tenant-scoped)
// @route   PATCH /api/bulk/menu/category
// @access  Private (Admin)
export const bulkUpdateCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { itemIds, categoryId } = req.body;

    // Fail fast validation
    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Item IDs array is required',
      });
      return;
    }

    if (!categoryId) {
      res.status(400).json({
        success: false,
        message: 'Category ID is required',
      });
      return;
    }

    // Validate batch size
    validateBatchSize(itemIds, 'items');

    // Use cached category validation
    const cacheKey = `category:${req.restaurantId}:${categoryId}`;
    const category = await getCachedData(cacheKey, async () => {
      return await Category.findOne({
        _id: categoryId,
        restaurantId: req.restaurantId,
      }).lean().exec();
    });

    if (!category) {
      res.status(404).json({
        success: false,
        message: 'Category not found',
      });
      return;
    }

    // Use bulkWrite with ordered: false for better performance
    const bulkOps = itemIds.map(id => ({
      updateOne: {
        filter: { _id: id, restaurantId: req.restaurantId },
        update: { $set: { categoryId, updatedAt: new Date() } },
      },
    }));

    const result = await MenuItem.bulkWrite(bulkOps, { ordered: false });

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} items moved to ${category.name}`,
      data: {
        matched: result.matchedCount,
        modified: result.modifiedCount,
        category: category.name,
      },
    });
  } catch (error: any) {
    console.error('Bulk update category error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
      error: error.message,
    });
  }
};

// @desc    Bulk delete menu items (tenant-scoped)
// @route   DELETE /api/bulk/menu
// @access  Private (Admin)
export const bulkDeleteMenuItems = async (req: Request, res: Response): Promise<void> => {
  const session = await mongoose.startSession();

  try {
    const { itemIds } = req.body;

    // Fail fast validation
    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Item IDs array is required',
      });
      return;
    }

    // Validate batch size
    validateBatchSize(itemIds, 'items');

    // Use transaction for atomicity
    session.startTransaction();

    const result = await MenuItem.deleteMany(
      {
        _id: { $in: itemIds },
        restaurantId: req.restaurantId,
      },
      { session }
    );

    await session.commitTransaction();

    res.status(200).json({
      success: true,
      message: `${result.deletedCount} items deleted`,
      data: {
        deleted: result.deletedCount,
        requested: itemIds.length,
      },
    });
  } catch (error: any) {
    await session.abortTransaction();
    console.error('Bulk delete menu items error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

// @desc    Bulk update table status (tenant-scoped)
// @route   PATCH /api/bulk/tables/status
// @access  Private (Admin)
export const bulkUpdateTableStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tableIds, isActive } = req.body;

    // Fail fast validation
    if (!tableIds || !Array.isArray(tableIds) || tableIds.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Table IDs array is required',
      });
      return;
    }

    if (typeof isActive !== 'boolean') {
      res.status(400).json({
        success: false,
        message: 'isActive must be a boolean',
      });
      return;
    }

    // Validate batch size
    validateBatchSize(tableIds, 'tables');

    // Use bulkWrite with ordered: false
    const bulkOps = tableIds.map(id => ({
      updateOne: {
        filter: { _id: id, restaurantId: req.restaurantId },
        update: { $set: { isActive, updatedAt: new Date() } },
      },
    }));

    const result = await Table.bulkWrite(bulkOps, { ordered: false });

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} tables updated`,
      data: {
        matched: result.matchedCount,
        modified: result.modifiedCount,
      },
    });
  } catch (error: any) {
    console.error('Bulk update table status error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
      error: error.message,
    });
  }
};

// @desc    Bulk export orders to CSV data (tenant-scoped)
// @route   POST /api/bulk/orders/export
// @access  Private (Admin)
export const exportOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate, status } = req.body;

    const filter: any = {
      restaurantId: req.restaurantId,
    };

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    if (status) {
      filter.status = status;
    }

    // Use lean() for better performance and select only needed fields
    const orders = await Order.find(filter)
      .populate('tableId', 'tableNumber')
      .select('orderNumber tableNumber createdAt items subtotal tax total status servedAt')
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    // Process in chunks for large datasets
    const chunks = chunkArray(orders, CHUNK_SIZE);
    const csvData: any[] = [];

    // Use Promise.allSettled for parallel processing
    const chunkResults = await Promise.allSettled(
      chunks.map(async (chunk) => {
        return chunk.map((order) => ({
          orderNumber: order.orderNumber,
          tableNumber: order.tableNumber,
          date: new Date(order.createdAt).toLocaleString(),
          items: order.items.map((item: any) => `${item.name} (${item.quantity})`).join('; '),
          subtotal: order.subtotal,
          tax: order.tax,
          total: order.total,
          status: order.status,
          servedAt: order.servedAt ? new Date(order.servedAt).toLocaleString() : '',
        }));
      })
    );

    // Flatten results
    chunkResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        csvData.push(...result.value);
      }
    });

    res.status(200).json({
      success: true,
      count: csvData.length,
      data: csvData,
    });
  } catch (error: any) {
    console.error('Export orders error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get bulk operation summary (tenant-scoped)
// @route   GET /api/bulk/summary
// @access  Private (Admin)
export const getBulkSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const [totalItems, availableItems, totalTables, activeTables, totalCategories] =
      await Promise.all([
        MenuItem.countDocuments({ restaurantId: req.restaurantId }),
        MenuItem.countDocuments({ restaurantId: req.restaurantId, isAvailable: true }),
        Table.countDocuments({ restaurantId: req.restaurantId }),
        Table.countDocuments({ restaurantId: req.restaurantId, isActive: true }),
        Category.countDocuments({ restaurantId: req.restaurantId, isActive: true }),
      ]);

    res.status(200).json({
      success: true,
      data: {
        menuItems: {
          total: totalItems,
          available: availableItems,
          unavailable: totalItems - availableItems,
        },
        tables: {
          total: totalTables,
          active: activeTables,
          inactive: totalTables - activeTables,
        },
        categories: {
          total: totalCategories,
        },
      },
    });
  } catch (error: any) {
    console.error('Get bulk summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};
