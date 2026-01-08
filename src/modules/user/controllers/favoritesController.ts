import { Request, Response } from 'express';
import Customer from '../../common/models/Customer';
import MenuItem from '../../common/models/MenuItem';
import mongoose from 'mongoose';

// @desc    Add menu item to favorites
// @route   POST /api/customers/favorites
// @access  Private (Customer)
export const addFavorite = async (req: Request, res: Response): Promise<void> => {
  try {
    const { menuItemId } = req.body;
    const customerId = req.customer?._id;
    const restaurantId = req.restaurantId;

    // Validation
    if (!menuItemId) {
      res.status(400).json({
        success: false,
        message: 'Menu item ID is required',
      });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(menuItemId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid menu item ID format',
      });
      return;
    }

    // CRITICAL: Verify menu item exists and belongs to same restaurant
    const menuItem = await MenuItem.findOne({
      _id: menuItemId,
      restaurantId: restaurantId,
    }).lean().exec();

    if (!menuItem) {
      res.status(404).json({
        success: false,
        message: 'Menu item not found or does not belong to this restaurant',
      });
      return;
    }

    // Get customer with current favorites
    const customer = await Customer.findOne({
      _id: customerId,
      restaurantId: restaurantId,
    });

    if (!customer) {
      res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
      return;
    }

    // Check if already in favorites (no duplicates)
    const menuItemObjectId = new mongoose.Types.ObjectId(menuItemId);
    const isAlreadyFavorited = customer.preferences.favoriteItems.some(
      (itemId) => itemId.toString() === menuItemObjectId.toString()
    );

    if (isAlreadyFavorited) {
      res.status(400).json({
        success: false,
        message: 'Menu item is already in favorites',
      });
      return;
    }

    // Add to customer.preferences.favoriteItems array
    customer.preferences.favoriteItems.push(menuItemObjectId);
    await customer.save();

    res.status(200).json({
      success: true,
      message: 'Menu item added to favorites',
      data: {
        favoriteItems: customer.preferences.favoriteItems,
        addedItem: {
          _id: menuItem._id,
          name: menuItem.name,
        },
      },
    });
  } catch (error: any) {
    console.error('Add favorite error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Remove menu item from favorites
// @route   DELETE /api/customers/favorites/:menuItemId
// @access  Private (Customer)
export const removeFavorite = async (req: Request, res: Response): Promise<void> => {
  try {
    const { menuItemId } = req.params;
    const customerId = req.customer?._id;
    const restaurantId = req.restaurantId;

    // Validation
    if (!mongoose.Types.ObjectId.isValid(menuItemId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid menu item ID format',
      });
      return;
    }

    // Get customer
    const customer = await Customer.findOne({
      _id: customerId,
      restaurantId: restaurantId,
    });

    if (!customer) {
      res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
      return;
    }

    // Check if item is in favorites
    const menuItemObjectId = new mongoose.Types.ObjectId(menuItemId);
    const itemIndex = customer.preferences.favoriteItems.findIndex(
      (itemId) => itemId.toString() === menuItemObjectId.toString()
    );

    if (itemIndex === -1) {
      res.status(404).json({
        success: false,
        message: 'Menu item not found in favorites',
      });
      return;
    }

    // Remove from favorites
    customer.preferences.favoriteItems.splice(itemIndex, 1);
    await customer.save();

    res.status(200).json({
      success: true,
      message: 'Menu item removed from favorites',
      data: {
        favoriteItems: customer.preferences.favoriteItems,
      },
    });
  } catch (error: any) {
    console.error('Remove favorite error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get all favorite items with full menu item details
// @route   GET /api/customers/favorites
// @access  Private (Customer)
export const getFavorites = async (req: Request, res: Response): Promise<void> => {
  try {
    const customerId = req.customer?._id;
    const restaurantId = req.restaurantId;

    // Get customer with populated favorites
    const customer = await Customer.findOne({
      _id: customerId,
      restaurantId: restaurantId,
    })
      .populate({
        path: 'preferences.favoriteItems',
        populate: {
          path: 'categoryId',
          select: 'name displayOrder',
        },
        match: { restaurantId: restaurantId }, // Ensure menu items belong to restaurant
      })
      .lean()
      .exec();

    if (!customer) {
      res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
      return;
    }

    // Filter out any items that no longer exist (null values from populate)
    // This handles the case where menu items were deleted
    const validFavorites = customer.preferences.favoriteItems.filter(
      (item) => item !== null
    );

    // If favorites were filtered (some were deleted), update customer
    if (validFavorites.length !== customer.preferences.favoriteItems.length) {
      const validIds = validFavorites
        .filter((item): item is any => item !== null && typeof item === 'object' && '_id' in item)
        .map((item) => item._id);

      await Customer.updateOne(
        { _id: customerId },
        { 'preferences.favoriteItems': validIds }
      );
    }

    res.status(200).json({
      success: true,
      count: validFavorites.length,
      data: validFavorites,
    });
  } catch (error: any) {
    console.error('Get favorites error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Check if specific item is favorited
// @route   GET /api/customers/favorites/check/:menuItemId
// @access  Private (Customer)
export const checkFavorite = async (req: Request, res: Response): Promise<void> => {
  try {
    const { menuItemId } = req.params;
    const customerId = req.customer?._id;
    const restaurantId = req.restaurantId;

    // Validation
    if (!mongoose.Types.ObjectId.isValid(menuItemId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid menu item ID format',
      });
      return;
    }

    // Get customer
    const customer = await Customer.findOne({
      _id: customerId,
      restaurantId: restaurantId,
    })
      .select('preferences.favoriteItems')
      .lean()
      .exec();

    if (!customer) {
      res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
      return;
    }

    // Check if item is in favorites
    const menuItemObjectId = new mongoose.Types.ObjectId(menuItemId);
    const isFavorited = customer.preferences.favoriteItems.some(
      (itemId) => itemId.toString() === menuItemObjectId.toString()
    );

    res.status(200).json({
      success: true,
      data: {
        menuItemId,
        isFavorited,
      },
    });
  } catch (error: any) {
    console.error('Check favorite error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};
