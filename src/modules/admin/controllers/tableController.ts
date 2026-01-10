import { Request, Response } from 'express';
import Table from '../../common/models/Table';
import Admin from '../../common/models/Admin';
import Restaurant from '../../common/models/Restaurant';
import firebaseService from '../../../services/firebase.service';
import { getSocketService } from '../../common/services/socketService';
import { tableCache, invalidateTableCache, CacheKeys as TableCacheKeys } from '../../common/utils/tableCache';

// Field projections for optimized queries
const TABLE_LIST_PROJECTION = {
  _id: 1,
  restaurantId: 1,
  tableNumber: 1,
  capacity: 1,
  location: 1,
  isActive: 1,
  isOccupied: 1,
  createdAt: 1,
  updatedAt: 1,
};

const TABLE_STATUS_PROJECTION = {
  _id: 1,
  tableNumber: 1,
  isOccupied: 1,
  isActive: 1,
};

// @desc    Get all tables (tenant-scoped) - OPTIMIZED
// @route   GET /api/tables
// @access  Public
export const getTables = async (req: Request, res: Response): Promise<void> => {
  try {
    const { includeInactive } = req.query;
    const restaurantId = req.restaurantId!.toString();

    // Generate cache key
    const cacheKey = TableCacheKeys.tables(restaurantId, !!includeInactive);

    // Try cache first (30s TTL for table listings)
    const cachedTables = tableCache.get(cacheKey) as any[];
    if (cachedTables) {
      res.status(200).json({
        success: true,
        count: cachedTables.length,
        data: cachedTables,
        cached: true,
      });
      return;
    }

    // Build optimized filter
    const filter: any = {
      restaurantId: req.restaurantId,
    };

    if (!includeInactive) {
      filter.isActive = true;
    }

    // OPTIMIZATION: Use .lean() for plain JS objects (2-5x faster)
    // OPTIMIZATION: Use projection to return only needed fields
    // OPTIMIZATION: Index on restaurantId + isActive is used automatically
    const tables = await Table.find(filter)
      .select(TABLE_LIST_PROJECTION)
      .sort({ tableNumber: 1 })
      .lean()
      .exec();

    // Cache the results for 30 seconds
    tableCache.set(cacheKey, tables, 30000);

    res.status(200).json({
      success: true,
      count: tables.length,
      data: tables,
      cached: false,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get table by ID (tenant-scoped) - OPTIMIZED
// @route   GET /api/tables/:id
// @access  Public
export const getTableById = async (req: Request, res: Response): Promise<void> => {
  try {
    const tableId = req.params.id;
    const restaurantId = req.restaurantId!.toString();

    // Generate cache key
    const cacheKey = TableCacheKeys.table(tableId);

    // Try cache first
    const cachedTable = tableCache.get(cacheKey) as any;
    if (cachedTable && cachedTable.restaurantId.toString() === restaurantId) {
      res.status(200).json({
        success: true,
        data: cachedTable,
        cached: true,
      });
      return;
    }

    // OPTIMIZATION: Use .lean() and projection
    const table = await Table.findOne({
      _id: tableId,
      restaurantId: req.restaurantId,
    })
      .select(TABLE_LIST_PROJECTION)
      .lean()
      .exec();

    if (!table) {
      res.status(404).json({
        success: false,
        message: 'Table not found',
      });
      return;
    }

    // Cache individual table for 60 seconds
    tableCache.set(cacheKey, table, 60000);

    res.status(200).json({
      success: true,
      data: table,
      cached: false,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Create table (tenant-scoped) - OPTIMIZED
// @route   POST /api/tables
// @access  Private (Admin)
export const createTable = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tableNumber, capacity, location, isActive } = req.body;

    if (!tableNumber || !capacity) {
      res.status(400).json({
        success: false,
        message: 'Table number and capacity are required',
      });
      return;
    }

    const restaurantId = req.restaurantId!.toString();

    // CRITICAL: Create with restaurantId
    const table = await Table.create({
      restaurantId: req.restaurantId,
      tableNumber,
      capacity,
      location,
      isActive: isActive !== undefined ? isActive : true,
    });

    // Invalidate all table listing caches for this restaurant
    invalidateTableCache(restaurantId);

    // Emit real-time table creation event via WebSocket
    try {
      const socketService = getSocketService();
      socketService.emitTableCreated(restaurantId, {
        _id: table._id.toString(),
        tableNumber: table.tableNumber,
        capacity: table.capacity,
        location: table.location,
        isActive: table.isActive,
        isOccupied: table.isOccupied,
      });
    } catch (socketError) {
      console.error('Socket emit error:', socketError);
      // Continue even if socket fails
    }

    res.status(201).json({
      success: true,
      data: table,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Update table (tenant-scoped) - OPTIMIZED
// @route   PUT /api/tables/:id
// @access  Private (Admin)
export const updateTable = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tableNumber, capacity, location, isActive, isOccupied } = req.body;
    const tableId = req.params.id;
    const restaurantId = req.restaurantId!.toString();

    // OPTIMIZATION: Use .lean() for initial read to check existence
    const existingTable = await Table.findOne({
      _id: tableId,
      restaurantId: req.restaurantId,
    })
      .select('_id isOccupied')
      .lean()
      .exec();

    if (!existingTable) {
      res.status(404).json({
        success: false,
        message: 'Table not found',
      });
      return;
    }

    const previousOccupiedStatus = existingTable.isOccupied;

    // Build update object
    const updateFields: any = {};
    if (tableNumber !== undefined) updateFields.tableNumber = tableNumber;
    if (capacity !== undefined) updateFields.capacity = capacity;
    if (location !== undefined) updateFields.location = location;
    if (isActive !== undefined) updateFields.isActive = isActive;
    if (isOccupied !== undefined) updateFields.isOccupied = isOccupied;

    // OPTIMIZATION: Use findOneAndUpdate for atomic update
    const table = await Table.findOneAndUpdate(
      { _id: tableId, restaurantId: req.restaurantId },
      { $set: updateFields },
      { new: true, runValidators: true }
    )
      .select(TABLE_LIST_PROJECTION)
      .lean()
      .exec();

    if (!table) {
      res.status(404).json({
        success: false,
        message: 'Table not found',
      });
      return;
    }

    // Invalidate cache for this restaurant
    invalidateTableCache(restaurantId, tableId);

    // Emit real-time table update event via WebSocket
    try {
      const socketService = getSocketService();
      socketService.emitTableUpdated(restaurantId, {
        _id: table._id.toString(),
        tableNumber: table.tableNumber,
        capacity: table.capacity,
        location: table.location,
        isActive: table.isActive,
        isOccupied: table.isOccupied,
      });
    } catch (socketError) {
      console.error('Socket emit error:', socketError);
      // Continue even if socket fails
    }

    // Send active FCM notifications to all admins if table occupancy status changed
    if (isOccupied !== undefined && isOccupied !== previousOccupiedStatus) {
      // Run FCM notifications asynchronously (non-blocking)
      setImmediate(async () => {
        try {
          // OPTIMIZATION: Use .lean() and projection for admin query
          const admins = await Admin.find({
            restaurantId: req.restaurantId,
            isActive: true,
            fcmToken: { $exists: true, $ne: null },
          })
            .select('fcmToken')
            .lean()
            .exec();

          if (admins.length > 0) {
            const adminTokens = admins.map((admin) => admin.fcmToken!).filter(Boolean);

            if (adminTokens.length > 0) {
              // OPTIMIZATION: Use .lean() for restaurant query
              const restaurant = await Restaurant.findById(restaurantId)
                .select('name')
                .lean()
                .exec();

              const statusMessage = isOccupied ? 'is now occupied' : 'is now available';

              await firebaseService.sendActiveNotification(
                adminTokens,
                {
                  title: 'Table Status Update',
                  body: `Table ${table.tableNumber} ${statusMessage}`,
                },
                {
                  tableId: table._id.toString(),
                  tableNumber: table.tableNumber.toString(),
                  isOccupied: isOccupied.toString(),
                  restaurantId,
                  restaurantName: restaurant?.name || 'Restaurant',
                }
              );

              console.log(`✓ Active FCM notification sent to ${adminTokens.length} admin(s) for table status change Table ${table.tableNumber} -> ${statusMessage}`);
            }
          }
        } catch (fcmError) {
          console.error('❌ Admin FCM notification error:', fcmError);
          // Non-blocking, already returned response
        }
      });
    }

    res.status(200).json({
      success: true,
      data: table,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Bulk update tables (tenant-scoped) - NEW OPTIMIZATION
// @route   PATCH /api/tables/bulk-update
// @access  Private (Admin)
export const bulkUpdateTables = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tableIds, updates } = req.body;

    if (!tableIds || !Array.isArray(tableIds) || tableIds.length === 0) {
      res.status(400).json({
        success: false,
        message: 'tableIds array is required',
      });
      return;
    }

    if (!updates || typeof updates !== 'object') {
      res.status(400).json({
        success: false,
        message: 'updates object is required',
      });
      return;
    }

    const restaurantId = req.restaurantId!.toString();

    // Build update object
    const updateFields: any = {};
    if (updates.isActive !== undefined) updateFields.isActive = updates.isActive;
    if (updates.isOccupied !== undefined) updateFields.isOccupied = updates.isOccupied;
    if (updates.location !== undefined) updateFields.location = updates.location;

    // OPTIMIZATION: Use bulkWrite for atomic multi-table updates
    const result = await Table.updateMany(
      {
        _id: { $in: tableIds },
        restaurantId: req.restaurantId,
      },
      { $set: updateFields }
    ).lean().exec();

    // Invalidate cache for this restaurant
    invalidateTableCache(restaurantId);

    // Emit real-time bulk update event via WebSocket
    try {
      const socketService = getSocketService();
      socketService.emitTableBulkUpdated(restaurantId, {
        tableIds,
        updates: updateFields,
        modifiedCount: result.modifiedCount,
      });
    } catch (socketError) {
      console.error('Socket emit error:', socketError);
    }

    res.status(200).json({
      success: true,
      message: `Updated ${result.modifiedCount} table(s)`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Delete table (tenant-scoped) - OPTIMIZED
// @route   DELETE /api/tables/:id
// @access  Private (Admin)
export const deleteTable = async (req: Request, res: Response): Promise<void> => {
  try {
    const tableId = req.params.id;
    const restaurantId = req.restaurantId!.toString();

    // OPTIMIZATION: Use findOneAndDelete for atomic operation
    const table = await Table.findOneAndDelete({
      _id: tableId,
      restaurantId: req.restaurantId,
    })
      .select('_id tableNumber')
      .lean()
      .exec();

    if (!table) {
      res.status(404).json({
        success: false,
        message: 'Table not found',
      });
      return;
    }

    // Invalidate cache for this restaurant
    invalidateTableCache(restaurantId, tableId);

    // Emit real-time table deletion event via WebSocket
    try {
      const socketService = getSocketService();
      socketService.emitTableDeleted(restaurantId, {
        _id: table._id.toString(),
        tableNumber: table.tableNumber,
      });
    } catch (socketError) {
      console.error('Socket emit error:', socketError);
    }

    res.status(200).json({
      success: true,
      message: 'Table deleted successfully',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Toggle table active status (tenant-scoped) - OPTIMIZED
// @route   PATCH /api/tables/:id/toggle
// @access  Private (Admin)
export const toggleTable = async (req: Request, res: Response): Promise<void> => {
  try {
    const tableId = req.params.id;
    const restaurantId = req.restaurantId!.toString();

    // OPTIMIZATION: First get current status with .lean()
    const existingTable = await Table.findOne({
      _id: tableId,
      restaurantId: req.restaurantId,
    })
      .select('isActive')
      .lean()
      .exec();

    if (!existingTable) {
      res.status(404).json({
        success: false,
        message: 'Table not found',
      });
      return;
    }

    // OPTIMIZATION: Use findOneAndUpdate with $set to toggle
    const table = await Table.findOneAndUpdate(
      { _id: tableId, restaurantId: req.restaurantId },
      { $set: { isActive: !existingTable.isActive } },
      { new: true }
    )
      .select(TABLE_LIST_PROJECTION)
      .lean()
      .exec();

    if (!table) {
      res.status(404).json({
        success: false,
        message: 'Table not found',
      });
      return;
    }

    // Invalidate cache for this restaurant
    invalidateTableCache(restaurantId, tableId);

    // Emit real-time table toggle event via WebSocket
    try {
      const socketService = getSocketService();
      socketService.emitTableUpdated(restaurantId, {
        _id: table._id.toString(),
        tableNumber: table.tableNumber,
        isActive: table.isActive,
        isOccupied: table.isOccupied,
      });
    } catch (socketError) {
      console.error('Socket emit error:', socketError);
    }

    res.status(200).json({
      success: true,
      data: table,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get table status (tenant-scoped) - OPTIMIZED
// @route   GET /api/tables/:id/status
// @access  Public
export const getTableStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const tableId = req.params.id;
    const restaurantId = req.restaurantId!.toString();

    // Generate cache key
    const cacheKey = TableCacheKeys.tableStatus(tableId);

    // Try cache first (10s TTL for status - real-time via WebSocket)
    const cachedStatus = tableCache.get(cacheKey) as any;
    if (cachedStatus && cachedStatus.restaurantId === restaurantId) {
      res.status(200).json({
        success: true,
        data: {
          tableNumber: cachedStatus.tableNumber,
          isAvailable: cachedStatus.isAvailable,
          isOccupied: cachedStatus.isOccupied,
        },
        cached: true,
      });
      return;
    }

    // OPTIMIZATION: Use .lean() and minimal projection
    const table = await Table.findOne({
      _id: tableId,
      restaurantId: req.restaurantId,
    })
      .select(TABLE_STATUS_PROJECTION)
      .lean()
      .exec();

    if (!table) {
      res.status(404).json({
        success: false,
        message: 'Table not found',
      });
      return;
    }

    const statusData = {
      tableNumber: table.tableNumber,
      isAvailable: table.isActive && !table.isOccupied,
      isOccupied: table.isOccupied,
      restaurantId,
    };

    // Cache for 10 seconds (WebSocket provides real-time updates)
    tableCache.set(cacheKey, statusData, 10000);

    res.status(200).json({
      success: true,
      data: {
        tableNumber: statusData.tableNumber,
        isAvailable: statusData.isAvailable,
        isOccupied: statusData.isOccupied,
      },
      cached: false,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get available tables (tenant-scoped) - NEW OPTIMIZED ENDPOINT
// @route   GET /api/tables/available
// @access  Public
export const getAvailableTables = async (req: Request, res: Response): Promise<void> => {
  try {
    const restaurantId = req.restaurantId!.toString();
    const { minCapacity } = req.query;

    // Generate cache key
    const cacheKey = TableCacheKeys.availableTables(
      restaurantId,
      minCapacity ? Number(minCapacity) : undefined
    );

    // Try cache first (15s TTL)
    const cachedTables = tableCache.get(cacheKey) as any[];
    if (cachedTables) {
      res.status(200).json({
        success: true,
        count: cachedTables.length,
        data: cachedTables,
        cached: true,
      });
      return;
    }

    // OPTIMIZATION: Optimized query using compound index
    const filter: any = {
      restaurantId: req.restaurantId,
      isActive: true,
      isOccupied: false,
    };

    if (minCapacity) {
      filter.capacity = { $gte: Number(minCapacity) };
    }

    // OPTIMIZATION: Use .lean() and projection
    const tables = await Table.find(filter)
      .select(TABLE_LIST_PROJECTION)
      .sort({ tableNumber: 1 })
      .lean()
      .exec();

    // Cache for 15 seconds
    tableCache.set(cacheKey, tables, 15000);

    res.status(200).json({
      success: true,
      count: tables.length,
      data: tables,
      cached: false,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};
