import { Request, Response } from 'express';
import Restaurant from '../models/Restaurant';
import MenuItem from '../models/MenuItem';
import Category from '../models/Category';
import Review from '../models/Review';
import { cache, CacheKeys } from '../../../utils/cache';

/**
 * OPTIMIZED Public Controller
 * Target: Public menu <50ms (cached), restaurant lookup <30ms
 *
 * Key Optimizations:
 * - Aggressive 30-minute in-memory caching
 * - .lean() on all queries for raw objects
 * - Pre-generated menu JSON
 * - Minimal auth checks
 * - Batch aggregations
 */

/**
 * @desc    Get restaurant by subdomain (public endpoint for login)
 * @route   GET /api/public/restaurants/by-subdomain/:subdomain
 * @access  Public (no authentication required)
 * @performance Target <30ms with cache
 */
export const getRestaurantBySubdomain = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { subdomain } = req.params;

    if (!subdomain || !subdomain.trim()) {
      res.status(400).json({
        success: false,
        message: 'Subdomain parameter is required',
      });
      return;
    }

    const normalizedSubdomain = subdomain.toLowerCase().trim();
    const cacheKey = CacheKeys.restaurant(normalizedSubdomain);

    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('ETag', cached.etag);

      // Check client ETag for 304
      if (req.headers['if-none-match'] === cached.etag) {
        res.status(304).end();
        return;
      }

      res.status(200).json(cached.data);
      return;
    }

    // Find restaurant by subdomain with lean() for performance
    const restaurant = await Restaurant.findOne({
      subdomain: normalizedSubdomain,
    })
      .select('_id subdomain name branding isActive subscription')
      .lean()
      .exec();

    if (!restaurant) {
      res.status(404).json({
        success: false,
        message: 'Restaurant not found',
        code: 'RESTAURANT_NOT_FOUND',
      });
      return;
    }

    // Check if restaurant is active
    if (!restaurant.isActive) {
      res.status(403).json({
        success: false,
        message: 'This restaurant is currently inactive',
        code: 'RESTAURANT_INACTIVE',
      });
      return;
    }

    // Check subscription status
    if (restaurant.subscription.status !== 'active') {
      res.status(403).json({
        success: false,
        message: 'This restaurant subscription is not active',
        code: 'SUBSCRIPTION_INACTIVE',
        status: restaurant.subscription.status,
      });
      return;
    }

    // Build response
    const response = {
      success: true,
      data: {
        restaurantId: restaurant._id,
        subdomain: restaurant.subdomain,
        name: restaurant.name,
        logo: restaurant.branding?.logo || null,
        branding: restaurant.branding || {
          primaryColor: '#6366f1',
          secondaryColor: '#8b5cf6',
          theme: 'light',
        },
      },
    };

    // Cache for 15 minutes (restaurant data changes less frequently)
    cache.set(cacheKey, response, 15 * 60 * 1000);

    res.setHeader('X-Cache', 'MISS');
    res.status(200).json(response);
  } catch (error: any) {
    console.error('Error fetching restaurant by subdomain:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

/**
 * @desc    Get public menu with categories and items (HIGHLY OPTIMIZED)
 * @route   GET /api/public/menu/:restaurantId
 * @access  Public (no authentication required)
 * @performance Target <50ms with cache, <200ms without cache
 */
export const getPublicMenu = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { restaurantId } = req.params;
    const { available } = req.query;

    if (!restaurantId) {
      res.status(400).json({
        success: false,
        message: 'Restaurant ID is required',
      });
      return;
    }

    // Generate cache key based on restaurant and availability filter
    const cacheKey = CacheKeys.menuPageData(
      restaurantId,
      available === 'true'
    );

    // Check cache first (30-minute TTL for public menu)
    const cached = cache.get(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('ETag', cached.etag);

      // Check client ETag for 304
      if (req.headers['if-none-match'] === cached.etag) {
        res.status(304).end();
        return;
      }

      res.status(200).json(cached.data);
      return;
    }

    // Parallel fetch: Categories, Menu Items, and Ratings in a single batch
    const [categories, menuItems, allRatings] = await Promise.all([
      // Fetch active categories with lean()
      Category.find({
        restaurantId,
        isActive: true,
      })
        .select('_id name displayOrder')
        .sort({ displayOrder: 1, name: 1 })
        .lean()
        .exec(),

      // Fetch menu items with lean() - CRITICAL: One level populate only
      MenuItem.find({
        restaurantId,
        ...(available === 'true' && { isAvailable: true }),
      })
        .select(
          '_id name description categoryId price originalPrice images isAvailable isVegetarian isVegan isGlutenFree isNonVeg customizationOptions preparationTime'
        )
        .populate({
          path: 'categoryId',
          select: 'name displayOrder',
        })
        .sort({ name: 1 })
        .lean()
        .exec(),

      // Batch aggregation for ALL ratings at once (eliminates N+1 problem)
      Review.aggregate([
        {
          $match: {
            restaurantId,
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
      ]),
    ]);

    // Create ratings lookup map for O(1) access
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

    // Build response
    const response = {
      success: true,
      data: {
        categories,
        menuItems: menuItemsWithRatings,
      },
      count: {
        categories: categories.length,
        menuItems: menuItemsWithRatings.length,
      },
      cached: false,
    };

    // Cache for 30 minutes (aggressive caching for public menu)
    cache.set(cacheKey, response, 30 * 60 * 1000);

    res.setHeader('X-Cache', 'MISS');
    res.status(200).json(response);
  } catch (error: any) {
    console.error('Error fetching public menu:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

/**
 * @desc    Invalidate public menu cache (called when menu items are updated)
 * @route   POST /api/public/menu/:restaurantId/invalidate
 * @access  Private (Admin only)
 */
export const invalidatePublicMenuCache = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { restaurantId } = req.params;

    if (!restaurantId) {
      res.status(400).json({
        success: false,
        message: 'Restaurant ID is required',
      });
      return;
    }

    // Invalidate all menu-related cache entries for this restaurant
    const pattern = new RegExp(`^(menu:page|public:menu):${restaurantId}`);
    const deletedCount = cache.deletePattern(pattern);

    res.status(200).json({
      success: true,
      message: 'Menu cache invalidated',
      deletedEntries: deletedCount,
    });
  } catch (error: any) {
    console.error('Error invalidating menu cache:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};
