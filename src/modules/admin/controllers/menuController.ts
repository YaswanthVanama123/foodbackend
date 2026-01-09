import { Request, Response } from 'express';
import MenuItem from '../../common/models/MenuItem';
import Review from '../../common/models/Review';
import Category from '../../common/models/Category';
import path from 'path';
import fs from 'fs';

// @desc    Get menu page data (categories + menu items with ratings) - OPTIMIZED
// @route   GET /api/menu/page-data
// @access  Public
export const getMenuPageData = async (req: Request, res: Response): Promise<void> => {
  try {
    const { available } = req.query;

    // Parallel fetch: Categories and Menu Items
    const [categories, menuItems] = await Promise.all([
      // Fetch active categories
      Category.find({
        restaurantId: req.restaurantId,
        isActive: true,
      }).sort({ displayOrder: 1, name: 1 }).lean(),

      // Fetch menu items with category population
      MenuItem.find({
        restaurantId: req.restaurantId,
        ...(available === 'true' && { isAvailable: true }),
      })
        .populate('categoryId', 'name')
        .sort({ name: 1 })
        .lean(),
    ]);

    // Single aggregation query to get ALL ratings at once (eliminates N+1 problem)
    const allRatings = await Review.aggregate([
      {
        $match: {
          restaurantId: req.restaurantId,
          isVisible: true,
        },
      },
      {
        $group: {
          _id: '$menuItemId',
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
        },
      },
    ]);

    // Create a ratings map for O(1) lookup
    const ratingsMap = new Map();
    allRatings.forEach((rating: any) => {
      ratingsMap.set(rating._id.toString(), {
        averageRating: Math.round(rating.averageRating * 10) / 10,
        totalReviews: rating.totalReviews,
      });
    });

    // Attach ratings to menu items
    const menuItemsWithRatings = menuItems.map((item: any) => {
      const ratings = ratingsMap.get(item._id.toString());
      return {
        ...item,
        averageRating: ratings?.averageRating || 0,
        totalReviews: ratings?.totalReviews || 0,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        categories,
        menuItems: menuItemsWithRatings,
      },
      count: {
        categories: categories.length,
        menuItems: menuItemsWithRatings.length,
      },
    });
  } catch (error: any) {
    console.error('Error fetching menu page data:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get all menu items (tenant-scoped)
// @route   GET /api/menu
// @access  Public
export const getMenuItems = async (req: Request, res: Response): Promise<void> => {
  try {
    const { categoryId, available } = req.query;

    // CRITICAL: Filter by restaurant
    const filter: any = {
      restaurantId: req.restaurantId,
    };

    if (categoryId) {
      filter.categoryId = categoryId;
    }

    if (available === 'true') {
      filter.isAvailable = true;
    }

    const menuItems = await MenuItem.find(filter)
      .populate('categoryId', 'name')
      .sort({ name: 1 });

    // Aggregate ratings for each menu item
    const menuItemsWithRatings = await Promise.all(
      menuItems.map(async (item) => {
        const ratings = await Review.aggregate([
          {
            $match: {
              restaurantId: req.restaurantId,
              menuItemId: item._id,
              isVisible: true,
            },
          },
          {
            $group: {
              _id: null,
              averageRating: { $avg: '$rating' },
              totalReviews: { $sum: 1 },
            },
          },
        ]);

        const itemObj = item.toObject();
        if (ratings.length > 0) {
          return {
            ...itemObj,
            averageRating: Math.round(ratings[0].averageRating * 10) / 10, // Round to 1 decimal
            totalReviews: ratings[0].totalReviews,
          };
        }

        return {
          ...itemObj,
          averageRating: 0,
          totalReviews: 0,
        };
      })
    );

    res.status(200).json({
      success: true,
      count: menuItemsWithRatings.length,
      data: menuItemsWithRatings,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get menu items by category (tenant-scoped)
// @route   GET /api/menu/category/:categoryId
// @access  Public
export const getMenuItemsByCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const menuItems = await MenuItem.find({
      restaurantId: req.restaurantId,
      categoryId: req.params.categoryId,
      isAvailable: true,
    }).populate('categoryId', 'name');

    res.status(200).json({
      success: true,
      count: menuItems.length,
      data: menuItems,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get menu item by ID (tenant-scoped)
// @route   GET /api/menu/:id
// @access  Public
export const getMenuItemById = async (req: Request, res: Response): Promise<void> => {
  try {
    const menuItem = await MenuItem.findOne({
      _id: req.params.id,
      restaurantId: req.restaurantId,
    }).populate('categoryId', 'name');

    if (!menuItem) {
      res.status(404).json({
        success: false,
        message: 'Menu item not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: menuItem,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Create menu item (tenant-scoped)
// @route   POST /api/menu
// @access  Private (Admin)
export const createMenuItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      name,
      description,
      categoryId,
      price,
      isVegetarian,
      isVegan,
      isGlutenFree,
      customizationOptions,
      preparationTime,
    } = req.body;

    if (!name || !categoryId || price === undefined) {
      res.status(400).json({
        success: false,
        message: 'Name, category, and price are required',
      });
      return;
    }

    // CRITICAL: Create with restaurantId
    const menuItem = await MenuItem.create({
      restaurantId: req.restaurantId,
      name,
      description,
      categoryId,
      price,
      isVegetarian: isVegetarian || false,
      isVegan: isVegan || false,
      isGlutenFree: isGlutenFree || false,
      customizationOptions: customizationOptions || [],
      preparationTime,
    });

    res.status(201).json({
      success: true,
      data: menuItem,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Update menu item (tenant-scoped)
// @route   PUT /api/menu/:id
// @access  Private (Admin)
export const updateMenuItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      name,
      description,
      categoryId,
      price,
      isAvailable,
      isVegetarian,
      isVegan,
      isGlutenFree,
      customizationOptions,
      preparationTime,
    } = req.body;

    // CRITICAL: Find with restaurantId validation
    const menuItem = await MenuItem.findOne({
      _id: req.params.id,
      restaurantId: req.restaurantId,
    });

    if (!menuItem) {
      res.status(404).json({
        success: false,
        message: 'Menu item not found',
      });
      return;
    }

    menuItem.name = name || menuItem.name;
    menuItem.description = description !== undefined ? description : menuItem.description;
    menuItem.categoryId = categoryId || menuItem.categoryId;
    menuItem.price = price !== undefined ? price : menuItem.price;
    menuItem.isAvailable = isAvailable !== undefined ? isAvailable : menuItem.isAvailable;
    menuItem.isVegetarian = isVegetarian !== undefined ? isVegetarian : menuItem.isVegetarian;
    menuItem.isVegan = isVegan !== undefined ? isVegan : menuItem.isVegan;
    menuItem.isGlutenFree = isGlutenFree !== undefined ? isGlutenFree : menuItem.isGlutenFree;
    menuItem.customizationOptions = customizationOptions || menuItem.customizationOptions;
    menuItem.preparationTime = preparationTime !== undefined ? preparationTime : menuItem.preparationTime;

    await menuItem.save();

    res.status(200).json({
      success: true,
      data: menuItem,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Delete menu item (tenant-scoped)
// @route   DELETE /api/menu/:id
// @access  Private (Admin)
export const deleteMenuItem = async (req: Request, res: Response): Promise<void> => {
  try {
    // CRITICAL: Find with restaurantId validation
    const menuItem = await MenuItem.findOne({
      _id: req.params.id,
      restaurantId: req.restaurantId,
    });

    if (!menuItem) {
      res.status(404).json({
        success: false,
        message: 'Menu item not found',
      });
      return;
    }

    // Delete image file if exists
    if (menuItem.image) {
      const imagePath = path.join(process.cwd(), menuItem.image);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }

    await menuItem.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Menu item deleted successfully',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Toggle menu item availability (tenant-scoped)
// @route   PATCH /api/menu/:id/availability
// @access  Private (Admin)
export const toggleAvailability = async (req: Request, res: Response): Promise<void> => {
  try {
    // CRITICAL: Find with restaurantId validation
    const menuItem = await MenuItem.findOne({
      _id: req.params.id,
      restaurantId: req.restaurantId,
    });

    if (!menuItem) {
      res.status(404).json({
        success: false,
        message: 'Menu item not found',
      });
      return;
    }

    menuItem.isAvailable = !menuItem.isAvailable;
    await menuItem.save();

    res.status(200).json({
      success: true,
      data: menuItem,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Upload menu item image (tenant-scoped)
// @route   POST /api/menu/:id/image
// @access  Private (Admin)
export const uploadImage = async (req: Request, res: Response): Promise<void> => {
  try {
    // CRITICAL: Find with restaurantId validation
    const menuItem = await MenuItem.findOne({
      _id: req.params.id,
      restaurantId: req.restaurantId,
    });

    if (!menuItem) {
      res.status(404).json({
        success: false,
        message: 'Menu item not found',
      });
      return;
    }

    if (!req.file) {
      res.status(400).json({
        success: false,
        message: 'No image file uploaded',
      });
      return;
    }

    // Delete old image if exists
    if (menuItem.image) {
      const oldImagePath = path.join(process.cwd(), menuItem.image);
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
      }
    }

    // Update image path
    menuItem.image = `/uploads/menu-items/${req.file.filename}`;
    await menuItem.save();

    res.status(200).json({
      success: true,
      data: menuItem,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};
