import { Request, Response } from 'express';
import Customer from '../../common/models/Customer';
import Order from '../../common/models/Order';
import { RedisCache, CacheKeys } from '../../common/config/redis';
import {
  generateTokenPair,
  rotateRefreshToken,
  revokeAllRefreshTokens,
} from '../../common/utils/tokenUtils';
import { invalidateCustomerSession } from '../../common/middleware/customerAuth';

/**
 * @desc    Simple Customer Registration (username only, tenant-scoped) - OPTIMIZED
 * @route   POST /api/customers/auth/register
 * @access  Public (requires tenant context)
 *
 * OPTIMIZATIONS:
 * - Uses .lean() for faster customer check
 * - Generates refresh token for session management
 * - Caches session data in Redis
 * - Early validation for faster failures
 */
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username } = req.body;

    // Early validation for faster failures
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

    // OPTIMIZATION: Use .lean() for faster query
    const existingCustomer = await Customer.findOne({
      username: username.trim().toLowerCase(),
      restaurantId: req.restaurantId,
    })
      .select('_id')
      .lean()
      .exec();

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

    // OPTIMIZATION: Generate token pair with refresh token
    const tokens = await generateTokenPair(
      customer._id.toString(),
      customer.restaurantId.toString()
    );

    // OPTIMIZATION: Cache customer session in Redis
    const cacheKey = CacheKeys.jwtSession(
      customer._id.toString(),
      customer.restaurantId.toString()
    );
    await RedisCache.set(
      cacheKey,
      {
        customer: {
          _id: customer._id,
          username: customer.username,
          restaurantId: customer.restaurantId,
          isActive: customer.isActive,
          createdAt: customer.createdAt,
          updatedAt: customer.updatedAt,
        },
        cachedAt: Date.now(),
      },
      300 // 5 minutes
    );

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
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
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
 * @desc    Simple Customer Login (username only, tenant-scoped) - OPTIMIZED
 * @route   POST /api/customers/auth/login
 * @access  Public (requires tenant context)
 *
 * OPTIMIZATIONS:
 * - Uses .lean() and select() for minimal data transfer
 * - Generates refresh token for session management
 * - Caches session in Redis (5 min TTL)
 * - Early validation for faster failures
 * - Rate limiting applied via middleware
 */
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username } = req.body;

    // Early validation
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

    // OPTIMIZATION: Use .lean() and select only needed fields
    const customer = await Customer.findOne({
      username: username.trim().toLowerCase(),
      restaurantId: req.restaurantId,
    })
      .select('_id username restaurantId isActive createdAt updatedAt')
      .lean()
      .exec();

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

    // OPTIMIZATION: Generate token pair with refresh token
    const tokens = await generateTokenPair(
      customer._id.toString(),
      customer.restaurantId.toString()
    );

    // OPTIMIZATION: Cache customer session in Redis
    const cacheKey = CacheKeys.jwtSession(
      customer._id.toString(),
      customer.restaurantId.toString()
    );
    await RedisCache.set(
      cacheKey,
      {
        customer,
        cachedAt: Date.now(),
      },
      300 // 5 minutes
    );

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
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
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
 * @desc    Get customer's active order (tenant-scoped) - OPTIMIZED
 * @route   GET /api/customers/auth/active-order
 * @access  Private (requires customerAuth)
 *
 * OPTIMIZATIONS:
 * - Uses .lean() for faster query
 * - Explicit field selection for populated documents
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

    // OPTIMIZATION: Use .lean() and limit fields
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

/**
 * @desc    Refresh access token using refresh token
 * @route   POST /api/customers/auth/refresh
 * @access  Public
 */
export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      res.status(400).json({
        success: false,
        message: 'Refresh token is required',
      });
      return;
    }

    // Rotate refresh token (invalidate old, generate new)
    const newTokens = await rotateRefreshToken(token);

    if (!newTokens) {
      res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
        expiresIn: newTokens.expiresIn,
      },
    });
  } catch (error: any) {
    console.error('Refresh token error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during token refresh',
      error: error.message,
    });
  }
};

/**
 * @desc    Logout customer (revoke all tokens)
 * @route   POST /api/customers/auth/logout
 * @access  Private
 */
export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.customer) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    const customerId = req.customer._id.toString();
    const restaurantId = req.customer.restaurantId.toString();

    // Revoke all refresh tokens
    await revokeAllRefreshTokens(customerId);

    // Invalidate session cache
    await invalidateCustomerSession(customerId, restaurantId);

    res.status(200).json({
      success: true,
      message: 'Logout successful',
    });
  } catch (error: any) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during logout',
      error: error.message,
    });
  }
};
