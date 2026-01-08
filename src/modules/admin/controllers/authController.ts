import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import Admin from '../../common/models/Admin';
import { jwtConfig } from '../../common/config/jwt';

// Generate JWT token for restaurant admin
const generateToken = (adminId: string, restaurantId: string): string => {
  return jwt.sign(
    {
      id: adminId,
      restaurantId: restaurantId,
      type: 'admin' as const,
    },
    jwtConfig.secret,
    { expiresIn: jwtConfig.accessTokenExpire } as any
  );
};

// Generate refresh token for restaurant admin
const generateRefreshToken = (adminId: string, restaurantId: string): string => {
  return jwt.sign(
    {
      id: adminId,
      restaurantId: restaurantId,
      type: 'admin' as const,
    },
    jwtConfig.refreshSecret,
    { expiresIn: jwtConfig.refreshTokenExpire } as any
  );
};

// Generate customer token for Socket.io (24h expiry)
export const generateCustomerToken = (tableId: string, restaurantId: string): string => {
  return jwt.sign(
    {
      id: tableId,
      restaurantId: restaurantId,
      type: 'customer',
    },
    jwtConfig.secret,
    {
      expiresIn: '24h',
    }
  );
};

// @desc    Admin login (tenant-scoped)
// @route   POST /api/auth/login
// @access  Public (but requires tenant context)
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body;

    // Validation
    if (!username || !password) {
      res.status(400).json({
        success: false,
        message: 'Please provide username and password',
      });
      return;
    }

    // CRITICAL: Find admin within current restaurant only
    const admin = await Admin.findOne({
      username,
      restaurantId: req.restaurantId,
    }).select('+password');

    if (!admin) {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
      return;
    }

    // Check if admin is active
    if (!admin.isActive) {
      res.status(403).json({
        success: false,
        message: 'Account is inactive. Please contact your administrator.',
      });
      return;
    }

    // Check password
    const isPasswordMatch = await admin.comparePassword(password);

    if (!isPasswordMatch) {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
      return;
    }

    // Generate tokens with restaurantId
    const token = generateToken(admin._id.toString(), admin.restaurantId.toString());
    const refreshToken = generateRefreshToken(admin._id.toString(), admin.restaurantId.toString());

    // Remove password from response using object destructuring
    const adminData = admin.toObject();
    const { password: _, ...adminWithoutPassword } = adminData;

    res.status(200).json({
      success: true,
      data: {
        admin: adminWithoutPassword,
        restaurant: req.tenant, // Include restaurant info
        token,
        refreshToken,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Get current admin (with restaurant info)
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req: Request, res: Response): Promise<void> => {
  try {
    const admin = req.admin;

    res.status(200).json({
      success: true,
      data: {
        admin,
        restaurant: req.tenant,
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

// @desc    Logout admin
// @route   POST /api/auth/logout
// @access  Private
export const logout = async (_req: Request, res: Response): Promise<void> => {
  try {
    // Note: With JWT, logout is handled on the client side by removing the token
    // This endpoint is mainly for consistency and future enhancements (e.g., token blacklisting)

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Refresh token (multi-tenant aware)
// @route   POST /api/auth/refresh
// @access  Public
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

    // Verify refresh token
    const decoded = jwt.verify(token, jwtConfig.refreshSecret) as {
      id: string;
      restaurantId: string;
      type: string;
    };

    // Verify token type
    if (decoded.type !== 'admin') {
      res.status(401).json({
        success: false,
        message: 'Invalid token type',
      });
      return;
    }

    // Verify restaurant matches current context
    if (decoded.restaurantId !== req.restaurantId?.toString()) {
      res.status(403).json({
        success: false,
        message: 'Restaurant mismatch',
      });
      return;
    }

    // Get admin
    const admin = await Admin.findOne({
      _id: decoded.id,
      restaurantId: req.restaurantId,
    });

    if (!admin || !admin.isActive) {
      res.status(401).json({
        success: false,
        message: 'Invalid refresh token',
      });
      return;
    }

    // Generate new tokens
    const newToken = generateToken(admin._id.toString(), admin.restaurantId.toString());
    const newRefreshToken = generateRefreshToken(admin._id.toString(), admin.restaurantId.toString());

    res.status(200).json({
      success: true,
      data: {
        token: newToken,
        refreshToken: newRefreshToken,
      },
    });
  } catch (error: any) {
    res.status(401).json({
      success: false,
      message: 'Invalid refresh token',
    });
  }
};
