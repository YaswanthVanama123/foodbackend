import { Request, Response } from 'express';
import MenuItem from '../../common/models/MenuItem';
import Category from '../../common/models/Category';
import Table from '../../common/models/Table';
import Order from '../../common/models/Order';

// @desc    Bulk update menu item availability (tenant-scoped)
// @route   PATCH /api/bulk/menu/availability
// @access  Private (Admin)
export const bulkUpdateAvailability = async (req: Request, res: Response): Promise<void> => {
  try {
    const { itemIds, isAvailable } = req.body;

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

    const result = await MenuItem.updateMany(
      { _id: { $in: itemIds }, restaurantId: req.restaurantId },
      { $set: { isAvailable } }
    );

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
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Bulk update menu item prices (tenant-scoped)
// @route   PATCH /api/bulk/menu/prices
// @access  Private (Admin)
export const bulkUpdatePrices = async (req: Request, res: Response): Promise<void> => {
  try {
    const { updates } = req.body; // [{ itemId, price }, ...]

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Updates array is required',
      });
      return;
    }

    const bulkOps = updates.map((update) => ({
      updateOne: {
        filter: { _id: update.itemId, restaurantId: req.restaurantId },
        update: { $set: { price: update.price } },
      },
    }));

    const result = await MenuItem.bulkWrite(bulkOps);

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} prices updated`,
      data: {
        matched: result.matchedCount,
        modified: result.modifiedCount,
      },
    });
  } catch (error: any) {
    console.error('Bulk update prices error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Bulk update menu item categories (tenant-scoped)
// @route   PATCH /api/bulk/menu/category
// @access  Private (Admin)
export const bulkUpdateCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { itemIds, categoryId } = req.body;

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

    // Verify category exists
    const category = await Category.findOne({
      _id: categoryId,
      restaurantId: req.restaurantId,
    });
    if (!category) {
      res.status(404).json({
        success: false,
        message: 'Category not found',
      });
      return;
    }

    const result = await MenuItem.updateMany(
      { _id: { $in: itemIds }, restaurantId: req.restaurantId },
      { $set: { categoryId } }
    );

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} items moved to ${category.name}`,
      data: {
        matched: result.matchedCount,
        modified: result.modifiedCount,
      },
    });
  } catch (error: any) {
    console.error('Bulk update category error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Bulk delete menu items (tenant-scoped)
// @route   DELETE /api/bulk/menu
// @access  Private (Admin)
export const bulkDeleteMenuItems = async (req: Request, res: Response): Promise<void> => {
  try {
    const { itemIds } = req.body;

    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Item IDs array is required',
      });
      return;
    }

    const result = await MenuItem.deleteMany({
      _id: { $in: itemIds },
      restaurantId: req.restaurantId,
    });

    res.status(200).json({
      success: true,
      message: `${result.deletedCount} items deleted`,
      data: {
        deleted: result.deletedCount,
      },
    });
  } catch (error: any) {
    console.error('Bulk delete menu items error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Bulk update table status (tenant-scoped)
// @route   PATCH /api/bulk/tables/status
// @access  Private (Admin)
export const bulkUpdateTableStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tableIds, isActive } = req.body;

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

    const result = await Table.updateMany(
      { _id: { $in: tableIds }, restaurantId: req.restaurantId },
      { $set: { isActive } }
    );

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
      message: 'Server error',
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

    const orders = await Order.find(filter)
      .populate('tableId', 'tableNumber')
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    // Prepare CSV data
    const csvData = orders.map((order) => ({
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

    res.status(200).json({
      success: true,
      count: csvData.length,
      data: csvData,
    });
  } catch (error: any) {
    console.error('Export orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
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
