import { Request, Response } from 'express';
import Restaurant from '../../common/models/Restaurant';
import cacheService, { CacheKeys } from '../../common/services/cacheService';
import mongoose from 'mongoose';

/**
 * @desc    Get all home page data in a single request (SINGLE QUERY OPTIMIZED)
 * @route   GET /api/home
 * @access  Public (with optional auth)
 *
 * OPTIMIZATIONS FOR SPEED:
 * - SINGLE aggregation query instead of 3 separate queries
 * - Reduces network roundtrips from 3 to 1 (huge win for cloud DB)
 * - Short cache (10s) for real-time table availability
 * - .lean() equivalent in aggregation
 * - Minimal field projection
 * - Returns ALL active orders (not just one) for multi-order support
 *
 * Target: <100ms (cloud DB with single query)
 */
export const getHomePageData = async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  let cacheCheckTime = 0;
  let dbQueryTime = 0;

  try {
    const restaurantId = req.restaurantId!.toString();
    const customerId = req.customer?._id?.toString();

    // Check cache (10 second TTL for real-time updates)
    const cacheStart = Date.now();
    const cacheKey = CacheKeys.homePageData(restaurantId);
    const cached = await cacheService.get<any>(cacheKey);
    cacheCheckTime = Date.now() - cacheStart;

    let result;

    if (cached) {
      console.log(`[HOME API] Cache HIT - took ${cacheCheckTime}ms`);
      result = cached;
    } else {
      console.log(`[HOME API] Cache MISS - single aggregation query`);

      // CRITICAL OPTIMIZATION: Single aggregation query combines all data
      const dbStart = Date.now();

      const pipeline: any[] = [
        // Start with restaurant lookup
        { $match: { _id: new mongoose.Types.ObjectId(restaurantId) } },

        // Project only needed restaurant fields
        {
          $project: {
            name: 1,
            subdomain: 1,
            logo: 1,
            primaryColor: 1,
            accentColor: 1,
          },
        },

        // Lookup tables for this restaurant
        {
          $lookup: {
            from: 'tables',
            let: { restaurantId: '$_id' },
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
                  tableNumber: 1,
                  capacity: 1,
                  location: 1,
                  isOccupied: 1,
                },
              },
              { $sort: { tableNumber: 1 } },
            ],
            as: 'tables',
          },
        },
      ];

      // Add active orders lookup only if customer is authenticated
      if (customerId) {
        pipeline.push({
          $lookup: {
            from: 'orders',
            let: { restaurantId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$customerId', new mongoose.Types.ObjectId(customerId)] },
                      { $eq: ['$restaurantId', '$$restaurantId'] },
                      { $in: ['$status', ['received', 'preparing', 'ready']] },
                    ],
                  },
                },
              },
              {
                $project: {
                  _id: 1,
                  orderNumber: 1,
                  tableNumber: 1,
                  status: 1,
                  total: 1,
                  createdAt: 1,
                },
              },
              { $sort: { createdAt: -1 } },
            ],
            as: 'activeOrders',
          },
        });
      } else {
        // If not authenticated, set activeOrders to empty array
        pipeline.push({
          $addFields: {
            activeOrders: [],
          },
        });
      }

      const aggregationResult = await Restaurant.aggregate(pipeline).exec();
      dbQueryTime = Date.now() - dbStart;

      if (!aggregationResult || aggregationResult.length === 0) {
        res.status(404).json({ success: false, message: 'Restaurant not found' });
        return;
      }

      result = aggregationResult[0];
      console.log(`[HOME API] Single aggregation query took ${dbQueryTime}ms`);

      // Cache the result
      await cacheService.set(cacheKey, result, 10000);
    }

    const totalTime = Date.now() - startTime;
    console.log(`[HOME API] ✅ TOTAL TIME: ${totalTime}ms (cache: ${cacheCheckTime}ms, db: ${dbQueryTime}ms)`);

    res.status(200).json({
      success: true,
      data: {
        restaurant: {
          _id: result._id,
          name: result.name,
          subdomain: result.subdomain,
          logo: result.logo,
          primaryColor: result.primaryColor,
          accentColor: result.accentColor,
        },
        tables: result.tables || [],
        activeOrders: result.activeOrders || [],
      },
      cached: !!cached,
      _perf: {
        total: totalTime,
        cache: cacheCheckTime,
        db: dbQueryTime,
        queries: 1, // Single aggregation instead of 3 queries
      },
    });
  } catch (error: any) {
    console.error('Get home page data error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

/**
 * @desc    Register FCM token for push notifications
 * @route   POST /api/home/fcm-token
 * @access  Private (Customer)
 *
 * OPTIMIZATION: Frontend should check localStorage first before calling this
 */
export const registerFCMToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.body;
    const customerId = req.customer!._id;

    if (!token) {
      res.status(400).json({
        success: false,
        message: 'FCM token is required',
      });
      return;
    }

    // Import Customer model dynamically to avoid circular dependency
    const Customer = (await import('../../common/models/Customer')).default;

    // Update customer's FCM token
    await Customer.findByIdAndUpdate(
      customerId,
      { fcmToken: token },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: 'FCM token registered successfully',
    });
  } catch (error: any) {
    console.error('Register FCM token error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};
