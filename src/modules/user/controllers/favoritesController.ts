import { Request, Response } from 'express';
import Customer from '../../common/models/Customer';
import MenuItem from '../../common/models/MenuItem';
import mongoose from 'mongoose';

/**
 * OPTIMIZED Favorites Controller
 * Target: <50ms for getFavorites, <30ms for all other operations
 *
 * Key Optimizations:
 * - Single aggregation query for getFavorites (no populate)
 * - .lean() everywhere for raw objects
 * - Batch favorite checks in single query
 * - Server-side JOINs using $lookup
 * - Direct array operations using $addToSet and $pull
 */

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

    const menuItemObjectId = new mongoose.Types.ObjectId(menuItemId);

    // OPTIMIZED: Single query to verify menu item exists and belongs to restaurant
    const menuItem = await MenuItem.findOne({
      _id: menuItemObjectId,
      restaurantId: restaurantId,
    })
      .select('_id name')
      .lean()
      .exec();

    if (!menuItem) {
      res.status(404).json({
        success: false,
        message: 'Menu item not found or does not belong to this restaurant',
      });
      return;
    }

    // OPTIMIZED: Use $addToSet to add favorite atomically (prevents duplicates)
    // This is much faster than fetching, checking, and saving
    const result = await Customer.updateOne(
      {
        _id: customerId,
        restaurantId: restaurantId,
      },
      {
        $addToSet: { 'preferences.favoriteItems': menuItemObjectId },
      }
    );

    if (result.matchedCount === 0) {
      res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
      return;
    }

    // Check if item was actually added (modifiedCount will be 0 if already existed)
    const wasAdded = result.modifiedCount > 0;

    if (!wasAdded) {
      res.status(400).json({
        success: false,
        message: 'Menu item is already in favorites',
      });
      return;
    }

    // Get updated favorites count
    const customer = await Customer.findById(customerId)
      .select('preferences.favoriteItems')
      .lean()
      .exec();

    res.status(200).json({
      success: true,
      message: 'Menu item added to favorites',
      data: {
        favoriteItems: customer?.preferences.favoriteItems || [],
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

    const menuItemObjectId = new mongoose.Types.ObjectId(menuItemId);

    // OPTIMIZED: Use $pull to remove favorite atomically
    const result = await Customer.updateOne(
      {
        _id: customerId,
        restaurantId: restaurantId,
      },
      {
        $pull: { 'preferences.favoriteItems': menuItemObjectId },
      }
    );

    if (result.matchedCount === 0) {
      res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
      return;
    }

    if (result.modifiedCount === 0) {
      res.status(404).json({
        success: false,
        message: 'Menu item not found in favorites',
      });
      return;
    }

    // Get updated favorites
    const customer = await Customer.findById(customerId)
      .select('preferences.favoriteItems')
      .lean()
      .exec();

    res.status(200).json({
      success: true,
      message: 'Menu item removed from favorites',
      data: {
        favoriteItems: customer?.preferences.favoriteItems || [],
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

// @desc    Get all favorite items with full menu item details - SINGLE QUERY OPTIMIZED
// @route   GET /api/customers/favorites
// @access  Private (Customer)
//
// OPTIMIZATIONS FOR SPEED:
// - Single aggregation query instead of 2 separate queries + populate
// - Reduces network roundtrips (huge win for cloud DB)
// - Server-side JOIN using $lookup
// - Preserves favorite order
// - Target: <50ms
export const getFavorites = async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  let dbQueryTime = 0;

  try {
    const customerId = req.customer?._id;
    const restaurantId = req.restaurantId;

    const dbStart = Date.now();

    // OPTIMIZED: Single aggregation pipeline - no populate, no separate queries
    const result = await Customer.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(customerId),
          restaurantId: new mongoose.Types.ObjectId(restaurantId),
        },
      },
      {
        $project: {
          favoriteItems: '$preferences.favoriteItems',
        },
      },
      {
        $unwind: {
          path: '$favoriteItems',
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $lookup: {
          from: 'menuitems',
          let: { menuItemId: '$favoriteItems' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$_id', '$$menuItemId'] },
                    { $eq: ['$restaurantId', new mongoose.Types.ObjectId(restaurantId)] },
                  ],
                },
              },
            },
            {
              $lookup: {
                from: 'categories',
                localField: 'categoryId',
                foreignField: '_id',
                as: 'category',
              },
            },
            {
              $project: {
                _id: 1,
                name: 1,
                description: 1,
                price: 1,
                originalPrice: 1,
                images: 1,
                isAvailable: 1,
                isVegetarian: 1,
                isVegan: 1,
                isGlutenFree: 1,
                isNonVeg: 1,
                preparationTime: 1,
                categoryId: {
                  _id: { $arrayElemAt: ['$category._id', 0] },
                  name: { $arrayElemAt: ['$category.name', 0] },
                },
              },
            },
          ],
          as: 'menuItem',
        },
      },
      {
        $unwind: {
          path: '$menuItem',
          preserveNullAndEmptyArrays: false, // Skip if menu item doesn't exist
        },
      },
      {
        $replaceRoot: {
          newRoot: '$menuItem',
        },
      },
    ]).exec();

    dbQueryTime = Date.now() - dbStart;

    if (!result || result.length === 0) {
      const totalTime = Date.now() - startTime;
      console.log(`[FAVORITES API] ✅ TOTAL TIME: ${totalTime}ms (db: ${dbQueryTime}ms) - Empty favorites`);

      res.status(200).json({
        success: true,
        count: 0,
        data: [],
        _perf: {
          total: totalTime,
          db: dbQueryTime,
          queries: 1,
        },
      });
      return;
    }

    const totalTime = Date.now() - startTime;
    console.log(`[FAVORITES API] ✅ TOTAL TIME: ${totalTime}ms (db: ${dbQueryTime}ms) - Found ${result.length} favorites`);

    res.status(200).json({
      success: true,
      count: result.length,
      data: result,
      _perf: {
        total: totalTime,
        db: dbQueryTime,
        queries: 1, // Single aggregation instead of 2 queries
      },
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

    const menuItemObjectId = new mongoose.Types.ObjectId(menuItemId);

    // OPTIMIZED: Use direct query with $in operator
    const customer = await Customer.findOne({
      _id: customerId,
      restaurantId: restaurantId,
      'preferences.favoriteItems': menuItemObjectId,
    })
      .select('_id')
      .lean()
      .exec();

    const isFavorited = customer !== null;

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

// @desc    Batch check if multiple items are favorited
// @route   POST /api/customers/favorites/batch-check
// @access  Private (Customer)
export const batchCheckFavorites = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { menuItemIds } = req.body;
    const customerId = req.customer?._id;
    const restaurantId = req.restaurantId;

    // Validation
    if (!Array.isArray(menuItemIds) || menuItemIds.length === 0) {
      res.status(400).json({
        success: false,
        message: 'menuItemIds must be a non-empty array',
      });
      return;
    }

    // Validate all IDs
    const validIds = menuItemIds.filter((id) =>
      mongoose.Types.ObjectId.isValid(id)
    );

    if (validIds.length === 0) {
      res.status(400).json({
        success: false,
        message: 'No valid menu item IDs provided',
      });
      return;
    }

    // OPTIMIZED: Single query to get customer's favorites
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

    // Create a Set for O(1) lookup
    const favoritesSet = new Set(
      customer.preferences.favoriteItems.map((id) => id.toString())
    );

    // Build result map
    const result: { [key: string]: boolean } = {};
    validIds.forEach((id) => {
      result[id] = favoritesSet.has(id.toString());
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Batch check favorites error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};
