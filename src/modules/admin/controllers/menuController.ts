import { Request, Response } from 'express';
import MenuItem from '../../common/models/MenuItem';
import Review from '../../common/models/Review';
import Category from '../../common/models/Category';
import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';
import {
  getCached,
  setCached,
  invalidateMenuCache,
  invalidateMenuItemCache,
  CACHE_TTL,
  CACHE_KEYS,
} from '../../common/utils/redisCache';
import { transformMenuItemsWithCDN, transformMenuItemWithCDN } from '../../common/utils/cdnHelper';

// Field selection for optimized payload
const MENU_ITEM_FIELDS =
  '_id restaurantId name description categoryId price originalPrice images isAvailable ' +
  'isVegetarian isVegan isGlutenFree isNonVeg preparationTime averageRating ratingsCount createdAt';

// @desc    Get admin menu management page data (categories + menu items) - OPTIMIZED
// @route   GET /api/menu/admin/page-data
// @access  Private (Admin)
export const getAdminMenuPageData = async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  let cacheCheckTime = 0;
  let dbQueryTime = 0;

  try {
    const restaurantId = req.restaurantId!.toString();
    const cacheKey = CACHE_KEYS.ADMIN_MENU_PAGE_DATA(restaurantId);

    // Try cache (15 second TTL for admin menu management)
    const cacheStart = Date.now();
    const cached = await getCached<any>(cacheKey);
    cacheCheckTime = Date.now() - cacheStart;

    if (cached) {
      console.log(`[ADMIN MENU API] Cache HIT - took ${cacheCheckTime}ms`);
      const totalTime = Date.now() - startTime;
      res.status(200).json({
        ...cached,
        cached: true,
        _perf: {
          total: totalTime,
          cache: cacheCheckTime,
          db: 0,
        },
      });
      return;
    }

    console.log(`[ADMIN MENU API] Cache MISS - querying database`);

    const dbStart = Date.now();

    // Single aggregation using $facet to get both categories and menu items
    const result = await Category.aggregate([
      { $match: { restaurantId: req.restaurantId } },
      { $limit: 1 }, // Just need one to start the facet
      {
        $facet: {
          categories: [
            {
              $lookup: {
                from: 'categories',
                let: { restaurantId: '$restaurantId' },
                pipeline: [
                  {
                    $match: {
                      $expr: { $eq: ['$restaurantId', '$$restaurantId'] },
                    },
                  },
                  {
                    $project: {
                      _id: 1,
                      name: 1,
                      description: 1,
                      displayOrder: 1,
                      isActive: 1,
                      createdAt: 1,
                    },
                  },
                  { $sort: { displayOrder: 1, name: 1 } },
                ],
                as: 'result',
              },
            },
            { $project: { result: 1, _id: 0 } },
          ],
          menuItems: [
            {
              $lookup: {
                from: 'menuitems',
                let: { restaurantId: '$restaurantId' },
                pipeline: [
                  {
                    $match: {
                      $expr: { $eq: ['$restaurantId', '$$restaurantId'] },
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
                      createdAt: 1,
                    },
                  },
                  { $sort: { createdAt: -1 } },
                ],
                as: 'result',
              },
            },
            { $project: { result: 1, _id: 0 } },
          ],
        },
      },
      {
        $project: {
          categories: { $arrayElemAt: ['$categories.result', 0] },
          menuItems: { $arrayElemAt: ['$menuItems.result', 0] },
        },
      },
    ]).exec();

    dbQueryTime = Date.now() - dbStart;

    const categories = result[0]?.categories || [];
    const menuItems = result[0]?.menuItems || [];

    // Optimize images with CDN
    const menuItemsOptimized = transformMenuItemsWithCDN(menuItems);

    const responseData = {
      success: true,
      data: {
        categories,
        menuItems: menuItemsOptimized,
      },
      count: {
        categories: categories.length,
        menuItems: menuItemsOptimized.length,
      },
    };

    // Cache for 15 seconds
    await setCached(cacheKey, responseData, 15);

    const totalTime = Date.now() - startTime;
    console.log(
      `[ADMIN MENU API] ✅ TOTAL TIME: ${totalTime}ms (cache: ${cacheCheckTime}ms, db: ${dbQueryTime}ms)`
    );

    res.status(200).json({
      ...responseData,
      cached: false,
      _perf: {
        total: totalTime,
        cache: cacheCheckTime,
        db: dbQueryTime,
      },
    });
  } catch (error: any) {
    console.error('[ADMIN MENU API] Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get menu page data (categories + menu items with ratings + favorites) - SINGLE QUERY OPTIMIZED
// @route   GET /api/menu/page-data
// @access  Public (favorites only if authenticated)
//
// OPTIMIZATIONS FOR SPEED:
// - SINGLE aggregation query instead of 3-4 separate queries
// - Reduces network roundtrips from 3-4 to 1 (huge win for cloud DB)
// - Short cache (10s) for real-time menu availability
// - Server-side JOINs using $lookup
// - Minimal field projection
// - Includes favorites when user is authenticated
// - Uses pre-computed ratings (averageRating/ratingsCount fields on MenuItem) instead of real-time review aggregation
//
// Target: <80ms (cloud DB with optimized single query)
export const getMenuPageData = async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  let cacheCheckTime = 0;
  let dbQueryTime = 0;
  let cdnTransformTime = 0;

  try {
    const { available } = req.query;
    const restaurantId = req.restaurantId!.toString();
    const customerId = req.customer?._id?.toString();
    const filterKey = available === 'true' ? 'available' : 'all';
    const cacheKeySuffix = customerId ? `:${customerId}` : ':guest';

    // Check cache (10 second TTL for real-time menu updates)
    const cacheStart = Date.now();
    const cacheKey = CACHE_KEYS.MENU_PAGE_DATA(restaurantId, filterKey) + cacheKeySuffix;
    const cached = await getCached<any>(cacheKey);
    cacheCheckTime = Date.now() - cacheStart;

    let result;

    if (cached) {
      console.log(`[MENU API] Cache HIT - took ${cacheCheckTime}ms`);
      result = cached;
    } else {
      console.log(`[MENU API] Cache MISS - starting single aggregation query`);

      const dbStart = Date.now();

      // Use Category collection as base (simpler than Restaurant)
      const aggregationResult = await Category.aggregate([
        { $match: { restaurantId: req.restaurantId, isActive: true } },
        { $limit: 1 }, // Just need one to start the facet
        {
          $facet: {
            categories: [
              {
                $lookup: {
                  from: 'categories',
                  let: { restaurantId: '$restaurantId' },
                  pipeline: [
                    {
                      $match: {
                        $expr: {
                          $and: [
                            { $eq: ['$restaurantId', '$$restaurantId'] },
                            { $eq: ['$isActive', true] },
                          ],
                        },
                      },
                    },
                    {
                      $project: {
                        _id: 1,
                        name: 1,
                        displayOrder: 1,
                      },
                    },
                    { $sort: { displayOrder: 1, name: 1 } },
                  ],
                  as: 'result',
                },
              },
              { $project: { result: 1, _id: 0 } },
            ],
            menuItems: [
              {
                $lookup: {
                  from: 'menuitems',
                  let: { restaurantId: '$restaurantId' },
                  pipeline: [
                    {
                      $match: {
                        $expr: {
                          $and: [
                            { $eq: ['$restaurantId', '$$restaurantId'] },
                            ...(available === 'true' ? [{ $eq: ['$isAvailable', true] }] : []),
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
                        // Use pre-computed ratings from MenuItem model (updated by background job or on review save)
                        averageRating: { $ifNull: ['$averageRating', 0] },
                        ratingsCount: { $ifNull: ['$ratingsCount', 0] },
                      },
                    },
                    { $sort: { name: 1 } },
                  ],
                  as: 'result',
                },
              },
              { $project: { result: 1, _id: 0 } },
            ],
            // Fetch favorites if customer is authenticated
            ...(customerId ? {
              favorites: [
                {
                  $lookup: {
                    from: 'favorites',
                    let: { restaurantId: '$restaurantId' },
                    pipeline: [
                      {
                        $match: {
                          $expr: {
                            $and: [
                              { $eq: ['$customerId', new mongoose.Types.ObjectId(customerId)] },
                              { $eq: ['$restaurantId', '$$restaurantId'] },
                            ],
                          },
                        },
                      },
                      {
                        $project: {
                          menuItemId: 1,
                        },
                      },
                    ],
                    as: 'result',
                  },
                },
                { $project: { result: 1, _id: 0 } },
              ],
            } : {}),
          },
        },
        {
          $project: {
            categories: { $arrayElemAt: ['$categories.result', 0] },
            menuItems: { $arrayElemAt: ['$menuItems.result', 0] },
            ...(customerId ? { favorites: { $arrayElemAt: ['$favorites.result', 0] } } : {}),
          },
        },
      ]).exec();

      dbQueryTime = Date.now() - dbStart;
      console.log(`[MENU API] DB aggregation completed in ${dbQueryTime}ms`);

      const categories = aggregationResult[0]?.categories || [];
      const menuItems = aggregationResult[0]?.menuItems || [];
      const favorites = aggregationResult[0]?.favorites || [];

      // Extract favorite menu item IDs for easier frontend consumption
      const favoriteIds = favorites.map((fav: any) => fav.menuItemId.toString());

      // Optimize images with CDN
      const cdnStart = Date.now();
      const menuItemsOptimized = transformMenuItemsWithCDN(menuItems);
      cdnTransformTime = Date.now() - cdnStart;
      console.log(`[MENU API] CDN transformation took ${cdnTransformTime}ms`);

      result = {
        data: {
          categories,
          menuItems: menuItemsOptimized,
          favoriteIds,
        },
        count: {
          categories: categories.length,
          menuItems: menuItemsOptimized.length,
          favorites: favoriteIds.length,
        },
      };

      console.log(`[MENU API] Result prepared - ${menuItemsOptimized.length} menu items, ${favoriteIds.length} favorites`);

      // Cache the result (10 seconds for real-time availability)
      await setCached(cacheKey, result, 10);
    }

    const totalTime = Date.now() - startTime;
    console.log(`[MENU API] ✅ TOTAL TIME: ${totalTime}ms (cache: ${cacheCheckTime}ms, db: ${dbQueryTime}ms, cdn: ${cdnTransformTime}ms)`);

    res.status(200).json({
      success: true,
      ...result,
      cached: !!cached,
      _perf: {
        total: totalTime,
        cache: cacheCheckTime,
        db: dbQueryTime,
        cdn: cdnTransformTime,
        queries: 1, // Single aggregation instead of 3-4 queries (removed reviews real-time lookup)
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

// @desc    Get all menu items with cursor-based pagination - OPTIMIZED
// @route   GET /api/menu
// @access  Public
export const getMenuItems = async (req: Request, res: Response): Promise<void> => {
  try {
    const { categoryId, available, cursor, limit = '20', search } = req.query;
    const restaurantId = req.restaurantId!.toString();

    // Create filter hash for cache key
    const filterHash = `cat:${categoryId || 'all'}_avail:${available || 'all'}_search:${search || 'none'}_cursor:${cursor || 'start'}_limit:${limit}`;

    // Try to get from cache
    const cacheKey = CACHE_KEYS.MENU_LIST(restaurantId, filterHash);
    const cached = await getCached<any>(cacheKey);

    if (cached) {
      res.status(200).json({
        success: true,
        ...cached,
        cached: true,
      });
      return;
    }

    // Build filter
    const filter: any = { restaurantId: req.restaurantId };

    if (categoryId) {
      filter.categoryId = categoryId;
    }

    if (available === 'true') {
      filter.isAvailable = true;
    }

    // Cursor-based pagination
    if (cursor) {
      filter._id = { $lt: cursor };
    }

    // Text search if provided
    if (search && typeof search === 'string') {
      filter.$text = { $search: search };
    }

    const limitNum = Math.min(parseInt(limit as string) || 20, 100); // Max 100 items

    // Single optimized query with LEAN and SELECT
    const menuItems = await MenuItem.find(filter)
      .select(MENU_ITEM_FIELDS)
      .populate('categoryId', 'name')
      .sort({ _id: -1 }) // Sort by _id for cursor pagination
      .limit(limitNum + 1) // Fetch one extra to check if there's a next page
      .lean();

    // Check if there's a next page
    const hasNextPage = menuItems.length > limitNum;
    const items = hasNextPage ? menuItems.slice(0, limitNum) : menuItems;
    const nextCursor = hasNextPage ? items[items.length - 1]._id.toString() : null;

    // Single aggregation query for ratings
    const itemIds = items.map((item: any) => item._id);
    const ratings = await Review.aggregate([
      {
        $match: {
          restaurantId: req.restaurantId,
          menuItemId: { $in: itemIds },
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

    // Create ratings map
    const ratingsMap = new Map();
    ratings.forEach((rating: any) => {
      ratingsMap.set(rating._id.toString(), {
        averageRating: Math.round(rating.averageRating * 10) / 10,
        totalReviews: rating.totalReviews,
      });
    });

    // Attach ratings and optimize images
    const menuItemsWithRatings = transformMenuItemsWithCDN(
      items.map((item: any) => {
        const itemRatings = ratingsMap.get(item._id.toString());
        return {
          ...item,
          averageRating: itemRatings?.averageRating || 0,
          totalReviews: itemRatings?.totalReviews || 0,
        };
      })
    );

    const responseData = {
      count: menuItemsWithRatings.length,
      data: menuItemsWithRatings,
      pagination: {
        hasNextPage,
        nextCursor,
        limit: limitNum,
      },
    };

    // Cache the response
    await setCached(cacheKey, responseData, CACHE_TTL.MENU_LIST);

    res.status(200).json({
      success: true,
      ...responseData,
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

// @desc    Get menu items by category - OPTIMIZED
// @route   GET /api/menu/category/:categoryId
// @access  Public
export const getMenuItemsByCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const restaurantId = req.restaurantId!.toString();
    const categoryId = req.params.categoryId;
    const filterKey = 'available';

    // Try to get from cache
    const cacheKey = CACHE_KEYS.MENU_CATEGORY(restaurantId, categoryId, filterKey);
    const cached = await getCached<any>(cacheKey);

    if (cached) {
      res.status(200).json({
        success: true,
        ...cached,
        cached: true,
      });
      return;
    }

    // Optimized query with LEAN and SELECT
    const menuItems = await MenuItem.find({
      restaurantId: req.restaurantId,
      categoryId: categoryId,
      isAvailable: true,
    })
      .select(MENU_ITEM_FIELDS)
      .populate('categoryId', 'name')
      .sort({ name: 1 })
      .lean();

    // Get ratings in single aggregation
    const itemIds = menuItems.map((item: any) => item._id);
    const ratings = await Review.aggregate([
      {
        $match: {
          restaurantId: req.restaurantId,
          menuItemId: { $in: itemIds },
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

    // Create ratings map
    const ratingsMap = new Map();
    ratings.forEach((rating: any) => {
      ratingsMap.set(rating._id.toString(), {
        averageRating: Math.round(rating.averageRating * 10) / 10,
        totalReviews: rating.totalReviews,
      });
    });

    // Attach ratings and optimize images
    const menuItemsWithRatings = transformMenuItemsWithCDN(
      menuItems.map((item: any) => {
        const itemRatings = ratingsMap.get(item._id.toString());
        return {
          ...item,
          averageRating: itemRatings?.averageRating || 0,
          totalReviews: itemRatings?.totalReviews || 0,
        };
      })
    );

    const responseData = {
      count: menuItemsWithRatings.length,
      data: menuItemsWithRatings,
    };

    // Cache the response
    await setCached(cacheKey, responseData, CACHE_TTL.MENU_LIST);

    res.status(200).json({
      success: true,
      ...responseData,
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

// @desc    Get menu item by ID - OPTIMIZED
// @route   GET /api/menu/:id
// @access  Public
export const getMenuItemById = async (req: Request, res: Response): Promise<void> => {
  try {
    const restaurantId = req.restaurantId!.toString();
    const itemId = req.params.id;

    // Try to get from cache
    const cacheKey = CACHE_KEYS.MENU_ITEM(restaurantId, itemId);
    const cached = await getCached<any>(cacheKey);

    if (cached) {
      res.status(200).json({
        success: true,
        data: cached,
        cached: true,
      });
      return;
    }

    // Optimized query with LEAN and SELECT
    const menuItem = await MenuItem.findOne({
      _id: req.params.id,
      restaurantId: req.restaurantId,
    })
      .select(MENU_ITEM_FIELDS)
      .populate('categoryId', 'name')
      .lean();

    if (!menuItem) {
      res.status(404).json({
        success: false,
        message: 'Menu item not found',
      });
      return;
    }

    // Get ratings
    const ratings = await Review.aggregate([
      {
        $match: {
          restaurantId: req.restaurantId,
          menuItemId: menuItem._id,
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

    const menuItemWithRating = {
      ...menuItem,
      averageRating: ratings.length > 0 ? Math.round(ratings[0].averageRating * 10) / 10 : 0,
      totalReviews: ratings.length > 0 ? ratings[0].totalReviews : 0,
    };

    const optimizedMenuItem = transformMenuItemWithCDN(menuItemWithRating);

    // Cache the response
    await setCached(cacheKey, optimizedMenuItem, CACHE_TTL.MENU_ITEM);

    res.status(200).json({
      success: true,
      data: optimizedMenuItem,
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

// @desc    Get menu statistics using aggregation - NEW & OPTIMIZED
// @route   GET /api/menu/stats
// @access  Private (Admin)
export const getMenuStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const restaurantId = req.restaurantId!.toString();

    // Try to get from cache
    const cacheKey = CACHE_KEYS.MENU_STATS(restaurantId);
    const cached = await getCached<any>(cacheKey);

    if (cached) {
      res.status(200).json({
        success: true,
        data: cached,
        cached: true,
      });
      return;
    }

    // Single aggregation pipeline for all stats
    const stats = await MenuItem.aggregate([
      {
        $match: { restaurantId: req.restaurantId },
      },
      {
        $facet: {
          overview: [
            {
              $group: {
                _id: null,
                totalItems: { $sum: 1 },
                availableItems: {
                  $sum: { $cond: ['$isAvailable', 1, 0] },
                },
                unavailableItems: {
                  $sum: { $cond: ['$isAvailable', 0, 1] },
                },
                vegetarianItems: {
                  $sum: { $cond: ['$isVegetarian', 1, 0] },
                },
                veganItems: {
                  $sum: { $cond: ['$isVegan', 1, 0] },
                },
                nonVegItems: {
                  $sum: { $cond: ['$isNonVeg', 1, 0] },
                },
                avgPrice: { $avg: '$price' },
                minPrice: { $min: '$price' },
                maxPrice: { $max: '$price' },
              },
            },
          ],
          byCategory: [
            {
              $group: {
                _id: '$categoryId',
                count: { $sum: 1 },
                availableCount: {
                  $sum: { $cond: ['$isAvailable', 1, 0] },
                },
                avgPrice: { $avg: '$price' },
              },
            },
            {
              $lookup: {
                from: 'categories',
                localField: '_id',
                foreignField: '_id',
                as: 'category',
              },
            },
            {
              $unwind: '$category',
            },
            {
              $project: {
                categoryId: '$_id',
                categoryName: '$category.name',
                count: 1,
                availableCount: 1,
                avgPrice: { $round: ['$avgPrice', 2] },
              },
            },
          ],
          recentlyAdded: [
            {
              $sort: { createdAt: -1 },
            },
            {
              $limit: 5,
            },
            {
              $project: {
                _id: 1,
                name: 1,
                price: 1,
                isAvailable: 1,
                createdAt: 1,
              },
            },
          ],
        },
      },
    ]);

    const responseData = {
      overview: stats[0].overview[0] || {},
      byCategory: stats[0].byCategory || [],
      recentlyAdded: stats[0].recentlyAdded || [],
    };

    // Cache the response
    await setCached(cacheKey, responseData, CACHE_TTL.MENU_STATS);

    res.status(200).json({
      success: true,
      data: responseData,
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

// @desc    Create menu item with optional image upload - OPTIMIZED (SINGLE REQUEST)
// @route   POST /api/menu
// @access  Private (Admin)
export const createMenuItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      name,
      description,
      categoryId,
      price,
      originalPrice,
      isVegetarian,
      isVegan,
      isGlutenFree,
      isNonVeg,
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

    // Parse customizationOptions if it's a JSON string (from FormData)
    let parsedCustomizations = customizationOptions;
    if (typeof customizationOptions === 'string') {
      try {
        parsedCustomizations = JSON.parse(customizationOptions);
      } catch (e) {
        parsedCustomizations = [];
      }
    }

    // Create menu item
    const menuItem = await MenuItem.create({
      restaurantId: req.restaurantId,
      name,
      description,
      categoryId,
      price: Number(price),
      originalPrice: originalPrice ? Number(originalPrice) : undefined,
      isVegetarian: isVegetarian === 'true' || isVegetarian === true,
      isVegan: isVegan === 'true' || isVegan === true,
      isGlutenFree: isGlutenFree === 'true' || isGlutenFree === true,
      isNonVeg: isNonVeg === 'true' || isNonVeg === true,
      customizationOptions: parsedCustomizations || [],
      preparationTime: preparationTime ? Number(preparationTime) : undefined,
      // Set image if uploaded
      ...(req.file && { image: `/uploads/menu-items/${req.file.filename}` }),
    });

    // Invalidate all menu caches for this restaurant
    await invalidateMenuCache(req.restaurantId!.toString());

    res.status(201).json({
      success: true,
      data: menuItem,
      message: 'Menu item created successfully',
    });
  } catch (error: any) {
    console.error('Create menu item error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Update menu item with optional image upload - OPTIMIZED (SINGLE REQUEST)
// @route   PUT /api/menu/:id
// @access  Private (Admin)
export const updateMenuItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      name,
      description,
      categoryId,
      price,
      originalPrice,
      isAvailable,
      isVegetarian,
      isVegan,
      isGlutenFree,
      isNonVeg,
      customizationOptions,
      preparationTime,
    } = req.body;

    // Find the menu item first to check if it exists and delete old image if new one provided
    const existingItem = await MenuItem.findOne({
      _id: req.params.id,
      restaurantId: req.restaurantId,
    });

    if (!existingItem) {
      res.status(404).json({
        success: false,
        message: 'Menu item not found',
      });
      return;
    }

    // Parse customizationOptions if it's a JSON string (from FormData)
    let parsedCustomizations = customizationOptions;
    if (typeof customizationOptions === 'string') {
      try {
        parsedCustomizations = JSON.parse(customizationOptions);
      } catch (e) {
        parsedCustomizations = undefined;
      }
    }

    // Delete old images if new image is being uploaded
    if (req.file && existingItem.images) {
      const imagePaths = [
        existingItem.images.original,
        existingItem.images.large,
        existingItem.images.medium,
        existingItem.images.small,
      ].filter(Boolean);

      imagePaths.forEach((imagePath) => {
        if (imagePath) {
          const fullPath = path.join(process.cwd(), imagePath);
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
          }
        }
      });
    }

    // Build update object
    const updateData: any = {
      ...(name && { name }),
      ...(description !== undefined && { description }),
      ...(categoryId && { categoryId }),
      ...(price !== undefined && { price: Number(price) }),
      ...(originalPrice !== undefined && { originalPrice: originalPrice ? Number(originalPrice) : undefined }),
      ...(isAvailable !== undefined && { isAvailable: isAvailable === 'true' || isAvailable === true }),
      ...(isVegetarian !== undefined && { isVegetarian: isVegetarian === 'true' || isVegetarian === true }),
      ...(isVegan !== undefined && { isVegan: isVegan === 'true' || isVegan === true }),
      ...(isGlutenFree !== undefined && { isGlutenFree: isGlutenFree === 'true' || isGlutenFree === true }),
      ...(isNonVeg !== undefined && { isNonVeg: isNonVeg === 'true' || isNonVeg === true }),
      ...(parsedCustomizations && { customizationOptions: parsedCustomizations }),
      ...(preparationTime !== undefined && { preparationTime: preparationTime ? Number(preparationTime) : undefined }),
    };

    // Add image if uploaded
    if (req.file) {
      updateData.image = `/uploads/menu-items/${req.file.filename}`;
    }

    // Update menu item
    const menuItem = await MenuItem.findOneAndUpdate(
      {
        _id: req.params.id,
        restaurantId: req.restaurantId,
      },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    // Invalidate cache
    await invalidateMenuItemCache(req.restaurantId!.toString(), req.params.id);

    res.status(200).json({
      success: true,
      data: menuItem,
      message: 'Menu item updated successfully',
    });
  } catch (error: any) {
    console.error('Update menu item error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Delete menu item - WITH CACHE INVALIDATION
// @route   DELETE /api/menu/:id
// @access  Private (Admin)
export const deleteMenuItem = async (req: Request, res: Response): Promise<void> => {
  try {
    // Find with restaurantId validation
    const menuItem = await MenuItem.findOne({
      _id: req.params.id,
      restaurantId: req.restaurantId,
    }).lean();

    if (!menuItem) {
      res.status(404).json({
        success: false,
        message: 'Menu item not found',
      });
      return;
    }

    // Delete image files if exist
    if (menuItem.images) {
      const imagePaths = [
        menuItem.images.original,
        menuItem.images.large,
        menuItem.images.medium,
        menuItem.images.small,
      ].filter(Boolean);

      imagePaths.forEach((imagePath) => {
        if (imagePath) {
          const fullPath = path.join(process.cwd(), imagePath);
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
          }
        }
      });
    }

    // Delete the menu item
    await MenuItem.deleteOne({ _id: req.params.id });

    // Invalidate cache
    await invalidateMenuItemCache(req.restaurantId!.toString(), req.params.id);

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

// @desc    Toggle menu item availability - WITH CACHE INVALIDATION
// @route   PATCH /api/menu/:id/availability
// @access  Private (Admin)
export const toggleAvailability = async (req: Request, res: Response): Promise<void> => {
  try {
    // Find current state
    const menuItem = await MenuItem.findOne({
      _id: req.params.id,
      restaurantId: req.restaurantId,
    }).select('isAvailable').lean();

    if (!menuItem) {
      res.status(404).json({
        success: false,
        message: 'Menu item not found',
      });
      return;
    }

    // Toggle availability
    const updated = await MenuItem.findOneAndUpdate(
      {
        _id: req.params.id,
        restaurantId: req.restaurantId,
      },
      {
        $set: { isAvailable: !menuItem.isAvailable },
      },
      { new: true }
    );

    // Invalidate cache
    await invalidateMenuItemCache(req.restaurantId!.toString(), req.params.id);

    res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Batch update availability - NEW & OPTIMIZED
// @route   PATCH /api/menu/batch/availability
// @access  Private (Admin)
export const batchUpdateAvailability = async (req: Request, res: Response): Promise<void> => {
  try {
    const { itemIds, isAvailable } = req.body;

    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      res.status(400).json({
        success: false,
        message: 'itemIds array is required',
      });
      return;
    }

    if (typeof isAvailable !== 'boolean') {
      res.status(400).json({
        success: false,
        message: 'isAvailable boolean is required',
      });
      return;
    }

    // Batch update in single query
    const result = await MenuItem.updateMany(
      {
        _id: { $in: itemIds },
        restaurantId: req.restaurantId,
      },
      {
        $set: { isAvailable },
      }
    );

    // Invalidate all menu caches
    await invalidateMenuCache(req.restaurantId!.toString());

    res.status(200).json({
      success: true,
      message: `Updated ${result.modifiedCount} items`,
      data: {
        matched: result.matchedCount,
        modified: result.modifiedCount,
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

// @desc    Upload menu item image - WITH CACHE INVALIDATION
// @route   POST /api/menu/:id/image
// @access  Private (Admin)
export const uploadImage = async (req: Request, res: Response): Promise<void> => {
  try {
    // Find menu item
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

    // Delete old images if exist
    if (menuItem.images) {
      const imagePaths = [
        menuItem.images.original,
        menuItem.images.large,
        menuItem.images.medium,
        menuItem.images.small,
      ].filter(Boolean);

      imagePaths.forEach((imagePath) => {
        if (imagePath) {
          const fullPath = path.join(process.cwd(), imagePath);
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
          }
        }
      });
    }

    // Update image path (using virtual field for backward compatibility)
    menuItem.image = `/uploads/menu-items/${req.file.filename}`;
    await menuItem.save();

    // Invalidate cache
    await invalidateMenuItemCache(req.restaurantId!.toString(), req.params.id);

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
