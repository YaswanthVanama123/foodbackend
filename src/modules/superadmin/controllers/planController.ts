import { Request, Response } from 'express';
import Plan from '../../common/models/Plan';
import cacheService, { CacheKeys } from '../../common/services/cacheService';
import { seedPlansViaAPI } from '../../../scripts/seedPlansViaAPI';

// Cache TTL constants (in milliseconds)
const PLAN_CACHE_TTL = 3600000; // 1 hour - plans rarely change

// @desc    Seed default plans (Dev/Admin only)
// @route   POST /api/superadmin/plans/seed
// @access  Private (Super Admin)
export const seedPlans = async (_req: Request, res: Response): Promise<void> => {
  try {
    console.log('🌱 Seeding plans via API...');
    const result = await seedPlansViaAPI();

    // Invalidate all plan caches
    cacheService.deletePattern(CacheKeys.planPattern());

    res.status(200).json({
      success: true,
      message: result.message,
      data: result.plans,
    });
  } catch (error: any) {
    console.error('Seed plans error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to seed plans',
      error: error.message,
    });
  }
};

// @desc    Get all plans (active and inactive)
// @route   GET /api/superadmin/plans
// @access  Private (Super Admin)
export const getAllPlans = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      isActive,
      sortBy = 'displayOrder',
      sortOrder = 'asc',
    } = req.query;

    // Build filter
    const filter: any = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    // Create cache key from filters
    const cacheKey = CacheKeys.planList({ page, limit, search, isActive, sortBy, sortOrder });

    // Try to get from cache
    const cachedData = cacheService.get<any>(cacheKey);
    if (cachedData) {
      res.status(200).json(cachedData);
      return;
    }

    // Pagination
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Sort
    const sort: any = {};
    sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

    // Query with .lean() for performance
    const [plans, total] = await Promise.all([
      Plan.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean()
        .exec(),
      Plan.countDocuments(filter).exec(),
    ]);

    const response = {
      success: true,
      data: {
        plans,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(total / limitNum),
        },
      },
    };

    // Cache the response
    cacheService.set(cacheKey, response, PLAN_CACHE_TTL);

    res.status(200).json(response);
  } catch (error: any) {
    console.error('Get all plans error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get plan by ID
// @route   GET /api/superadmin/plans/:id
// @access  Private (Super Admin)
export const getPlanById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const cacheKey = CacheKeys.planById(id);

    // Try to get from cache
    const cachedPlan = cacheService.get<any>(cacheKey);
    if (cachedPlan) {
      res.status(200).json(cachedPlan);
      return;
    }

    // Query with .lean() for performance
    const plan = await Plan.findById(id).lean().exec();

    if (!plan) {
      res.status(404).json({
        success: false,
        message: 'Plan not found',
      });
      return;
    }

    const response = {
      success: true,
      data: plan,
    };

    // Cache the response
    cacheService.set(cacheKey, response, PLAN_CACHE_TTL);

    res.status(200).json(response);
  } catch (error: any) {
    console.error('Get plan by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Create new plan
// @route   POST /api/superadmin/plans
// @access  Private (Super Admin)
export const createPlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      name,
      description,
      price,
      currency,
      billingCycle,
      features,
      limits,
      isActive,
      displayOrder,
    } = req.body;

    // Validation
    if (!name || !description || price === undefined || !billingCycle || !features || !limits) {
      res.status(400).json({
        success: false,
        message: 'Name, description, price, billingCycle, features, and limits are required',
      });
      return;
    }

    // Check if plan with same name already exists (use .lean() for performance)
    const existingPlan = await Plan.findOne({ name }).lean().exec();

    if (existingPlan) {
      res.status(400).json({
        success: false,
        message: `Plan with name '${name}' already exists`,
      });
      return;
    }

    // Validate limits structure
    if (!limits.maxTables || !limits.maxMenuItems || !limits.maxAdmins || limits.maxOrders === undefined) {
      res.status(400).json({
        success: false,
        message: 'Limits must include maxTables, maxMenuItems, maxAdmins, and maxOrders',
      });
      return;
    }

    // Validate features array
    if (!Array.isArray(features) || features.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Features must be a non-empty array',
      });
      return;
    }

    // Create plan
    const plan = await Plan.create({
      name,
      description,
      price,
      currency: currency || 'USD',
      billingCycle,
      features,
      limits: {
        maxTables: limits.maxTables,
        maxMenuItems: limits.maxMenuItems,
        maxAdmins: limits.maxAdmins,
        maxOrders: limits.maxOrders,
      },
      isActive: isActive !== undefined ? isActive : true,
      displayOrder: displayOrder !== undefined ? displayOrder : 0,
    });

    // Invalidate all plan caches
    cacheService.deletePattern(CacheKeys.planPattern());

    res.status(201).json({
      success: true,
      data: plan,
      message: 'Plan created successfully',
    });
  } catch (error: any) {
    console.error('Create plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Update plan
// @route   PUT /api/superadmin/plans/:id
// @access  Private (Super Admin)
export const updatePlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if plan exists (use .lean() for performance)
    const existingPlan = await Plan.findById(id).lean().exec();

    if (!existingPlan) {
      res.status(404).json({
        success: false,
        message: 'Plan not found',
      });
      return;
    }

    // If name is being changed, check if new name already exists
    if (updateData.name && updateData.name !== existingPlan.name) {
      const duplicatePlan = await Plan.findOne({ name: updateData.name, _id: { $ne: id } }).lean().exec();

      if (duplicatePlan) {
        res.status(400).json({
          success: false,
          message: `Plan with name '${updateData.name}' already exists`,
        });
        return;
      }
    }

    // Validate features if provided
    if (updateData.features && (!Array.isArray(updateData.features) || updateData.features.length === 0)) {
      res.status(400).json({
        success: false,
        message: 'Features must be a non-empty array',
      });
      return;
    }

    // Update plan
    const plan = await Plan.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).exec();

    // Invalidate all plan caches
    cacheService.deletePattern(CacheKeys.planPattern());

    res.status(200).json({
      success: true,
      data: plan,
      message: 'Plan updated successfully',
    });
  } catch (error: any) {
    console.error('Update plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Delete plan
// @route   DELETE /api/superadmin/plans/:id
// @access  Private (Super Admin)
export const deletePlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const plan = await Plan.findById(id).exec();

    if (!plan) {
      res.status(404).json({
        success: false,
        message: 'Plan not found',
      });
      return;
    }

    // Delete plan
    await plan.deleteOne();

    // Invalidate all plan caches
    cacheService.deletePattern(CacheKeys.planPattern());

    res.status(200).json({
      success: true,
      message: 'Plan deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Toggle plan active status
// @route   PATCH /api/superadmin/plans/:id/status
// @access  Private (Super Admin)
export const togglePlanStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      res.status(400).json({
        success: false,
        message: 'isActive must be a boolean value',
      });
      return;
    }

    const plan = await Plan.findByIdAndUpdate(
      id,
      { isActive },
      { new: true }
    ).exec();

    if (!plan) {
      res.status(404).json({
        success: false,
        message: 'Plan not found',
      });
      return;
    }

    // Invalidate all plan caches
    cacheService.deletePattern(CacheKeys.planPattern());

    res.status(200).json({
      success: true,
      data: plan,
      message: `Plan ${isActive ? 'activated' : 'deactivated'} successfully`,
    });
  } catch (error: any) {
    console.error('Toggle plan status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};
