import { Request, Response } from 'express';
import Subscription from '../common/models/Subscription';
import Restaurant from '../common/models/Restaurant';
import { Types } from 'mongoose';

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

    // Pagination
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Sort
    const sort: any = {};
    sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

    // Query subscriptions with restaurant details
    let query = Subscription.find(filter)
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
      .lean();

    // If search is provided, we need to search in restaurant names
    if (search) {
      const restaurants = await Restaurant.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { subdomain: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
        ],
      }).select('_id').lean();

      const restaurantIds = restaurants.map(r => r._id);
      filter.restaurantId = { $in: restaurantIds };
    }

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
        .lean(),
      Subscription.countDocuments(filter),
    ]);

    // Calculate statistics
    const stats = await Subscription.aggregate([
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
    ]);

    res.status(200).json({
      success: true,
      data: {
        subscriptions,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(total / limitNum),
        },
        statistics: stats[0] || {
          totalRevenue: 0,
          activeCount: 0,
          cancelledCount: 0,
          expiredCount: 0,
          pendingCount: 0,
          monthlyCount: 0,
          yearlyCount: 0,
        },
      },
    });
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

    // Validate restaurant exists
    const restaurant = await Restaurant.findById(restaurantId).select('name subdomain email').lean();

    if (!restaurant) {
      res.status(404).json({
        success: false,
        message: 'Restaurant not found',
      });
      return;
    }

    // Get all subscriptions for this restaurant
    const subscriptions = await Subscription.find({ restaurantId })
      .populate({
        path: 'planId',
        select: 'name price features',
      })
      .sort({ createdAt: -1 })
      .lean();

    // Calculate total revenue for this restaurant
    const totalRevenue = subscriptions.reduce((total, sub) => {
      const subRevenue = sub.paymentHistory
        .filter(payment => payment.status === 'completed')
        .reduce((sum, payment) => sum + payment.amount, 0);
      return total + subRevenue;
    }, 0);

    // Get active subscription
    const activeSubscription = subscriptions.find(
      sub => sub.status === 'active' && new Date(sub.endDate) > new Date()
    );

    res.status(200).json({
      success: true,
      data: {
        restaurant,
        subscriptions,
        activeSubscription,
        totalRevenue,
        count: subscriptions.length,
      },
    });
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

    // Validate restaurant exists
    const restaurant = await Restaurant.findById(restaurantId);

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

    // Check if there's already an active subscription for this restaurant
    const existingActiveSubscription = await Subscription.findOne({
      restaurantId,
      status: 'active',
      endDate: { $gt: new Date() },
    });

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
    const subscription = await Subscription.findById(id);

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
    const subscription = await Subscription.findById(id);

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
    const subscription = await Subscription.findById(id);

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

    const subscription = await Subscription.findById(id)
      .populate({
        path: 'restaurantId',
        select: 'name subdomain email phone isActive address',
      })
      .populate({
        path: 'planId',
        select: 'name price features description',
      })
      .lean();

    if (!subscription) {
      res.status(404).json({
        success: false,
        message: 'Subscription not found',
      });
      return;
    }

    // Calculate statistics
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

    res.status(200).json({
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
    });
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

    const subscription = await Subscription.findById(id);

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

    await subscription.deleteOne();

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
