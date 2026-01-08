import { Request, Response } from 'express';
import Category from '../common/models/Category';

// @desc    Get all categories (tenant-scoped)
// @route   GET /api/categories
// @access  Public
export const getCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const { includeInactive } = req.query;

    // CRITICAL: Filter by restaurant
    const filter: any = {
      restaurantId: req.restaurantId,
    };

    if (!includeInactive) {
      filter.isActive = true;
    }

    const categories = await Category.find(filter).sort({ displayOrder: 1, name: 1 });

    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get category by ID (tenant-scoped)
// @route   GET /api/categories/:id
// @access  Public
export const getCategoryById = async (req: Request, res: Response): Promise<void> => {
  try {
    const category = await Category.findOne({
      _id: req.params.id,
      restaurantId: req.restaurantId,
    });

    if (!category) {
      res.status(404).json({
        success: false,
        message: 'Category not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: category,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Create category (tenant-scoped)
// @route   POST /api/categories
// @access  Private (Admin)
export const createCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, displayOrder, isActive } = req.body;

    if (!name) {
      res.status(400).json({
        success: false,
        message: 'Category name is required',
      });
      return;
    }

    // CRITICAL: Create with restaurantId
    const category = await Category.create({
      restaurantId: req.restaurantId,
      name,
      description,
      displayOrder: displayOrder || 0,
      isActive: isActive !== undefined ? isActive : true,
    });

    res.status(201).json({
      success: true,
      data: category,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Update category (tenant-scoped)
// @route   PUT /api/categories/:id
// @access  Private (Admin)
export const updateCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, displayOrder, isActive } = req.body;

    // CRITICAL: Find with restaurantId validation
    const category = await Category.findOne({
      _id: req.params.id,
      restaurantId: req.restaurantId,
    });

    if (!category) {
      res.status(404).json({
        success: false,
        message: 'Category not found',
      });
      return;
    }

    category.name = name || category.name;
    category.description = description !== undefined ? description : category.description;
    category.displayOrder = displayOrder !== undefined ? displayOrder : category.displayOrder;
    category.isActive = isActive !== undefined ? isActive : category.isActive;

    await category.save();

    res.status(200).json({
      success: true,
      data: category,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Delete category (tenant-scoped)
// @route   DELETE /api/categories/:id
// @access  Private (Admin)
export const deleteCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    // CRITICAL: Find with restaurantId validation
    const category = await Category.findOne({
      _id: req.params.id,
      restaurantId: req.restaurantId,
    });

    if (!category) {
      res.status(404).json({
        success: false,
        message: 'Category not found',
      });
      return;
    }

    await category.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Category deleted successfully',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Toggle category active status (tenant-scoped)
// @route   PATCH /api/categories/:id/toggle
// @access  Private (Admin)
export const toggleCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    // CRITICAL: Find with restaurantId validation
    const category = await Category.findOne({
      _id: req.params.id,
      restaurantId: req.restaurantId,
    });

    if (!category) {
      res.status(404).json({
        success: false,
        message: 'Category not found',
      });
      return;
    }

    category.isActive = !category.isActive;
    await category.save();

    res.status(200).json({
      success: true,
      data: category,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};
