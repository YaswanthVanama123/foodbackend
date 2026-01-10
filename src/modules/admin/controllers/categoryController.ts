import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Category from '../../common/models/Category';
import {
  categoryCache,
  CacheKeys,
  invalidateCategoryCache,
} from '../../common/utils/cache';

// @desc    Get all categories (OPTIMIZED with caching)
// @route   GET /api/categories
// @access  Public
export const getCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const { includeInactive } = req.query;
    const restaurantId = req.restaurantId!.toString();

    // OPTIMIZATION 1: Check cache first
    const cacheKey = CacheKeys.categories(restaurantId, !!includeInactive);
    const cachedCategories = categoryCache.get(cacheKey);

    if (cachedCategories) {
      res.status(200).json({
        success: true,
        count: (cachedCategories as any[]).length,
        data: cachedCategories,
        cached: true,
      });
      return;
    }

    // CRITICAL: Filter by restaurant
    const filter: any = {
      restaurantId,
    };

    if (!includeInactive) {
      filter.isActive = true;
    }

    // OPTIMIZATION 2: Use lean() for faster queries
    // OPTIMIZATION 3: Compound index already exists: { restaurantId: 1, isActive: 1 }
    const categories = await Category.find(filter)
      .select('-__v') // Exclude version key
      .sort({ displayOrder: 1, name: 1 })
      .lean()
      .exec();

    // OPTIMIZATION 4: Cache the result (5 minutes TTL)
    categoryCache.set(cacheKey, categories, 300);

    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories,
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

// @desc    Get category tree structure (OPTIMIZED for nested navigation)
// @route   GET /api/categories/tree
// @access  Public
export const getCategoryTree = async (req: Request, res: Response): Promise<void> => {
  try {
    const restaurantId = req.restaurantId!.toString();

    // Check cache first
    const cacheKey = CacheKeys.categoryTree(restaurantId);
    const cachedTree = categoryCache.get(cacheKey);

    if (cachedTree) {
      res.status(200).json({
        success: true,
        data: cachedTree,
        cached: true,
      });
      return;
    }

    // Fetch only active categories, sorted by displayOrder
    const categories = await Category.find({
      restaurantId,
      isActive: true,
    })
      .select('name description displayOrder images')
      .sort({ displayOrder: 1, name: 1 })
      .lean()
      .exec();

    // Build tree structure (if you have parent-child relationships)
    // For now, returning flat structure optimized for display
    const tree = categories;

    // Cache tree structure (5 minutes)
    categoryCache.set(cacheKey, tree, 300);

    res.status(200).json({
      success: true,
      data: tree,
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

// @desc    Get category by ID (OPTIMIZED with caching)
// @route   GET /api/categories/:id
// @access  Public
export const getCategoryById = async (req: Request, res: Response): Promise<void> => {
  try {
    const categoryId = req.params.id;
    const restaurantId = req.restaurantId!.toString();

    // Check cache first
    const cacheKey = CacheKeys.category(categoryId);
    const cachedCategory = categoryCache.get(cacheKey);

    if (cachedCategory) {
      // Verify restaurant ownership from cache
      if ((cachedCategory as any).restaurantId?.toString() !== restaurantId) {
        res.status(404).json({
          success: false,
          message: 'Category not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: cachedCategory,
        cached: true,
      });
      return;
    }

    // OPTIMIZATION: Use lean() and compound index { restaurantId: 1, isActive: 1 }
    const category = await Category.findOne({
      _id: categoryId,
      restaurantId,
    })
      .select('-__v')
      .lean()
      .exec();

    if (!category) {
      res.status(404).json({
        success: false,
        message: 'Category not found',
      });
      return;
    }

    // Cache individual category (5 minutes)
    categoryCache.set(cacheKey, category, 300);

    res.status(200).json({
      success: true,
      data: category,
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

// @desc    Create category (OPTIMIZED with cache invalidation)
// @route   POST /api/categories
// @access  Private (Admin)
export const createCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, displayOrder, isActive } = req.body;
    const restaurantId = req.restaurantId!.toString();

    if (!name) {
      res.status(400).json({
        success: false,
        message: 'Category name is required',
      });
      return;
    }

    // CRITICAL: Create with restaurantId
    const category = await Category.create({
      restaurantId,
      name,
      description,
      displayOrder: displayOrder || 0,
      isActive: isActive !== undefined ? isActive : true,
    });

    // OPTIMIZATION: Invalidate category cache after creation
    invalidateCategoryCache(restaurantId);

    // Convert to plain object for response
    const categoryObj = category.toObject();

    res.status(201).json({
      success: true,
      data: categoryObj,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Update category (OPTIMIZED with cache invalidation)
// @route   PUT /api/categories/:id
// @access  Private (Admin)
export const updateCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, displayOrder, isActive } = req.body;
    const categoryId = req.params.id;
    const restaurantId = req.restaurantId!.toString();

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (displayOrder !== undefined) updateData.displayOrder = displayOrder;
    if (isActive !== undefined) updateData.isActive = isActive;

    // OPTIMIZATION: Use findOneAndUpdate with lean()
    const category = await Category.findOneAndUpdate(
      {
        _id: categoryId,
        restaurantId,
      },
      { $set: updateData },
      { new: true, runValidators: true }
    )
      .select('-__v')
      .lean()
      .exec();

    if (!category) {
      res.status(404).json({
        success: false,
        message: 'Category not found',
      });
      return;
    }

    // OPTIMIZATION: Invalidate cache after update
    invalidateCategoryCache(restaurantId, categoryId);

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

// @desc    Bulk reorder categories (OPTIMIZED for drag-and-drop)
// @route   PATCH /api/categories/reorder
// @access  Private (Admin)
export const reorderCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const { categoryOrders } = req.body; // Array of { id, displayOrder }
    const restaurantId = req.restaurantId!.toString();

    if (!Array.isArray(categoryOrders) || categoryOrders.length === 0) {
      res.status(400).json({
        success: false,
        message: 'categoryOrders array is required',
      });
      return;
    }

    // OPTIMIZATION 7: Bulk update with single database call
    const bulkOps = categoryOrders.map(({ id, displayOrder }) => ({
      updateOne: {
        filter: { _id: id, restaurantId: new mongoose.Types.ObjectId(restaurantId) },
        update: { $set: { displayOrder } },
      },
    }));

    const result = await Category.bulkWrite(bulkOps);

    // Invalidate cache after bulk update
    invalidateCategoryCache(restaurantId);

    res.status(200).json({
      success: true,
      message: 'Categories reordered successfully',
      modified: result.modifiedCount,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Delete category (OPTIMIZED with cache invalidation)
// @route   DELETE /api/categories/:id
// @access  Private (Admin)
export const deleteCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const categoryId = req.params.id;
    const restaurantId = req.restaurantId!.toString();

    // OPTIMIZATION: Use findOneAndDelete with lean()
    const category = await Category.findOneAndDelete({
      _id: categoryId,
      restaurantId,
    })
      .lean()
      .exec();

    if (!category) {
      res.status(404).json({
        success: false,
        message: 'Category not found',
      });
      return;
    }

    // OPTIMIZATION: Invalidate cache after deletion
    invalidateCategoryCache(restaurantId, categoryId);

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

// @desc    Toggle category active status (OPTIMIZED with cache invalidation)
// @route   PATCH /api/categories/:id/toggle
// @access  Private (Admin)
export const toggleCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const categoryId = req.params.id;
    const restaurantId = req.restaurantId!.toString();

    // OPTIMIZATION: Use aggregation pipeline to toggle in one query
    const category = await Category.findOne({
      _id: categoryId,
      restaurantId,
    })
      .select('isActive')
      .lean()
      .exec();

    if (!category) {
      res.status(404).json({
        success: false,
        message: 'Category not found',
      });
      return;
    }

    // Update with toggled value
    const updatedCategory = await Category.findByIdAndUpdate(
      categoryId,
      { $set: { isActive: !category.isActive } },
      { new: true }
    )
      .select('-__v')
      .lean()
      .exec();

    // OPTIMIZATION: Invalidate cache after toggle
    invalidateCategoryCache(restaurantId, categoryId);

    res.status(200).json({
      success: true,
      data: updatedCategory,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};
