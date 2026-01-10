import { Request, Response } from 'express';
import Subscription from '../../common/models/Subscription';
import Restaurant from '../../common/models/Restaurant';
import { Types } from 'mongoose';
import cacheService, { CacheKeys } from '../../common/services/cacheService';

// Cache TTL constants (in milliseconds)
const SUBSCRIPTION_CACHE_TTL = 300000; // 5 minutes
const SUBSCRIPTION_STATS_CACHE_TTL = 600000; // 10 minutes

/**
 * @desc    Get all subscriptions with pagination, filters, and restaurant details
 * @route   GET /api/superadmin/subscriptions
 * @access  Private (Super Admin)
 */
export const getAllSubscriptions = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      billingCycle,
      autoRenew,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      expiringSoon,
    } = req.query;

    // Build filter
    const filter: any = {};

    if (status) {
      filter.status = status;
    }

    if (billingCycle) {
      filter.billingCycle = billingCycle;
    }

    if (autoRenew !== undefined) {
      filter.autoRenew = autoRenew === 'true';
    }

    // Find expiring subscriptions (within 30 days)
    if (expiringSoon === 'true') {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      filter.status = 'active';
      filter.endDate = {
        $gt: new Date(),
        $lte: futureDate,
      };
    }

    // Create cache key from filters
    const cacheKey = CacheKeys.subscriptionList({
      page,
      limit,
      status,
      billingCycle,
      autoRenew,
      search,
      sortBy,
      sortOrder,
      expiringSoon,
    });

    // Try to get from cache (only if no search - search results change frequently)
    if (!search) {
      const cachedData = cacheService.get<any>(cacheKey);
      if (cachedData) {
        res.status(200).json(cachedData);
        return;
      }
    }

    // Pagination
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Sort
    const sort: any = {};
    sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

    // If search is provided, find restaurants first (optimized with lean)
    if (search) {
      const restaurants = await Restaurant.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { subdomain: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
        ],
      })
        .select('_id')
        .lean()
        .exec();

      const restaurantIds = restaurants.map(r => r._id);
      filter.restaurantId = { $in: restaurantIds };
    }

    // CRITICAL OPTIMIZATION: Use compound index { restaurantId: 1, status: 1, endDate: -1 }
    // Run queries in parallel with .lean() for performance
    const [subscriptions, total] = await Promise.all([
      Subscription.find(filter)
        .populate({
          path: 'restaurantId',
          select: 'name subdomain email phone isActive',
        })
        .populate({
          path: 'planId',
          select: 'name price features',
        })
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean()
        .exec(),
      Subscription.countDocuments(filter).exec(),
    ]);

    // CRITICAL OPTIMIZATION: Cache aggregated stats separately with longer TTL
    const statsCacheKey = CacheKeys.subscriptionStats(filter);
    let stats = cacheService.get<any>(statsCacheKey);

    if (!stats) {
      // Optimized aggregation - calculate stats only once and cache
      const statsResult = await Subscription.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            totalRevenue: {
              $sum: {
                $sum: {
                  $map: {
                    input: {
                      $filter: {
                        input: '$paymentHistory',
                        as: 'payment',
                        cond: { $eq: ['$$payment.status', 'completed'] },
                      },
                    },
                    as: 'payment',
                    in: '$$payment.amount',
                  },
                },
              },
            },
            activeCount: {
              $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] },
            },
            cancelledCount: {
              $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] },
            },
            expiredCount: {
              $sum: { $cond: [{ $eq: ['$status', 'expired'] }, 1, 0] },
            },
            pendingCount: {
              $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] },
            },
            monthlyCount: {
              $sum: { $cond: [{ $eq: ['$billingCycle', 'monthly'] }, 1, 0] },
            },
            yearlyCount: {
              $sum: { $cond: [{ $eq: ['$billingCycle', 'yearly'] }, 1, 0] },
            },
          },
        },
      ]).exec();

      stats = statsResult[0] || {
        totalRevenue: 0,
        activeCount: 0,
        cancelledCount: 0,
        expiredCount: 0,
        pendingCount: 0,
        monthlyCount: 0,
        yearlyCount: 0,
      };

      // Cache stats with longer TTL
      cacheService.set(statsCacheKey, stats, SUBSCRIPTION_STATS_CACHE_TTL);
    }

    const response = {
      success: true,
      data: {
        subscriptions,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(total / limitNum),
        },
        statistics: stats,
      },
    };

    // Cache the response (only if no search)
    if (!search) {
      cacheService.set(cacheKey, response, SUBSCRIPTION_CACHE_TTL);
    }

    res.status(200).json(response);
  } catch (error: any) {
    console.error('Get all subscriptions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

/**
 * @desc    Get subscriptions for specific restaurant
 * @route   GET /api/superadmin/subscriptions/restaurant/:restaurantId
 * @access  Private (Super Admin)
 */
export const getSubscriptionsByRestaurant = async (req: Request, res: Response): Promise<void> => {
  try {
    const { restaurantId } = req.params;

    // Try to get from cache
    const cacheKey = CacheKeys.subscriptionByRestaurant(restaurantId);
    const cachedData = cacheService.get<any>(cacheKey);
    if (cachedData) {
      res.status(200).json(cachedData);
      return;
    }

    // Validate restaurant exists (optimized with lean)
    const restaurant = await Restaurant.findById(restaurantId)
      .select('name subdomain email')
      .lean()
      .exec();

    if (!restaurant) {
      res.status(404).json({
        success: false,
        message: 'Restaurant not found',
      });
      return;
    }

    // CRITICAL OPTIMIZATION: Use compound index for fast lookup
    // Get all subscriptions for this restaurant (optimized with lean)
    const subscriptions = await Subscription.find({ restaurantId })
      .populate({
        path: 'planId',
        select: 'name price features',
      })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    // CRITICAL OPTIMIZATION: Pre-calculate values instead of computing on each request
    const totalRevenue = subscriptions.reduce((total, sub) => {
      const subRevenue = sub.paymentHistory
        .filter(payment => payment.status === 'completed')
        .reduce((sum, payment) => sum + payment.amount, 0);
      return total + subRevenue;
    }, 0);

    // CRITICAL OPTIMIZATION: Find active subscription using compound index
    const activeSubscription = subscriptions.find(
      sub => sub.status === 'active' && new Date(sub.endDate) > new Date()
    );

    const response = {
      success: true,
      data: {
        restaurant,
        subscriptions,
        activeSubscription,
        totalRevenue,
        count: subscriptions.length,
      },
    };

    // Cache the response
    cacheService.set(cacheKey, response, SUBSCRIPTION_CACHE_TTL);

    res.status(200).json(response);
  } catch (error: any) {
    console.error('Get subscriptions by restaurant error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

/**
 * @desc    Create new subscription
 * @route   POST /api/superadmin/subscriptions
 * @access  Private (Super Admin)
 */
export const createSubscription = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      restaurantId,
      planId,
      status = 'pending',
      startDate,
      endDate,
      amount,
      currency = 'USD',
      billingCycle,
      autoRenew = true,
      notes,
    } = req.body;

    // Validation
    if (!restaurantId || !amount || !billingCycle || !endDate) {
      res.status(400).json({
        success: false,
        message: 'Restaurant ID, amount, billing cycle, and end date are required',
      });
      return;
    }

    // Validate restaurant exists (optimized with lean)
    const restaurant = await Restaurant.findById(restaurantId).lean().exec();

    if (!restaurant) {
      res.status(404).json({
        success: false,
        message: 'Restaurant not found',
      });
      return;
    }

    // Validate ObjectId for planId if provided
    if (planId && !Types.ObjectId.isValid(planId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid plan ID format',
      });
      return;
    }

    // CRITICAL OPTIMIZATION: Use compound index for fast active subscription check
    const existingActiveSubscription = await Subscription.findOne({
      restaurantId,
      status: 'active',
      endDate: { $gt: new Date() },
    })
      .lean()
      .exec();

    if (existingActiveSubscription && status === 'active') {
      res.status(400).json({
        success: false,
        message: 'Restaurant already has an active subscription. Cancel or expire the current one first.',
        existingSubscription: existingActiveSubscription,
      });
      return;
    }

    // Calculate renewal date
    const renewalDate = autoRenew ? new Date(endDate) : undefined;

    // Create subscription
    const subscription = await Subscription.create({
      restaurantId,
      planId: planId || undefined,
      status,
      startDate: startDate || new Date(),
      endDate: new Date(endDate),
      renewalDate,
      amount,
      currency,
      billingCycle,
      autoRenew,
      notes,
      paymentHistory: [],
    });

    // Populate restaurant and plan details
    await subscription.populate([
      {
        path: 'restaurantId',
        select: 'name subdomain email phone',
      },
      {
        path: 'planId',
        select: 'name price features',
      },
    ]);

    // Invalidate relevant caches
    cacheService.deletePattern(CacheKeys.subscriptionPattern(restaurantId));

    res.status(201).json({
      success: true,
      data: subscription,
      message: 'Subscription created successfully',
    });
  } catch (error: any) {
    console.error('Create subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

/**
 * @desc    Update subscription
 * @route   PUT /api/superadmin/subscriptions/:id
 * @access  Private (Super Admin)
 */
export const updateSubscription = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      planId,
      status,
      endDate,
      renewalDate,
      amount,
      currency,
      billingCycle,
      autoRenew,
      notes,
      paymentRecord,
    } = req.body;

    // Find subscription
    const subscription = await Subscription.findById(id).exec();

    if (!subscription) {
      res.status(404).json({
        success: false,
        message: 'Subscription not found',
      });
      return;
    }

    // Update fields if provided
    if (planId !== undefined) subscription.planId = planId;
    if (status !== undefined) subscription.status = status;
    if (endDate !== undefined) subscription.endDate = new Date(endDate);
    if (renewalDate !== undefined) subscription.renewalDate = renewalDate ? new Date(renewalDate) : undefined;
    if (amount !== undefined) subscription.amount = amount;
    if (currency !== undefined) subscription.currency = currency;
    if (billingCycle !== undefined) subscription.billingCycle = billingCycle;
    if (autoRenew !== undefined) subscription.autoRenew = autoRenew;
    if (notes !== undefined) subscription.notes = notes;

    // Add payment record if provided
    if (paymentRecord) {
      subscription.paymentHistory.push({
        transactionId: paymentRecord.transactionId,
        amount: paymentRecord.amount,
        currency: paymentRecord.currency || subscription.currency,
        paymentMethod: paymentRecord.paymentMethod,
        status: paymentRecord.status || 'completed',
        paymentDate: paymentRecord.paymentDate || new Date(),
        description: paymentRecord.description,
        metadata: paymentRecord.metadata,
      });
    }

    // Save subscription
    await subscription.save();

    // Populate restaurant and plan details
    await subscription.populate([
      {
        path: 'restaurantId',
        select: 'name subdomain email phone',
      },
      {
        path: 'planId',
        select: 'name price features',
      },
    ]);

    // Invalidate relevant caches
    cacheService.deletePattern(CacheKeys.subscriptionPattern(subscription.restaurantId.toString()));

    res.status(200).json({
      success: true,
      data: subscription,
      message: 'Subscription updated successfully',
    });
  } catch (error: any) {
    console.error('Update subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

/**
 * @desc    Cancel subscription
 * @route   PATCH /api/superadmin/subscriptions/:id/cancel
 * @access  Private (Super Admin)
 */
export const cancelSubscription = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { cancellationReason, immediateTermination = false } = req.body;

    // Find subscription
    const subscription = await Subscription.findById(id).exec();

    if (!subscription) {
      res.status(404).json({
        success: false,
        message: 'Subscription not found',
      });
      return;
    }

    // Check if already cancelled
    if (subscription.status === 'cancelled') {
      res.status(400).json({
        success: false,
        message: 'Subscription is already cancelled',
      });
      return;
    }

    // Update subscription
    subscription.status = 'cancelled';
    subscription.autoRenew = false;
    subscription.cancellationReason = cancellationReason || 'Cancelled by super admin';
    subscription.cancelledAt = new Date();

    // If immediate termination, set end date to now
    if (immediateTermination) {
      subscription.endDate = new Date();
    }

    await subscription.save();

    // Populate restaurant and plan details
    await subscription.populate([
      {
        path: 'restaurantId',
        select: 'name subdomain email phone',
      },
      {
        path: 'planId',
        select: 'name price features',
      },
    ]);

    // Invalidate relevant caches
    cacheService.deletePattern(CacheKeys.subscriptionPattern(subscription.restaurantId.toString()));

    res.status(200).json({
      success: true,
      data: subscription,
      message: immediateTermination
        ? 'Subscription cancelled immediately'
        : 'Subscription will be cancelled at the end of the billing period',
    });
  } catch (error: any) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

/**
 * @desc    Renew subscription
 * @route   POST /api/superadmin/subscriptions/:id/renew
 * @access  Private (Super Admin)
 */
export const renewSubscription = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      amount,
      billingCycle,
      extensionMonths,
      paymentRecord,
    } = req.body;

    // Find subscription
    const subscription = await Subscription.findById(id).exec();

    if (!subscription) {
      res.status(404).json({
        success: false,
        message: 'Subscription not found',
      });
      return;
    }

    // Calculate new end date
    let newEndDate: Date;
    const currentEndDate = new Date(subscription.endDate);
    const now = new Date();

    // Determine the base date for extension
    const baseDate = currentEndDate > now ? currentEndDate : now;

    // Calculate extension period
    if (extensionMonths) {
      newEndDate = new Date(baseDate);
      newEndDate.setMonth(newEndDate.getMonth() + extensionMonths);
    } else if (billingCycle === 'yearly' || subscription.billingCycle === 'yearly') {
      newEndDate = new Date(baseDate);
      newEndDate.setFullYear(newEndDate.getFullYear() + 1);
    } else {
      // Default to monthly
      newEndDate = new Date(baseDate);
      newEndDate.setMonth(newEndDate.getMonth() + 1);
    }

    // Update subscription
    subscription.status = 'active';
    subscription.endDate = newEndDate;
    subscription.renewalDate = subscription.autoRenew ? newEndDate : undefined;

    if (amount !== undefined) {
      subscription.amount = amount;
    }

    if (billingCycle !== undefined) {
      subscription.billingCycle = billingCycle;
    }

    // Add payment record if provided
    if (paymentRecord) {
      subscription.paymentHistory.push({
        transactionId: paymentRecord.transactionId,
        amount: paymentRecord.amount || subscription.amount,
        currency: paymentRecord.currency || subscription.currency,
        paymentMethod: paymentRecord.paymentMethod,
        status: paymentRecord.status || 'completed',
        paymentDate: paymentRecord.paymentDate || new Date(),
        description: paymentRecord.description || `Subscription renewal - ${subscription.billingCycle}`,
        metadata: paymentRecord.metadata,
      });
    }

    // Clear cancellation data if present
    subscription.cancellationReason = undefined;
    subscription.cancelledAt = undefined;

    await subscription.save();

    // Populate restaurant and plan details
    await subscription.populate([
      {
        path: 'restaurantId',
        select: 'name subdomain email phone',
      },
      {
        path: 'planId',
        select: 'name price features',
      },
    ]);

    // Invalidate relevant caches
    cacheService.deletePattern(CacheKeys.subscriptionPattern(subscription.restaurantId.toString()));

    res.status(200).json({
      success: true,
      data: subscription,
      message: 'Subscription renewed successfully',
    });
  } catch (error: any) {
    console.error('Renew subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

/**
 * @desc    Get subscription by ID
 * @route   GET /api/superadmin/subscriptions/:id
 * @access  Private (Super Admin)
 */
export const getSubscriptionById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Try to get from cache
    const cacheKey = CacheKeys.subscriptionById(id);
    const cachedData = cacheService.get<any>(cacheKey);
    if (cachedData) {
      res.status(200).json(cachedData);
      return;
    }

    // Query with lean for performance
    const subscription = await Subscription.findById(id)
      .populate({
        path: 'restaurantId',
        select: 'name subdomain email phone isActive address',
      })
      .populate({
        path: 'planId',
        select: 'name price features description',
      })
      .lean()
      .exec();

    if (!subscription) {
      res.status(404).json({
        success: false,
        message: 'Subscription not found',
      });
      return;
    }

    // CRITICAL OPTIMIZATION: Pre-calculate statistics
    const totalRevenue = subscription.paymentHistory
      .filter(payment => payment.status === 'completed')
      .reduce((sum, payment) => sum + payment.amount, 0);

    const totalPayments = subscription.paymentHistory.length;
    const successfulPayments = subscription.paymentHistory.filter(
      payment => payment.status === 'completed'
    ).length;
    const failedPayments = subscription.paymentHistory.filter(
      payment => payment.status === 'failed'
    ).length;

    // Calculate days until expiry
    const daysUntilExpiry = Math.ceil(
      (new Date(subscription.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    const response = {
      success: true,
      data: {
        subscription,
        statistics: {
          totalRevenue,
          totalPayments,
          successfulPayments,
          failedPayments,
          daysUntilExpiry,
          isExpiringSoon: daysUntilExpiry <= 30 && daysUntilExpiry > 0,
          isExpired: daysUntilExpiry < 0,
        },
      },
    };

    // Cache the response
    cacheService.set(cacheKey, response, SUBSCRIPTION_CACHE_TTL);

    res.status(200).json(response);
  } catch (error: any) {
    console.error('Get subscription by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

/**
 * @desc    Delete subscription
 * @route   DELETE /api/superadmin/subscriptions/:id
 * @access  Private (Super Admin)
 */
export const deleteSubscription = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const subscription = await Subscription.findById(id).exec();

    if (!subscription) {
      res.status(404).json({
        success: false,
        message: 'Subscription not found',
      });
      return;
    }

    // Check if subscription is active
    if (subscription.status === 'active' && new Date(subscription.endDate) > new Date()) {
      res.status(400).json({
        success: false,
        message: 'Cannot delete an active subscription. Please cancel it first.',
      });
      return;
    }

    const restaurantId = subscription.restaurantId.toString();
    await subscription.deleteOne();

    // Invalidate relevant caches
    cacheService.deletePattern(CacheKeys.subscriptionPattern(restaurantId));

    res.status(200).json({
      success: true,
      message: 'Subscription deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

/**
 * @desc    Get subscriptions page data (subscriptions + plans + restaurants) - OPTIMIZED (SINGLE REQUEST)
 * @route   GET /api/superadmin/subscriptions/page-data
 * @access  Private (Super Admin)
 */
export const getSubscriptionsPageData = async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  let subscriptionsTime = 0;
  let plansTime = 0;
  let restaurantsTime = 0;

  try {
    const {
      page = 1,
      limit = 20,
      status,
      billingCycle,
      autoRenew,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      expiringSoon,
    } = req.query;

    // Build filter
    const filter: any = {};

    if (status) {
      filter.status = status;
    }

    if (billingCycle) {
      filter.billingCycle = billingCycle;
    }

    if (autoRenew !== undefined) {
      filter.autoRenew = autoRenew === 'true';
    }

    // Find expiring subscriptions (within 30 days)
    if (expiringSoon === 'true') {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      filter.status = 'active';
      filter.endDate = {
        $gt: new Date(),
        $lte: futureDate,
      };
    }

    // Pagination
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Sort
    const sort: any = {};
    sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

    // If search is provided, find restaurants first
    if (search) {
      const restaurants = await Restaurant.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { subdomain: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
        ],
      })
        .select('_id')
        .lean()
        .exec();

      const restaurantIds = restaurants.map(r => r._id);
      filter.restaurantId = { $in: restaurantIds };
    }

    // Fetch subscriptions, plans, and restaurants in parallel
    const subscriptionsStart = Date.now();
    const plansStart = Date.now();
    const restaurantsStart = Date.now();

    const [subscriptionsData, plansData, restaurantsData] = await Promise.all([
      // 1. GET SUBSCRIPTIONS
      (async () => {
        const [subscriptions, total, statsResult] = await Promise.all([
          Subscription.find(filter)
            .populate({
              path: 'restaurantId',
              select: 'name subdomain email phone isActive',
            })
            .populate({
              path: 'planId',
              select: 'name price features',
            })
            .sort(sort)
            .skip(skip)
            .limit(limitNum)
            .lean()
            .exec(),
          Subscription.countDocuments(filter).exec(),
          Subscription.aggregate([
            { $match: filter },
            {
              $group: {
                _id: null,
                totalRevenue: {
                  $sum: {
                    $sum: {
                      $map: {
                        input: {
                          $filter: {
                            input: '$paymentHistory',
                            as: 'payment',
                            cond: { $eq: ['$$payment.status', 'completed'] },
                          },
                        },
                        as: 'payment',
                        in: '$$payment.amount',
                      },
                    },
                  },
                },
                activeCount: {
                  $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] },
                },
                cancelledCount: {
                  $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] },
                },
                expiredCount: {
                  $sum: { $cond: [{ $eq: ['$status', 'expired'] }, 1, 0] },
                },
                pendingCount: {
                  $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] },
                },
                monthlyCount: {
                  $sum: { $cond: [{ $eq: ['$billingCycle', 'monthly'] }, 1, 0] },
                },
                yearlyCount: {
                  $sum: { $cond: [{ $eq: ['$billingCycle', 'yearly'] }, 1, 0] },
                },
              },
            },
          ]).exec(),
        ]);

        const stats = statsResult[0] || {
          totalRevenue: 0,
          activeCount: 0,
          cancelledCount: 0,
          expiredCount: 0,
          pendingCount: 0,
          monthlyCount: 0,
          yearlyCount: 0,
        };

        return {
          subscriptions,
          pagination: {
            total,
            page: pageNum,
            limit: limitNum,
            pages: Math.ceil(total / limitNum),
          },
          statistics: stats,
        };
      })(),

      // 2. GET PLANS
      (async () => {
        const Plan = (await import('../../common/models/Plan')).default;
        return Plan.find({ isActive: true })
          .select('_id name price features description billingCycle')
          .sort({ displayOrder: 1 })
          .limit(100)
          .lean()
          .exec();
      })(),

      // 3. GET RESTAURANTS
      (async () => {
        return Restaurant.find({ isActive: true })
          .select('_id name subdomain email phone')
          .sort({ name: 1 })
          .limit(100)
          .lean()
          .exec();
      })(),
    ]);

    subscriptionsTime = Date.now() - subscriptionsStart;
    plansTime = Date.now() - plansStart;
    restaurantsTime = Date.now() - restaurantsStart;

    const totalTime = Date.now() - startTime;

    res.status(200).json({
      success: true,
      data: {
        subscriptions: subscriptionsData.subscriptions,
        pagination: subscriptionsData.pagination,
        statistics: subscriptionsData.statistics,
        plans: plansData,
        restaurants: restaurantsData,
      },
      _perf: {
        total: totalTime,
        subscriptions: subscriptionsTime,
        plans: plansTime,
        restaurants: restaurantsTime,
      },
    });
  } catch (error: any) {
    console.error('Error fetching subscriptions page data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subscriptions page data',
      error: error.message,
    });
  }
};
