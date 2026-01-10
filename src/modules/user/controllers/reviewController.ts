import { Request, Response } from 'express';
import Review from '../../common/models/Review';
import Order from '../../common/models/Order';
import MenuItem from '../../common/models/MenuItem';
import mongoose from 'mongoose';
import { updateMenuItemRating } from '../../common/utils/ratingUtils';
import cacheService, { CacheKeys } from '../../common/services/cacheService';

/**
 * OPTIMIZED REVIEW CONTROLLER
 *
 * Optimizations implemented:
 * 1. Cache review aggregations (average rating) with 5-minute TTL
 * 2. Compound index: { menuItemId: 1, customerId: 1 } (already in Review model)
 * 3. Cursor-based pagination for better performance on large datasets
 * 4. Lean queries to reduce memory overhead
 * 5. Parallel query execution where possible
 * 6. Cache invalidation on mutations
 * 7. Optimized aggregation pipelines
 *
 * Target: Reviews <50ms
 */

// @desc    Create review
// @route   POST /api/reviews
// @access  Protected (Customer)
export const createReview = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId, menuItemId, rating, comment } = req.body;
    const customerId = req.customer?._id;

    if (!customerId) {
      res.status(401).json({
        success: false,
        message: 'Customer authentication required',
      });
      return;
    }

    // Parallel validation queries
    const [order, menuItem] = await Promise.all([
      Order.findOne({
        _id: orderId,
        restaurantId: req.restaurantId,
      })
        .lean()
        .exec(),
      menuItemId
        ? MenuItem.findOne({
            _id: menuItemId,
            restaurantId: req.restaurantId,
          })
            .lean()
            .exec()
        : null,
    ]);

    if (!order) {
      res.status(404).json({
        success: false,
        message: 'Order not found',
      });
      return;
    }

    if (order.status !== 'served') {
      res.status(400).json({
        success: false,
        message: 'Can only review completed orders',
      });
      return;
    }

    if (menuItemId) {
      if (!menuItem) {
        res.status(404).json({
          success: false,
          message: 'Menu item not found',
        });
        return;
      }

      const itemInOrder = order.items.some(
        (item) => item.menuItemId.toString() === menuItemId
      );

      if (!itemInOrder) {
        res.status(400).json({
          success: false,
          message: 'Menu item was not in this order',
        });
        return;
      }
    }

    // Check for existing review (using compound index)
    const existingReview = await Review.findOne({
      restaurantId: req.restaurantId,
      orderId,
      customerId,
      ...(menuItemId ? { menuItemId } : { menuItemId: { $exists: false } }),
    })
      .select('_id')
      .lean()
      .exec();

    if (existingReview) {
      res.status(400).json({
        success: false,
        message: 'You have already reviewed this item',
      });
      return;
    }

    // Create review
    const review = await Review.create({
      restaurantId: req.restaurantId,
      customerId,
      orderId,
      menuItemId: menuItemId || undefined,
      rating,
      comment,
    });

    // Invalidate cache for this menu item/restaurant
    const restaurantIdStr = req.restaurantId!.toString();
    if (menuItemId) {
      cacheService.deletePattern(
        CacheKeys.reviewItemPattern(restaurantIdStr, menuItemId)
      );
      // Update rating cache asynchronously (don't block response)
      updateMenuItemRating(menuItemId).catch((error) =>
        console.error('Error updating menu item rating:', error)
      );
    } else {
      cacheService.deletePattern(CacheKeys.reviewPattern(restaurantIdStr));
    }

    // Populate review for response (lean query)
    const populatedReview = await Review.findById(review._id)
      .populate('menuItemId', 'name image')
      .populate('orderId', 'orderNumber')
      .lean()
      .exec();

    res.status(201).json({
      success: true,
      data: populatedReview,
    });
  } catch (error: any) {
    console.error('Create review error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get reviews with cursor-based pagination
// @route   GET /api/reviews
// @access  Public
export const getReviews = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      menuItemId,
      orderId,
      customerId,
      minRating,
      limit = 20,
      cursor, // Cursor for pagination (review _id)
      sortBy = 'createdAt',
      order = 'desc',
    } = req.query;

    // Build filter
    const filter: any = {
      restaurantId: req.restaurantId,
      isVisible: true,
    };

    if (menuItemId) filter.menuItemId = menuItemId;
    if (orderId) filter.orderId = orderId;
    if (customerId) filter.customerId = customerId;
    if (minRating) filter.rating = { $gte: Number(minRating) };

    // Cursor-based pagination for better performance
    if (cursor) {
      const sortOrder = order === 'asc' ? '$gt' : '$lt';
      filter._id = { [sortOrder]: new mongoose.Types.ObjectId(cursor as string) };
    }

    const sortOrder = order === 'asc' ? 1 : -1;
    const limitNum = Math.min(Number(limit), 100); // Cap at 100

    // Try cache first (only for common queries without customerId/orderId)
    let reviews: any[] | null = null;
    const cacheKey =
      !customerId && !orderId
        ? CacheKeys.reviewList(req.restaurantId!.toString(), {
            menuItemId,
            minRating,
            limit: limitNum,
            cursor,
            sortBy,
            order,
          })
        : null;

    if (cacheKey) {
      reviews = await cacheService.get<any[]>(cacheKey);
    }

    if (!reviews) {
      // Optimized query with lean() and minimal population
      reviews = await Review.find(filter)
        .select('_id rating comment helpfulCount createdAt menuItemId orderId')
        .populate('menuItemId', 'name image price')
        .populate('orderId', 'orderNumber')
        .sort({ [sortBy as string]: sortOrder, _id: sortOrder })
        .limit(limitNum + 1) // Fetch one extra to check if there's more
        .lean()
        .exec();

      // Cache for 2 minutes
      if (cacheKey) {
        cacheService.set(cacheKey, reviews, 120000);
      }
    }

    // Check if there are more results
    const hasMore = reviews.length > limitNum;
    if (hasMore) {
      reviews = reviews.slice(0, limitNum);
    }

    // Get next cursor
    const nextCursor = hasMore ? reviews[reviews.length - 1]._id : null;

    res.status(200).json({
      success: true,
      count: reviews.length,
      hasMore,
      nextCursor,
      data: reviews,
    });
  } catch (error: any) {
    console.error('Get reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get customer's own reviews
// @route   GET /api/reviews/my
// @access  Protected (Customer)
export const getMyReviews = async (req: Request, res: Response): Promise<void> => {
  try {
    const customerId = req.customer?._id;

    if (!customerId) {
      res.status(401).json({
        success: false,
        message: 'Customer authentication required',
      });
      return;
    }

    const { limit = 20, cursor } = req.query;
    const limitNum = Math.min(Number(limit), 100);

    // Build filter with cursor
    const filter: any = {
      restaurantId: req.restaurantId,
      customerId,
    };

    if (cursor) {
      filter._id = { $lt: new mongoose.Types.ObjectId(cursor as string) };
    }

    // Optimized query
    const reviews = await Review.find(filter)
      .select('_id rating comment createdAt menuItemId orderId')
      .populate('menuItemId', 'name image price')
      .populate('orderId', 'orderNumber')
      .sort({ createdAt: -1, _id: -1 })
      .limit(limitNum + 1)
      .lean()
      .exec();

    const hasMore = reviews.length > limitNum;
    if (hasMore) {
      reviews.pop();
    }

    const nextCursor = hasMore ? reviews[reviews.length - 1]._id : null;

    res.status(200).json({
      success: true,
      count: reviews.length,
      hasMore,
      nextCursor,
      data: reviews,
    });
  } catch (error: any) {
    console.error('Get my reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Update own review
// @route   PUT /api/reviews/:id
// @access  Protected (Customer)
export const updateReview = async (req: Request, res: Response): Promise<void> => {
  try {
    const { rating, comment } = req.body;
    const customerId = req.customer?._id;

    if (!customerId) {
      res.status(401).json({
        success: false,
        message: 'Customer authentication required',
      });
      return;
    }

    const review = await Review.findOne({
      _id: req.params.id,
      restaurantId: req.restaurantId,
      customerId,
    });

    if (!review) {
      res.status(404).json({
        success: false,
        message: 'Review not found or you do not have permission to edit it',
      });
      return;
    }

    if (rating !== undefined) review.rating = rating;
    if (comment !== undefined) review.comment = comment;

    await review.save();

    // Invalidate cache
    const restaurantIdStr = req.restaurantId!.toString();
    if (review.menuItemId) {
      cacheService.deletePattern(
        CacheKeys.reviewItemPattern(restaurantIdStr, review.menuItemId.toString())
      );
      updateMenuItemRating(review.menuItemId).catch((error) =>
        console.error('Error updating menu item rating:', error)
      );
    } else {
      cacheService.deletePattern(CacheKeys.reviewPattern(restaurantIdStr));
    }

    const populatedReview = await Review.findById(review._id)
      .populate('menuItemId', 'name image')
      .populate('orderId', 'orderNumber')
      .lean()
      .exec();

    res.status(200).json({
      success: true,
      data: populatedReview,
    });
  } catch (error: any) {
    console.error('Update review error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Delete own review
// @route   DELETE /api/reviews/:id
// @access  Protected (Customer)
export const deleteReview = async (req: Request, res: Response): Promise<void> => {
  try {
    const customerId = req.customer?._id;

    if (!customerId) {
      res.status(401).json({
        success: false,
        message: 'Customer authentication required',
      });
      return;
    }

    const review = await Review.findOneAndDelete({
      _id: req.params.id,
      restaurantId: req.restaurantId,
      customerId,
    });

    if (!review) {
      res.status(404).json({
        success: false,
        message: 'Review not found or you do not have permission to delete it',
      });
      return;
    }

    // Invalidate cache
    const restaurantIdStr = req.restaurantId!.toString();
    if (review.menuItemId) {
      cacheService.deletePattern(
        CacheKeys.reviewItemPattern(restaurantIdStr, review.menuItemId.toString())
      );
      updateMenuItemRating(review.menuItemId).catch((error) =>
        console.error('Error updating menu item rating:', error)
      );
    } else {
      cacheService.deletePattern(CacheKeys.reviewPattern(restaurantIdStr));
    }

    res.status(200).json({
      success: true,
      message: 'Review deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete review error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Toggle helpful on a review
// @route   POST /api/reviews/:id/helpful
// @access  Protected (Customer)
export const markHelpful = async (req: Request, res: Response): Promise<void> => {
  try {
    const customerId = req.customer?._id?.toString();

    if (!customerId) {
      res.status(401).json({
        success: false,
        message: 'Customer authentication required',
      });
      return;
    }

    const review = await Review.findOne({
      _id: req.params.id,
      restaurantId: req.restaurantId,
    });

    if (!review) {
      res.status(404).json({
        success: false,
        message: 'Review not found',
      });
      return;
    }

    const helpfulIndex = review.helpfulBy.indexOf(customerId);

    if (helpfulIndex > -1) {
      review.helpfulBy.splice(helpfulIndex, 1);
      review.helpfulCount = Math.max(0, review.helpfulCount - 1);
    } else {
      review.helpfulBy.push(customerId);
      review.helpfulCount += 1;
    }

    await review.save();

    res.status(200).json({
      success: true,
      data: {
        helpfulCount: review.helpfulCount,
        isHelpful: helpfulIndex === -1,
      },
    });
  } catch (error: any) {
    console.error('Mark helpful error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get menu item ratings summary (CACHED)
// @route   GET /api/reviews/menu-item/:menuItemId/ratings
// @access  Public
export const getMenuItemRatings = async (req: Request, res: Response): Promise<void> => {
  try {
    const { menuItemId } = req.params;
    const restaurantIdStr = req.restaurantId!.toString();

    // Try cache first (5-minute TTL)
    const cacheKey = CacheKeys.reviewRatings(restaurantIdStr, menuItemId);
    const cached = await cacheService.get<any>(cacheKey);

    if (cached) {
      res.status(200).json({
        success: true,
        data: cached,
        cached: true,
      });
      return;
    }

    // Verify menu item exists
    const menuItem = await MenuItem.findOne({
      _id: menuItemId,
      restaurantId: req.restaurantId,
    })
      .select('_id')
      .lean()
      .exec();

    if (!menuItem) {
      res.status(404).json({
        success: false,
        message: 'Menu item not found',
      });
      return;
    }

    // Optimized aggregation
    const stats = await Review.aggregate([
      {
        $match: {
          restaurantId: new mongoose.Types.ObjectId(restaurantIdStr),
          menuItemId: new mongoose.Types.ObjectId(menuItemId),
          isVisible: true,
        },
      },
      {
        $facet: {
          summary: [
            {
              $group: {
                _id: null,
                averageRating: { $avg: '$rating' },
                totalReviews: { $sum: 1 },
              },
            },
          ],
          distribution: [
            {
              $group: {
                _id: '$rating',
                count: { $sum: 1 },
              },
            },
          ],
        },
      },
    ]);

    if (!stats[0].summary.length) {
      const emptyResult = {
        averageRating: 0,
        totalReviews: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      };

      cacheService.set(cacheKey, emptyResult, 300000); // 5 minutes

      res.status(200).json({
        success: true,
        data: emptyResult,
      });
      return;
    }

    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    stats[0].distribution.forEach((item: any) => {
      distribution[item._id as keyof typeof distribution] = item.count;
    });

    const result = {
      averageRating: Math.round(stats[0].summary[0].averageRating * 10) / 10,
      totalReviews: stats[0].summary[0].totalReviews,
      ratingDistribution: distribution,
    };

    // Cache for 5 minutes
    cacheService.set(cacheKey, result, 300000);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Get menu item ratings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get restaurant ratings summary (CACHED)
// @route   GET /api/reviews/restaurant/ratings
// @access  Public
export const getRestaurantRatings = async (req: Request, res: Response): Promise<void> => {
  try {
    const restaurantIdStr = req.restaurantId!.toString();

    // Try cache first (5-minute TTL)
    const cacheKey = CacheKeys.reviewRatings(restaurantIdStr);
    const cached = await cacheService.get<any>(cacheKey);

    if (cached) {
      res.status(200).json({
        success: true,
        data: cached,
        cached: true,
      });
      return;
    }

    // Optimized aggregation with facet
    const stats = await Review.aggregate([
      {
        $match: {
          restaurantId: new mongoose.Types.ObjectId(restaurantIdStr),
          isVisible: true,
        },
      },
      {
        $facet: {
          summary: [
            {
              $group: {
                _id: null,
                averageRating: { $avg: '$rating' },
                totalReviews: { $sum: 1 },
              },
            },
          ],
          distribution: [
            {
              $group: {
                _id: '$rating',
                count: { $sum: 1 },
              },
            },
          ],
        },
      },
    ]);

    if (!stats[0].summary.length) {
      const emptyResult = {
        averageRating: 0,
        totalReviews: 0,
        ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      };

      cacheService.set(cacheKey, emptyResult, 300000);

      res.status(200).json({
        success: true,
        data: emptyResult,
      });
      return;
    }

    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    stats[0].distribution.forEach((item: any) => {
      distribution[item._id as keyof typeof distribution] = item.count;
    });

    const result = {
      averageRating: Math.round(stats[0].summary[0].averageRating * 10) / 10,
      totalReviews: stats[0].summary[0].totalReviews,
      ratingDistribution: distribution,
    };

    // Cache for 5 minutes
    cacheService.set(cacheKey, result, 300000);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Get restaurant ratings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Add restaurant response to review (Admin only)
// @route   POST /api/reviews/:id/response
// @access  Protected (Admin)
export const addRestaurantResponse = async (req: Request, res: Response): Promise<void> => {
  try {
    const { text } = req.body;
    const adminId = req.admin?._id;

    if (!adminId) {
      res.status(401).json({
        success: false,
        message: 'Admin authentication required',
      });
      return;
    }

    const review = await Review.findOne({
      _id: req.params.id,
      restaurantId: req.restaurantId,
    });

    if (!review) {
      res.status(404).json({
        success: false,
        message: 'Review not found',
      });
      return;
    }

    review.response = {
      text,
      respondedAt: new Date(),
      respondedBy: adminId,
    };

    await review.save();

    // Invalidate cache
    const restaurantIdStr = req.restaurantId!.toString();
    cacheService.deletePattern(CacheKeys.reviewPattern(restaurantIdStr));

    const populatedReview = await Review.findById(review._id)
      .populate('menuItemId', 'name image')
      .populate('orderId', 'orderNumber')
      .populate('response.respondedBy', 'name')
      .lean()
      .exec();

    res.status(200).json({
      success: true,
      data: populatedReview,
    });
  } catch (error: any) {
    console.error('Add restaurant response error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Toggle review visibility (Admin only)
// @route   PATCH /api/reviews/:id/visibility
// @access  Protected (Admin)
export const toggleReviewVisibility = async (req: Request, res: Response): Promise<void> => {
  try {
    const { isVisible } = req.body;

    const review = await Review.findOne({
      _id: req.params.id,
      restaurantId: req.restaurantId,
    });

    if (!review) {
      res.status(404).json({
        success: false,
        message: 'Review not found',
      });
      return;
    }

    review.isVisible = isVisible;
    await review.save();

    // Invalidate cache
    const restaurantIdStr = req.restaurantId!.toString();
    if (review.menuItemId) {
      cacheService.deletePattern(
        CacheKeys.reviewItemPattern(restaurantIdStr, review.menuItemId.toString())
      );
      updateMenuItemRating(review.menuItemId).catch((error) =>
        console.error('Error updating menu item rating:', error)
      );
    } else {
      cacheService.deletePattern(CacheKeys.reviewPattern(restaurantIdStr));
    }

    res.status(200).json({
      success: true,
      data: review,
    });
  } catch (error: any) {
    console.error('Toggle review visibility error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};
