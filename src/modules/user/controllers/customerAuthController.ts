import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import Customer from '../../common/models/Customer';
import { jwtConfig } from '../../common/config/jwt';

// Generate JWT token for customer
const generateToken = (customerId: string, restaurantId: string): string => {
  return jwt.sign(
    {
      id: customerId,
      restaurantId: restaurantId,
      type: 'customer',
    },
    jwtConfig.secret,
    {
      expiresIn: jwtConfig.accessTokenExpire,
    } as any
  );
};

// Generate refresh token for customer
const generateRefreshToken = (customerId: string, restaurantId: string): string => {
  return jwt.sign(
    {
      id: customerId,
      restaurantId: restaurantId,
      type: 'customer',
    },
    jwtConfig.refreshSecret,
    {
      expiresIn: jwtConfig.refreshTokenExpire,
    } as any
  );
};

// @desc    Customer registration (tenant-scoped)
// @route   POST /api/customers/register
// @access  Public (but requires tenant context)
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, firstName, lastName, phone, preferences, notifications, language, theme } = req.body;

    // Validation
    if (!email || !password || !firstName || !lastName) {
      res.status(400).json({
        success: false,
        message: 'Please provide email, password, first name, and last name',
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

    // Check if customer already exists in this restaurant
    const existingCustomer = await Customer.findOne({
      email,
      restaurantId: req.restaurantId,
    });

    if (existingCustomer) {
      res.status(400).json({
        success: false,
        message: 'Customer with this email already exists for this restaurant',
      });
      return;
    }

    // Create customer
    const customer = await Customer.create({
      email,
      password,
      firstName,
      lastName,
      phone,
      restaurantId: req.restaurantId,
      preferences: preferences || {
        dietaryRestrictions: [],
        allergens: [],
        favoriteItems: [],
      },
      notifications: notifications || {
        email: true,
        push: true,
      },
      language: language || 'en',
      theme: theme || 'light',
    });

    // Generate tokens
    const token = generateToken(customer._id.toString(), customer.restaurantId.toString());
    const refreshToken = generateRefreshToken(customer._id.toString(), customer.restaurantId.toString());

    // Remove password from response
    const customerData = customer.toObject();
    const { password: _, ...customerWithoutPassword } = customerData;

    res.status(201).json({
      success: true,
      data: {
        customer: customerWithoutPassword,
        restaurant: req.tenant,
        token,
        refreshToken,
      },
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Customer login (tenant-scoped)
// @route   POST /api/customers/login
// @access  Public (but requires tenant context)
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: 'Please provide email and password',
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

    // CRITICAL: Find customer within current restaurant only
    const customer = await Customer.findOne({
      email,
      restaurantId: req.restaurantId,
    }).select('+password');

    if (!customer) {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
      return;
    }

    // Check if customer is active
    if (!customer.isActive) {
      res.status(403).json({
        success: false,
        message: 'Account is inactive. Please contact the restaurant.',
      });
      return;
    }

    // Check password
    const isPasswordMatch = await customer.comparePassword(password);

    if (!isPasswordMatch) {
      res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
      return;
    }

    // Generate tokens with restaurantId
    const token = generateToken(customer._id.toString(), customer.restaurantId.toString());
    const refreshToken = generateRefreshToken(customer._id.toString(), customer.restaurantId.toString());

    // Remove password from response
    const customerData = customer.toObject();
    const { password: _, ...customerWithoutPassword } = customerData;

    res.status(200).json({
      success: true,
      data: {
        customer: customerWithoutPassword,
        restaurant: req.tenant,
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

// @desc    Get current customer (with restaurant info)
// @route   GET /api/customers/me
// @access  Private (Customer)
export const getCurrentCustomer = async (req: Request, res: Response): Promise<void> => {
  try {
    const customer = req.customer;

    res.status(200).json({
      success: true,
      data: {
        customer,
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

// @desc    Update customer profile
// @route   PUT /api/customers/profile
// @access  Private (Customer)
export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { firstName, lastName, phone, preferences, notifications, language, theme } = req.body;

    if (!req.customer) {
      res.status(401).json({
        success: false,
        message: 'Not authenticated',
      });
      return;
    }

    // Build update object with only provided fields
    const updateFields: any = {};

    if (firstName !== undefined) updateFields.firstName = firstName;
    if (lastName !== undefined) updateFields.lastName = lastName;
    if (phone !== undefined) updateFields.phone = phone;
    if (language !== undefined) updateFields.language = language;
    if (theme !== undefined) updateFields.theme = theme;

    // Handle nested objects
    if (preferences !== undefined) {
      if (preferences.dietaryRestrictions !== undefined) {
        updateFields['preferences.dietaryRestrictions'] = preferences.dietaryRestrictions;
      }
      if (preferences.allergens !== undefined) {
        updateFields['preferences.allergens'] = preferences.allergens;
      }
      if (preferences.favoriteItems !== undefined) {
        updateFields['preferences.favoriteItems'] = preferences.favoriteItems;
      }
    }

    if (notifications !== undefined) {
      if (notifications.email !== undefined) {
        updateFields['notifications.email'] = notifications.email;
      }
      if (notifications.push !== undefined) {
        updateFields['notifications.push'] = notifications.push;
      }
    }

    // Update customer
    const customer = await Customer.findOneAndUpdate(
      {
        _id: req.customer._id,
        restaurantId: req.restaurantId,
      },
      updateFields,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!customer) {
      res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        customer,
      },
    });
  } catch (error: any) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Change customer password
// @route   PUT /api/customers/password
// @access  Private (Customer)
export const changePassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Validation
    if (!currentPassword || !newPassword) {
      res.status(400).json({
        success: false,
        message: 'Please provide current password and new password',
      });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters',
      });
      return;
    }

    if (!req.customer) {
      res.status(401).json({
        success: false,
        message: 'Not authenticated',
      });
      return;
    }

    // Get customer with password
    const customer = await Customer.findOne({
      _id: req.customer._id,
      restaurantId: req.restaurantId,
    }).select('+password');

    if (!customer) {
      res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
      return;
    }

    // Verify current password
    const isPasswordMatch = await customer.comparePassword(currentPassword);

    if (!isPasswordMatch) {
      res.status(401).json({
        success: false,
        message: 'Current password is incorrect',
      });
      return;
    }

    // Update password
    customer.password = newPassword;
    await customer.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error: any) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

// @desc    Logout customer
// @route   POST /api/customers/logout
// @access  Private (Customer)
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

// @desc    Refresh customer token (multi-tenant aware)
// @route   POST /api/customers/refresh
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
    if (decoded.type !== 'customer') {
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

    // Get customer
    const customer = await Customer.findOne({
      _id: decoded.id,
      restaurantId: req.restaurantId,
    });

    if (!customer || !customer.isActive) {
      res.status(401).json({
        success: false,
        message: 'Invalid refresh token',
      });
      return;
    }

    // Generate new tokens
    const newToken = generateToken(customer._id.toString(), customer.restaurantId.toString());
    const newRefreshToken = generateRefreshToken(customer._id.toString(), customer.restaurantId.toString());

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
