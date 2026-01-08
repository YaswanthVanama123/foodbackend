import { Request, Response } from 'express';
import Table from '../common/models/Table';

// @desc    Get all tables (tenant-scoped)
// @route   GET /api/tables
// @access  Public
export const getTables = async (req: Request, res: Response): Promise<void> => {
  try {
    const { includeInactive } = req.query;

    // CRITICAL: Filter by restaurant
    const filter: any = {
      restaurantId: req.restaurantId,
    };

    if (!includeInactive) {
      filter.isActive = true;
    }

    const tables = await Table.find(filter).sort({ tableNumber: 1 });

    res.status(200).json({
      success: true,
      count: tables.length,
      data: tables,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get table by ID (tenant-scoped)
// @route   GET /api/tables/:id
// @access  Public
export const getTableById = async (req: Request, res: Response): Promise<void> => {
  try {
    const table = await Table.findOne({
      _id: req.params.id,
      restaurantId: req.restaurantId,
    });

    if (!table) {
      res.status(404).json({
        success: false,
        message: 'Table not found',
      });
      return;
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

// @desc    Create table (tenant-scoped)
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

    // CRITICAL: Create with restaurantId
    const table = await Table.create({
      restaurantId: req.restaurantId,
      tableNumber,
      capacity,
      location,
      isActive: isActive !== undefined ? isActive : true,
    });

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

// @desc    Update table (tenant-scoped)
// @route   PUT /api/tables/:id
// @access  Private (Admin)
export const updateTable = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tableNumber, capacity, location, isActive, isOccupied } = req.body;

    // CRITICAL: Find with restaurantId validation
    const table = await Table.findOne({
      _id: req.params.id,
      restaurantId: req.restaurantId,
    });

    if (!table) {
      res.status(404).json({
        success: false,
        message: 'Table not found',
      });
      return;
    }

    table.tableNumber = tableNumber || table.tableNumber;
    table.capacity = capacity !== undefined ? capacity : table.capacity;
    table.location = location !== undefined ? location : table.location;
    table.isActive = isActive !== undefined ? isActive : table.isActive;
    table.isOccupied = isOccupied !== undefined ? isOccupied : table.isOccupied;

    await table.save();

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

// @desc    Delete table (tenant-scoped)
// @route   DELETE /api/tables/:id
// @access  Private (Admin)
export const deleteTable = async (req: Request, res: Response): Promise<void> => {
  try {
    // CRITICAL: Find with restaurantId validation
    const table = await Table.findOne({
      _id: req.params.id,
      restaurantId: req.restaurantId,
    });

    if (!table) {
      res.status(404).json({
        success: false,
        message: 'Table not found',
      });
      return;
    }

    await table.deleteOne();

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

// @desc    Toggle table active status (tenant-scoped)
// @route   PATCH /api/tables/:id/toggle
// @access  Private (Admin)
export const toggleTable = async (req: Request, res: Response): Promise<void> => {
  try {
    // CRITICAL: Find with restaurantId validation
    const table = await Table.findOne({
      _id: req.params.id,
      restaurantId: req.restaurantId,
    });

    if (!table) {
      res.status(404).json({
        success: false,
        message: 'Table not found',
      });
      return;
    }

    table.isActive = !table.isActive;
    await table.save();

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

// @desc    Get table status (tenant-scoped)
// @route   GET /api/tables/:id/status
// @access  Public
export const getTableStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const table = await Table.findOne({
      _id: req.params.id,
      restaurantId: req.restaurantId,
    }).select('tableNumber isOccupied isActive');

    if (!table) {
      res.status(404).json({
        success: false,
        message: 'Table not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        tableNumber: table.tableNumber,
        isAvailable: table.isActive && !table.isOccupied,
        isOccupied: table.isOccupied,
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
