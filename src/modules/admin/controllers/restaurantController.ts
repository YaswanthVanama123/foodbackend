import { Request, Response } from 'express';
import Restaurant from '../../common/models/Restaurant';
import {
  restaurantCache,
  CacheKeys,
  invalidateRestaurantCache,
} from '../../common/utils/cache';

// @desc    Get restaurant by ID (OPTIMIZED with caching)
// @route   GET /api/restaurants/:id
// @access  Private (Admin)
export const getRestaurantById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Verify that the admin is fetching their own restaurant
    if (req.restaurantId?.toString() !== id) {
      res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own restaurant',
      });
      return;
    }

    // OPTIMIZATION 1: Check cache first
    const cacheKey = CacheKeys.restaurant(id);
    const cachedRestaurant = restaurantCache.get(cacheKey);

    if (cachedRestaurant) {
      res.status(200).json({
        success: true,
        data: cachedRestaurant,
        cached: true,
      });
      return;
    }

    // OPTIMIZATION 2: Use lean() for faster queries (returns plain JS object)
    // OPTIMIZATION 3: Use projection to exclude large fields
    const restaurant = await Restaurant.findById(id)
      .select('-__v -branding.logo.original') // Exclude large logo buffer
      .lean()
      .exec();

    if (!restaurant) {
      res.status(404).json({
        success: false,
        message: 'Restaurant not found',
      });
      return;
    }

    // OPTIMIZATION 4: Cache the result (1 hour TTL)
    restaurantCache.set(cacheKey, restaurant, 3600);

    res.status(200).json({
      success: true,
      data: restaurant,
      cached: false,
    });
  } catch (error: any) {
    console.error('Get restaurant error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get restaurant settings only (OPTIMIZED for faster access)
// @route   GET /api/restaurants/:id/settings
// @access  Private (Admin)
export const getRestaurantSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Verify ownership
    if (req.restaurantId?.toString() !== id) {
      res.status(403).json({
        success: false,
        message: 'Access denied',
      });
      return;
    }

    // Check cache first
    const cacheKey = CacheKeys.restaurantSettings(id);
    const cachedSettings = restaurantCache.get(cacheKey);

    if (cachedSettings) {
      res.status(200).json({
        success: true,
        data: cachedSettings,
        cached: true,
      });
      return;
    }

    // OPTIMIZATION: Only fetch settings field
    const restaurant = await Restaurant.findById(id)
      .select('settings')
      .lean()
      .exec();

    if (!restaurant) {
      res.status(404).json({
        success: false,
        message: 'Restaurant not found',
      });
      return;
    }

    // Cache settings separately (1 hour)
    restaurantCache.set(cacheKey, restaurant.settings, 3600);

    res.status(200).json({
      success: true,
      data: restaurant.settings,
      cached: false,
    });
  } catch (error: any) {
    console.error('Get restaurant settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get restaurant branding only (OPTIMIZED for faster access)
// @route   GET /api/restaurants/:id/branding
// @access  Public (No auth needed for branding)
export const getRestaurantBranding = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Check cache first
    const cacheKey = CacheKeys.restaurantBranding(id);
    const cachedBranding = restaurantCache.get(cacheKey);

    if (cachedBranding) {
      res.status(200).json({
        success: true,
        data: cachedBranding,
        cached: true,
      });
      return;
    }

    // OPTIMIZATION: Only fetch branding field, exclude large logo buffer
    const restaurant = await Restaurant.findById(id)
      .select('branding -branding.logo.original')
      .lean()
      .exec();

    if (!restaurant) {
      res.status(404).json({
        success: false,
        message: 'Restaurant not found',
      });
      return;
    }

    // Cache branding separately (1 hour - rarely changes)
    restaurantCache.set(cacheKey, restaurant.branding, 3600);

    res.status(200).json({
      success: true,
      data: restaurant.branding,
      cached: false,
    });
  } catch (error: any) {
    console.error('Get restaurant branding error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Update restaurant settings - OPTIMIZED with cache invalidation and performance monitoring
// @route   PUT /api/restaurants/:id
// @access  Private (Admin)
export const updateRestaurant = async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  let dbQueryTime = 0;

  try {
    const { id } = req.params;
    const { name, email, phone, address, branding, settings } = req.body;

    // Verify that the admin is updating their own restaurant
    if (req.restaurantId?.toString() !== id) {
      res.status(403).json({
        success: false,
        message: 'Access denied. You can only update your own restaurant',
      });
      return;
    }

    // OPTIMIZATION 1: Early validation to avoid unnecessary DB calls
    const updateData: any = {};
    let hasUpdates = false;

    if (name !== undefined) {
      const trimmedName = name.trim();
      if (trimmedName.length < 2 || trimmedName.length > 100) {
        res.status(400).json({
          success: false,
          message: 'Restaurant name must be between 2 and 100 characters',
        });
        return;
      }
      updateData.name = trimmedName;
      hasUpdates = true;
    }

    if (email !== undefined) {
      const trimmedEmail = email.trim();
      const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
      if (!emailRegex.test(trimmedEmail)) {
        res.status(400).json({
          success: false,
          message: 'Invalid email format',
        });
        return;
      }
      updateData.email = trimmedEmail;
      hasUpdates = true;
    }

    if (phone !== undefined) {
      updateData.phone = phone.trim();
      hasUpdates = true;
    }

    if (address !== undefined) {
      updateData.address = address;
      hasUpdates = true;
    }

    if (branding !== undefined) {
      updateData.branding = branding;
      hasUpdates = true;
    }

    if (settings !== undefined) {
      updateData.settings = settings;
      hasUpdates = true;
    }

    // OPTIMIZATION 2: Return early if no updates provided
    if (!hasUpdates) {
      res.status(400).json({
        success: false,
        message: 'No update data provided',
      });
      return;
    }

    // OPTIMIZATION 3: Single atomic update with lean() for performance
    const dbStart = Date.now();
    const restaurant = await Restaurant.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    )
      .select('-__v -branding.logo.original')
      .lean()
      .exec();
    dbQueryTime = Date.now() - dbStart;

    if (!restaurant) {
      res.status(404).json({
        success: false,
        message: 'Restaurant not found',
      });
      return;
    }

    // OPTIMIZATION 4: Invalidate all related caches
    invalidateRestaurantCache(id);

    const totalTime = Date.now() - startTime;
    console.log(`[RESTAURANT UPDATE] ✅ TOTAL TIME: ${totalTime}ms (db: ${dbQueryTime}ms)`);

    res.status(200).json({
      success: true,
      message: 'Restaurant updated successfully',
      data: restaurant,
      _perf: {
        total: totalTime,
        db: dbQueryTime,
      },
    });
  } catch (error: any) {
    console.error('Update restaurant error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};
