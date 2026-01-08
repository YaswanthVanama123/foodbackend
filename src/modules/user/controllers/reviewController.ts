import { Request, Response } from 'express';
import Review from '../common/models/Review';
import Order from '../common/models/Order';
import MenuItem from '../common/models/MenuItem';
import mongoose from 'mongoose';
import { updateMenuItemRating } from '../common/utils/ratingUtils';

// @desc    Create review
// @route   POST /api/reviews
// @access  Protected (Customer)
export const createReview = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId, menuItemId, rating, comment } = req.body;
    const customerId = req.customer?._id; // From customer auth middleware

    if (!customerId) {
      res.status(401).json({
        success: false,
        message: 'Customer authentication required',
      });
      return;
    }

    // CRITICAL: Verify order exists and belongs to this restaurant
    const order = await Order.findOne({
      _id: orderId,
      restaurantId: req.restaurantId,
    }).lean().exec();

    if (!order) {
      res.status(404).json({
        success: false,
        message: 'Order not found',
      });
      return;
    }

    // Verify order is completed (served)
    if (order.status !== 'served') {
      res.status(400).json({
        success: false,
        message: 'Can only review completed orders',
      });
      return;
    }

    // If menuItemId provided, verify it exists in the order
    if (menuItemId) {
      const menuItem = await MenuItem.findOne({
        _id: menuItemId,
        restaurantId: req.restaurantId,
      }).lean().exec();

      if (!menuItem) {
        res.status(404).json({
          success: false,
          message: 'Menu item not found',
        });
        return;
      }

      // Verify menu item was in the order
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

    // Check if review already exists
    const existingReview = await Review.findOne({
      restaurantId: req.restaurantId,
      orderId,
      customerId,
      ...(menuItemId ? { menuItemId } : { menuItemId: { $exists: false } }),
    });

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

    // Update menu item rating cache if this is a menu item review
    if (menuItemId) {
      try {
        await updateMenuItemRating(menuItemId);
      } catch (error) {
        console.error('Error updating menu item rating:', error);
        // Don't fail the request if rating update fails
      }
    }

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

// @desc    Get reviews with filters
// @route   GET /api/reviews
// @access  Public
export const getReviews = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      menuItemId,
      orderId,
      customerId,
      minRating,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      order = 'desc',
    } = req.query;

    // CRITICAL: Filter by restaurant
    const filter: any = {
      restaurantId: req.restaurantId,
      isVisible: true, // Only show visible reviews publicly
    };

    if (menuItemId) {
      filter.menuItemId = menuItemId;
    }

    if (orderId) {
      filter.orderId = orderId;
    }

    if (customerId) {
      filter.customerId = customerId;
    }

    if (minRating) {
      filter.rating = { $gte: Number(minRating) };
    }

    const skip = (Number(page) - 1) * Number(limit);
    const sortOrder = order === 'asc' ? 1 : -1;

    const [reviews, total] = await Promise.all([
      Review.find(filter)
        .populate('menuItemId', 'name image price')
        .populate('orderId', 'orderNumber createdAt')
        .sort({ [sortBy as string]: sortOrder })
        .skip(skip)
        .limit(Number(limit))
        .lean()
        .exec(),
      Review.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      count: reviews.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
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

    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    // CRITICAL: Filter by restaurant and customer
    const filter = {
      restaurantId: req.restaurantId,
      customerId,
    };

    const [reviews, total] = await Promise.all([
      Review.find(filter)
        .populate('menuItemId', 'name image price')
        .populate('orderId', 'orderNumber createdAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean()
        .exec(),
      Review.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      count: reviews.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
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
// @access  Protected (Customer - own reviews only)
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

    // CRITICAL: Find review with restaurantId and customerId validation
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

    // Update fields
    if (rating !== undefined) {
      review.rating = rating;
    }
    if (comment !== undefined) {
      review.comment = comment;
    }

    await review.save();

    // Update menu item rating cache if this is a menu item review
    if (review.menuItemId) {
      try {
        await updateMenuItemRating(review.menuItemId);
      } catch (error) {
        console.error('Error updating menu item rating:', error);
        // Don't fail the request if rating update fails
      }
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
// @access  Protected (Customer - own reviews only)
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

    // CRITICAL: Find and delete review with restaurantId and customerId validation
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

    // Update menu item rating cache if this was a menu item review
    if (review.menuItemId) {
      try {
        await updateMenuItemRating(review.menuItemId);
      } catch (error) {
        console.error('Error updating menu item rating:', error);
        // Don't fail the request if rating update fails
      }
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

    // CRITICAL: Find review with restaurantId validation
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

    // Toggle helpful
    const helpfulIndex = review.helpfulBy.indexOf(customerId);

    if (helpfulIndex > -1) {
      // Remove from helpful
      review.helpfulBy.splice(helpfulIndex, 1);
      review.helpfulCount = Math.max(0, review.helpfulCount - 1);
    } else {
      // Add to helpful
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

// @desc    Get menu item ratings summary
// @route   GET /api/reviews/menu-item/:menuItemId/ratings
// @access  Public
export const getMenuItemRatings = async (req: Request, res: Response): Promise<void> => {
  try {
    const { menuItemId } = req.params;

    // Verify menu item exists and belongs to restaurant
    const menuItem = await MenuItem.findOne({
      _id: menuItemId,
      restaurantId: req.restaurantId,
    }).lean().exec();

    if (!menuItem) {
      res.status(404).json({
        success: false,
        message: 'Menu item not found',
      });
      return;
    }

    // CRITICAL: Aggregate ratings for this restaurant and menu item only
    const stats = await Review.aggregate([
      {
        $match: {
          restaurantId: new mongoose.Types.ObjectId(req.restaurantId as string),
          menuItemId: new mongoose.Types.ObjectId(menuItemId),
          isVisible: true,
        },
      },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
          ratingDistribution: {
            $push: '$rating',
          },
        },
      },
    ]);

    if (!stats.length) {
      res.status(200).json({
        success: true,
        data: {
          averageRating: 0,
          totalReviews: 0,
          ratingDistribution: {
            1: 0,
            2: 0,
            3: 0,
            4: 0,
            5: 0,
          },
        },
      });
      return;
    }

    // Calculate rating distribution
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    stats[0].ratingDistribution.forEach((rating: number) => {
      distribution[rating as keyof typeof distribution]++;
    });

    res.status(200).json({
      success: true,
      data: {
        averageRating: Math.round(stats[0].averageRating * 10) / 10,
        totalReviews: stats[0].totalReviews,
        ratingDistribution: distribution,
      },
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

// @desc    Get restaurant ratings summary
// @route   GET /api/reviews/restaurant/ratings
// @access  Public
export const getRestaurantRatings = async (req: Request, res: Response): Promise<void> => {
  try {
    // CRITICAL: Aggregate all ratings for this restaurant only
    const stats = await Review.aggregate([
      {
        $match: {
          restaurantId: new mongoose.Types.ObjectId(req.restaurantId as string),
          isVisible: true,
        },
      },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
          ratingDistribution: {
            $push: '$rating',
          },
        },
      },
    ]);

    if (!stats.length) {
      res.status(200).json({
        success: true,
        data: {
          averageRating: 0,
          totalReviews: 0,
          ratingDistribution: {
            1: 0,
            2: 0,
            3: 0,
            4: 0,
            5: 0,
          },
        },
      });
      return;
    }

    // Calculate rating distribution
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    stats[0].ratingDistribution.forEach((rating: number) => {
      distribution[rating as keyof typeof distribution]++;
    });

    res.status(200).json({
      success: true,
      data: {
        averageRating: Math.round(stats[0].averageRating * 10) / 10,
        totalReviews: stats[0].totalReviews,
        ratingDistribution: distribution,
      },
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

    // CRITICAL: Find review with restaurantId validation
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

    // Add or update response
    review.response = {
      text,
      respondedAt: new Date(),
      respondedBy: adminId,
    };

    await review.save();

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

    // CRITICAL: Find review with restaurantId validation
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

    // Update menu item rating cache if this is a menu item review
    // (visibility change affects rating calculations)
    if (review.menuItemId) {
      try {
        await updateMenuItemRating(review.menuItemId);
      } catch (error) {
        console.error('Error updating menu item rating:', error);
        // Don't fail the request if rating update fails
      }
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
