import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import SuperAdmin from '../../common/models/SuperAdmin';
import Restaurant from '../../common/models/Restaurant';
import Admin from '../../common/models/Admin';
import Order from '../../common/models/Order';
import MenuItem from '../../common/models/MenuItem';
import Table from '../../common/models/Table';
import Category from '../../common/models/Category';
import { jwtConfig } from '../../common/config/jwt';
import { getSocketService } from '../../common/services/socketService';

// Generate JWT token for super admin
const generateSuperAdminToken = (superAdminId: string): string => {
  return jwt.sign(
    {
      id: superAdminId,
      type: 'super_admin',
    },
    jwtConfig.secret,
    {
      expiresIn: jwtConfig.accessTokenExpire,
    } as any
  );
};

// @desc    Super admin registration (temporary - for initial setup)
// @route   POST /api/super-admin/auth/register
// @access  Public
export const superAdminRegister = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password, email, firstName, lastName } = req.body;

    // Validation
    if (!username || !password || !email) {
      res.status(400).json({
        success: false,
        message: 'Please provide username, password, and email',
      });
      return;
    }

    // Check if super admin already exists
    const existingByUsername = await SuperAdmin.findOne({ username });
    if (existingByUsername) {
      res.status(400).json({
        success: false,
        message: 'Username already exists',
      });
      return;
    }

    const existingByEmail = await SuperAdmin.findOne({ email });
    if (existingByEmail) {
      res.status(400).json({
        success: false,
        message: 'Email already exists',
      });
      return;
    }

    // Create super admin
    const superAdmin = await SuperAdmin.create({
      username,
      password, // Will be hashed by pre-save hook
      email,
      firstName: firstName || '',
      lastName: lastName || '',
      isActive: true,
    });

    // Generate token
    const token = generateSuperAdminToken(superAdmin._id.toString());

    res.status(201).json({
      success: true,
      data: {
        superAdmin: {
          _id: superAdmin._id,
          username: superAdmin.username,
          email: superAdmin.email,
          firstName: superAdmin.firstName,
          lastName: superAdmin.lastName,
        },
        token,
      },
    });
  } catch (error: any) {
    console.error('Error registering super admin:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error registering super admin',
    });
  }
};

// @desc    Super admin login
// @route   POST /api/super-admin/auth/login
// @access  Public
export const superAdminLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({
        success: false,
        message: 'Please provide username and password',
      });
      return;
    }

    // Find super admin
    const superAdmin = await SuperAdmin.findOne({ username }).select('+password');

    if (!superAdmin) {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
      return;
    }

    // Check if super admin is active
    if (!superAdmin.isActive) {
      res.status(403).json({
        success: false,
        message: 'Account is inactive',
      });
      return;
    }

    // Check password
    const isPasswordMatch = await superAdmin.comparePassword(password);

    if (!isPasswordMatch) {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
      return;
    }

    // Generate token
    const token = generateSuperAdminToken(superAdmin._id.toString());

    // Update last login
    superAdmin.lastLoginAt = new Date();
    await superAdmin.save();

    // Remove password from response
    const superAdminData = superAdmin.toObject();
    const { password: _, ...superAdminWithoutPassword } = superAdminData;

    res.status(200).json({
      success: true,
      data: {
        superAdmin: superAdminWithoutPassword,
        token,
      },
    });
  } catch (error: any) {
    console.error('Super admin login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get current super admin
// @route   GET /api/super-admin/auth/me
// @access  Private (Super Admin)
export const getCurrentSuperAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    // req.superAdminId is set by superAdminAuth middleware
    const superAdminId = (req as any).superAdminId;

    if (!superAdminId) {
      res.status(401).json({
        success: false,
        message: 'Not authenticated',
      });
      return;
    }

    // Find super admin
    const superAdmin = await SuperAdmin.findById(superAdminId);

    if (!superAdmin) {
      res.status(404).json({
        success: false,
        message: 'Super admin not found',
      });
      return;
    }

    // Check if super admin is active
    if (!superAdmin.isActive) {
      res.status(403).json({
        success: false,
        message: 'Account is inactive',
      });
      return;
    }

    // Remove password from response
    const superAdminData = superAdmin.toObject();
    const { password: _, ...superAdminWithoutPassword } = superAdminData;

    res.status(200).json({
      success: true,
      data: superAdminWithoutPassword,
    });
  } catch (error: any) {
    console.error('Get current super admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get all restaurants with pagination and filters
// @route   GET /api/super-admin/restaurants
// @access  Private (Super Admin)
export const getRestaurants = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      status,
      subscriptionStatus,
      plan,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    // Build filter
    const filter: any = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { subdomain: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    if (status) {
      filter.isActive = status === 'active';
    }

    if (subscriptionStatus) {
      filter['subscription.status'] = subscriptionStatus;
    }

    if (plan) {
      filter['subscription.plan'] = plan;
    }

    // Pagination
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Sort
    const sort: any = {};
    sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

    // Query
    const [restaurants, total] = await Promise.all([
      Restaurant.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Restaurant.countDocuments(filter),
    ]);

    // Get stats for each restaurant
    const restaurantsWithStats = await Promise.all(
      restaurants.map(async (restaurant) => {
        const [adminCount, orderCount, menuItemCount] = await Promise.all([
          Admin.countDocuments({ restaurantId: restaurant._id }),
          Order.countDocuments({ restaurantId: restaurant._id }),
          MenuItem.countDocuments({ restaurantId: restaurant._id }),
        ]);

        return {
          ...restaurant,
          stats: {
            adminCount,
            orderCount,
            menuItemCount,
          },
        };
      })
    );

    res.status(200).json({
      success: true,
      data: {
        restaurants: restaurantsWithStats,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error: any) {
    console.error('Get restaurants error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Create new restaurant
// @route   POST /api/super-admin/restaurants
// @access  Private (Super Admin)
export const createRestaurant = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      subdomain,
      name,
      email,
      phone,
      address,
      branding,
      settings,
      subscription,
    } = req.body;

    // Validation
    if (!subdomain || !name || !email) {
      res.status(400).json({
        success: false,
        message: 'Subdomain, name, and email are required',
      });
      return;
    }

    // Validate subdomain format (alphanumeric and hyphens only)
    const subdomainRegex = /^[a-z0-9-]+$/;
    if (!subdomainRegex.test(subdomain.toLowerCase())) {
      res.status(400).json({
        success: false,
        message: 'Subdomain can only contain lowercase letters, numbers, and hyphens',
      });
      return;
    }

    // Check if subdomain already exists
    const existingRestaurant = await Restaurant.findOne({
      subdomain: subdomain.toLowerCase(),
    });

    if (existingRestaurant) {
      res.status(400).json({
        success: false,
        message: 'Subdomain already taken',
      });
      return;
    }

    // Create slug from name
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    // Create restaurant with defaults
    const restaurant = await Restaurant.create({
      subdomain: subdomain.toLowerCase(),
      name,
      slug,
      email,
      phone: phone || '',
      address: address || {
        street: '',
        city: '',
        state: '',
        zipCode: '',
        country: 'US',
      },
      branding: branding || {
        logo: {
          original: '',
          medium: '',
          small: '',
        },
        primaryColor: '#1F2937',
        secondaryColor: '#F59E0B',
        accentColor: '#10B981',
        fontFamily: 'Inter',
        theme: 'light',
      },
      settings: settings || {
        currency: 'USD',
        taxRate: 8.5,
        serviceChargeRate: 0,
        timezone: 'America/New_York',
        locale: 'en-US',
        orderNumberPrefix: 'ORD',
      },
      subscription: subscription || {
        plan: 'trial',
        status: 'active',
        startDate: new Date(),
        endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days trial
        billingCycle: 'monthly',
        maxTables: 20,
        maxMenuItems: 100,
        maxAdmins: 3,
      },
      isActive: true,
      isOnboarded: false,
      onboardingStep: 0,
      createdBy: req.superAdmin!._id,
    });

    res.status(201).json({
      success: true,
      data: restaurant,
      message: 'Restaurant created successfully',
    });
  } catch (error: any) {
    console.error('Create restaurant error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get restaurant by ID with detailed stats
// @route   GET /api/super-admin/restaurants/:id
// @access  Private (Super Admin)
export const getRestaurantById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const restaurant = await Restaurant.findById(id).lean();

    if (!restaurant) {
      res.status(404).json({
        success: false,
        message: 'Restaurant not found',
      });
      return;
    }

    // Get detailed stats
    const [
      adminCount,
      orderCount,
      menuItemCount,
      categoryCount,
      tableCount,
      recentOrders,
      admins,
    ] = await Promise.all([
      Admin.countDocuments({ restaurantId: restaurant._id }),
      Order.countDocuments({ restaurantId: restaurant._id }),
      MenuItem.countDocuments({ restaurantId: restaurant._id }),
      Category.countDocuments({ restaurantId: restaurant._id }),
      Table.countDocuments({ restaurantId: restaurant._id }),
      Order.find({ restaurantId: restaurant._id })
        .sort({ createdAt: -1 })
        .limit(10)
        .select('orderNumber status totalAmount createdAt')
        .lean(),
      Admin.find({ restaurantId: restaurant._id })
        .select('-password')
        .lean(),
    ]);

    // Calculate revenue stats
    const revenueStats = await Order.aggregate([
      {
        $match: {
          restaurantId: restaurant._id,
          status: { $in: ['completed', 'delivered'] },
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          averageOrderValue: { $avg: '$totalAmount' },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        restaurant,
        stats: {
          adminCount,
          orderCount,
          menuItemCount,
          categoryCount,
          tableCount,
          totalRevenue: revenueStats[0]?.totalRevenue || 0,
          averageOrderValue: revenueStats[0]?.averageOrderValue || 0,
        },
        recentOrders,
        admins,
      },
    });
  } catch (error: any) {
    console.error('Get restaurant by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Update restaurant
// @route   PUT /api/super-admin/restaurants/:id
// @access  Private (Super Admin)
export const updateRestaurant = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Don't allow subdomain change (would break existing links)
    if (updateData.subdomain) {
      delete updateData.subdomain;
    }

    const restaurant = await Restaurant.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!restaurant) {
      res.status(404).json({
        success: false,
        message: 'Restaurant not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: restaurant,
      message: 'Restaurant updated successfully',
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

// @desc    Update restaurant status (active/inactive/suspended)
// @route   PATCH /api/super-admin/restaurants/:id/status
// @access  Private (Super Admin)
export const toggleRestaurantStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validate status
    if (!status) {
      res.status(400).json({
        success: false,
        message: 'Status is required',
      });
      return;
    }

    // Validate status values
    const validStatuses = ['active', 'inactive', 'suspended'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
      return;
    }

    // Map status to database fields
    const updateData: any = {};

    if (status === 'active') {
      updateData.isActive = true;
      updateData['subscription.status'] = 'active';
    } else if (status === 'inactive') {
      updateData.isActive = false;
    } else if (status === 'suspended') {
      updateData.isActive = false;
      updateData['subscription.status'] = 'suspended';
    }

    const restaurant = await Restaurant.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    );

    if (!restaurant) {
      res.status(404).json({
        success: false,
        message: 'Restaurant not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: restaurant,
      message: `Restaurant status updated to ${status} successfully`,
    });
  } catch (error: any) {
    console.error('Update restaurant status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Delete restaurant and all associated data
// @route   DELETE /api/super-admin/restaurants/:id
// @access  Private (Super Admin)
export const deleteRestaurant = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const restaurant = await Restaurant.findById(id);

    if (!restaurant) {
      res.status(404).json({
        success: false,
        message: 'Restaurant not found',
      });
      return;
    }

    // Delete all associated data (CASCADE DELETE)
    await Promise.all([
      Admin.deleteMany({ restaurantId: id }),
      Category.deleteMany({ restaurantId: id }),
      MenuItem.deleteMany({ restaurantId: id }),
      Table.deleteMany({ restaurantId: id }),
      Order.deleteMany({ restaurantId: id }),
    ]);

    // Close Socket.io namespace
    try {
      const socketService = getSocketService();
      socketService.closeRestaurantNamespace(id);
    } catch (error) {
      console.error('Error closing socket namespace:', error);
    }

    // Delete restaurant
    await restaurant.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Restaurant and all associated data deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete restaurant error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Create admin for a restaurant
// @route   POST /api/super-admin/restaurants/:restaurantId/admins
// @access  Private (Super Admin)
export const createRestaurantAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    // Accept restaurantId from either params (for /restaurants/:id/admins) or body (for /admins)
    const restaurantId = req.params.restaurantId || req.body.restaurantId;
    const { username, email, password, firstName, lastName, role, permissions } = req.body;

    // Validate restaurantId
    if (!restaurantId) {
      res.status(400).json({
        success: false,
        message: 'Restaurant ID is required',
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

    // Check admin limit
    const adminCount = await Admin.countDocuments({ restaurantId });
    if (adminCount >= restaurant.subscription.maxAdmins) {
      res.status(400).json({
        success: false,
        message: `Restaurant has reached maximum admin limit (${restaurant.subscription.maxAdmins})`,
      });
      return;
    }

    // Validation
    if (!username || !email || !password) {
      res.status(400).json({
        success: false,
        message: 'Username, email, and password are required',
      });
      return;
    }

    // Check if username exists for this restaurant
    const existingAdmin = await Admin.findOne({
      restaurantId,
      $or: [{ username }, { email }],
    });

    if (existingAdmin) {
      res.status(400).json({
        success: false,
        message: 'Username or email already exists for this restaurant',
      });
      return;
    }

    // Create admin
    const admin = await Admin.create({
      restaurantId,
      username,
      email,
      password,
      firstName: firstName || '',
      lastName: lastName || '',
      role: role || 'admin',
      permissions: permissions || [],
      isActive: true,
    });

    // Remove password from response
    const adminData = admin.toObject();
    const { password: _, ...adminWithoutPassword } = adminData;

    res.status(201).json({
      success: true,
      data: adminWithoutPassword,
      message: 'Admin created successfully',
    });
  } catch (error: any) {
    console.error('Create restaurant admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get admins for a restaurant
// @route   GET /api/super-admin/restaurants/:restaurantId/admins
// @access  Private (Super Admin)
export const getRestaurantAdmins = async (req: Request, res: Response): Promise<void> => {
  try {
    const { restaurantId } = req.params;

    // Validate restaurant exists
    const restaurant = await Restaurant.findById(restaurantId);

    if (!restaurant) {
      res.status(404).json({
        success: false,
        message: 'Restaurant not found',
      });
      return;
    }

    // Get admins
    const admins = await Admin.find({ restaurantId })
      .select('-password')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: {
        restaurant: {
          _id: restaurant._id,
          name: restaurant.name,
          subdomain: restaurant.subdomain,
        },
        admins,
        count: admins.length,
        maxAdmins: restaurant.subscription.maxAdmins,
      },
    });
  } catch (error: any) {
    console.error('Get restaurant admins error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get global platform analytics
// @route   GET /api/super-admin/analytics/global
// @access  Private (Super Admin)
export const getGlobalAnalytics = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [
      totalRestaurants,
      activeRestaurants,
      totalAdmins,
      totalOrders,
      totalMenuItems,
      restaurantsByPlan,
      restaurantsByStatus,
      recentRestaurants,
    ] = await Promise.all([
      Restaurant.countDocuments(),
      Restaurant.countDocuments({ isActive: true, 'subscription.status': 'active' }),
      Admin.countDocuments(),
      Order.countDocuments(),
      MenuItem.countDocuments(),
      Restaurant.aggregate([
        { $group: { _id: '$subscription.plan', count: { $sum: 1 } } },
      ]),
      Restaurant.aggregate([
        { $group: { _id: '$subscription.status', count: { $sum: 1 } } },
      ]),
      Restaurant.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .select('name subdomain isActive subscription.plan subscription.status createdAt')
        .lean(),
    ]);

    // Calculate total revenue across all restaurants
    const revenueStats = await Order.aggregate([
      {
        $match: {
          status: { $in: ['completed', 'delivered'] },
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          averageOrderValue: { $avg: '$totalAmount' },
        },
      },
    ]);

    // Orders by status
    const ordersByStatus = await Order.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalRestaurants,
          activeRestaurants,
          totalAdmins,
          totalOrders,
          totalMenuItems,
          totalRevenue: revenueStats[0]?.totalRevenue || 0,
          averageOrderValue: revenueStats[0]?.averageOrderValue || 0,
        },
        restaurantsByPlan: restaurantsByPlan.reduce((acc: any, item: any) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        restaurantsByStatus: restaurantsByStatus.reduce((acc: any, item: any) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        ordersByStatus: ordersByStatus.reduce((acc: any, item: any) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        recentRestaurants,
      },
    });
  } catch (error: any) {
    console.error('Get global analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get all admins across all restaurants
// @route   GET /api/super-admin/admins
// @access  Private (Super Admin)
export const getAllAdmins = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      restaurantId,
      role,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    // Build filter
    const filter: any = {};

    if (search) {
      filter.$or = [
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
      ];
    }

    if (restaurantId) {
      filter.restaurantId = restaurantId;
    }

    if (role) {
      filter.role = role;
    }

    if (status) {
      filter.isActive = status === 'active';
    }

    // Pagination
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Sort
    const sort: any = {};
    sort[sortBy as string] = sortOrder === 'desc' ? -1 : 1;

    // Query with restaurant population
    const [admins, total] = await Promise.all([
      Admin.find(filter)
        .select('-password')
        .populate('restaurantId', 'name subdomain')
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Admin.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: {
        admins,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error: any) {
    console.error('Get all admins error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get admin by ID
// @route   GET /api/super-admin/admins/:id
// @access  Private (Super Admin)
export const getAdminById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const admin = await Admin.findById(id)
      .select('-password')
      .populate('restaurantId', 'name subdomain email phone')
      .lean();

    if (!admin) {
      res.status(404).json({
        success: false,
        message: 'Admin not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: admin,
    });
  } catch (error: any) {
    console.error('Get admin by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Update admin
// @route   PUT /api/super-admin/admins/:id
// @access  Private (Super Admin)
export const updateAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Don't allow password update through this endpoint
    if (updateData.password) {
      delete updateData.password;
    }

    // Don't allow restaurantId change
    if (updateData.restaurantId) {
      delete updateData.restaurantId;
    }

    const admin = await Admin.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password');

    if (!admin) {
      res.status(404).json({
        success: false,
        message: 'Admin not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: admin,
      message: 'Admin updated successfully',
    });
  } catch (error: any) {
    console.error('Update admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Delete admin
// @route   DELETE /api/super-admin/admins/:id
// @access  Private (Super Admin)
export const deleteAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const admin = await Admin.findById(id);

    if (!admin) {
      res.status(404).json({
        success: false,
        message: 'Admin not found',
      });
      return;
    }

    await admin.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Admin deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete admin error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Toggle admin status
// @route   PATCH /api/super-admin/admins/:id/status
// @access  Private (Super Admin)
export const toggleAdminStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      res.status(400).json({
        success: false,
        message: 'isActive must be a boolean',
      });
      return;
    }

    const admin = await Admin.findByIdAndUpdate(
      id,
      { $set: { isActive } },
      { new: true }
    ).select('-password');

    if (!admin) {
      res.status(404).json({
        success: false,
        message: 'Admin not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: admin,
      message: `Admin ${isActive ? 'activated' : 'deactivated'} successfully`,
    });
  } catch (error: any) {
    console.error('Toggle admin status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Reset admin password
// @route   POST /api/super-admin/admins/:id/reset-password
// @access  Private (Super Admin)
export const resetAdminPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters',
      });
      return;
    }

    const admin = await Admin.findById(id);

    if (!admin) {
      res.status(404).json({
        success: false,
        message: 'Admin not found',
      });
      return;
    }

    // Update password (will be hashed by pre-save hook)
    admin.password = newPassword;
    await admin.save();

    res.status(200).json({
      success: true,
      message: 'Password reset successfully',
    });
  } catch (error: any) {
    console.error('Reset admin password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};
