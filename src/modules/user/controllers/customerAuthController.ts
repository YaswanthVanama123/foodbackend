import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import Customer from '../../common/models/Customer';
import Order from '../../common/models/Order';
import { jwtConfig } from '../../common/config/jwt';

/**
 * Generate JWT token for customer
 */
const generateCustomerToken = (customerId: string, restaurantId: string): string => {
  return jwt.sign(
    {
      id: customerId,
      restaurantId,
      type: 'customer',
    },
    jwtConfig.secret,
    { expiresIn: jwtConfig.accessTokenExpire } as any
  );
};

/**
 * @desc    Simple Customer Registration (username only, tenant-scoped)
 * @route   POST /api/customers/auth/register
 * @access  Public (requires tenant context)
 */
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username } = req.body;

    // Validation
    if (!username || !username.trim()) {
      res.status(400).json({
        success: false,
        message: 'Username is required',
      });
      return;
    }

    if (username.trim().length < 3) {
      res.status(400).json({
        success: false,
        message: 'Username must be at least 3 characters',
      });
      return;
    }

    // Verify tenant context
    if (!req.restaurantId) {
      res.status(400).json({
        success: false,
        message: 'Restaurant context is required',
      });
      return;
    }

    // Check if username already exists in this restaurant
    const existingCustomer = await Customer.findOne({
      username: username.trim().toLowerCase(),
      restaurantId: req.restaurantId,
    });

    if (existingCustomer) {
      res.status(400).json({
        success: false,
        message: 'Username already taken. Please choose another one.',
      });
      return;
    }

    // Create customer with just username
    const customer = await Customer.create({
      username: username.trim().toLowerCase(),
      restaurantId: req.restaurantId,
    });

    // Generate JWT token
    const token = generateCustomerToken(customer._id.toString(), customer.restaurantId.toString());

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        customer: {
          _id: customer._id,
          username: customer.username,
          restaurantId: customer.restaurantId,
          createdAt: customer.createdAt,
        },
        token,
      },
    });
  } catch (error: any) {
    console.error('Customer registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration',
      error: error.message,
    });
  }
};

/**
 * @desc    Simple Customer Login (username only, tenant-scoped)
 * @route   POST /api/customers/auth/login
 * @access  Public (requires tenant context)
 */
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username } = req.body;

    // Validation
    if (!username || !username.trim()) {
      res.status(400).json({
        success: false,
        message: 'Username is required',
      });
      return;
    }

    // Verify tenant context
    if (!req.restaurantId) {
      res.status(400).json({
        success: false,
        message: 'Restaurant context is required',
      });
      return;
    }

    // Find customer by username and restaurant
    const customer = await Customer.findOne({
      username: username.trim().toLowerCase(),
      restaurantId: req.restaurantId,
    });

    if (!customer) {
      res.status(401).json({
        success: false,
        message: 'Username not found. Please register first.',
      });
      return;
    }

    // Check if customer is active
    if (!customer.isActive) {
      res.status(403).json({
        success: false,
        message: 'Account is inactive. Please contact support.',
      });
      return;
    }

    // Generate JWT token
    const token = generateCustomerToken(customer._id.toString(), customer.restaurantId.toString());

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        customer: {
          _id: customer._id,
          username: customer.username,
          restaurantId: customer.restaurantId,
          createdAt: customer.createdAt,
        },
        token,
      },
    });
  } catch (error: any) {
    console.error('Customer login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login',
      error: error.message,
    });
  }
};

/**
 * @desc    Get customer's active order (tenant-scoped)
 * @route   GET /api/customers/auth/active-order
 * @access  Private (requires customerAuth)
 */
export const getActiveOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    // Customer is attached by customerAuth middleware
    if (!req.customer) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    // Find customer's most recent non-cancelled, non-served order
    const activeOrder = await Order.findOne({
      restaurantId: req.restaurantId,
      customerId: req.customer._id,
      status: { $in: ['received', 'preparing', 'ready'] },
    })
      .populate('tableId', 'tableNumber location')
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    if (!activeOrder) {
      res.status(200).json({
        success: true,
        data: null,
        message: 'No active order found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: activeOrder,
    });
  } catch (error: any) {
    console.error('Get active order error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};
