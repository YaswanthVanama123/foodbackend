import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import Admin from '../models/Admin';
import SuperAdmin from '../models/SuperAdmin';
import Customer from '../models/Customer';
import { jwtConfig } from '../config/jwt';

// JWT Payload structure for multi-tenant
interface JwtPayload {
  id: string;
  restaurantId?: string; // Present for restaurant admins and customers
  type: 'admin' | 'super_admin' | 'customer'; // Token type
}

/**
 * Restaurant Admin Authentication Middleware
 *
 * Validates JWT token and ensures:
 * 1. Token is valid and not expired
 * 2. Token type is 'admin'
 * 3. Admin belongs to current restaurant (tenant validation)
 * 4. Admin account is active
 */
export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'No token provided. Please login.',
        code: 'NO_TOKEN',
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify and decode JWT token
    const decoded = jwt.verify(token, jwtConfig.secret) as JwtPayload;

    // Verify this is an admin token (not super admin or customer)
    if (decoded.type !== 'admin') {
      res.status(403).json({
        success: false,
        message: 'Invalid token type. Use super admin endpoint for super admin access.',
        code: 'INVALID_TOKEN_TYPE',
      });
      return;
    }

    // CRITICAL: Verify admin belongs to current tenant
    if (!decoded.restaurantId) {
      res.status(401).json({
        success: false,
        message: 'Invalid token format. Missing restaurant context.',
        code: 'MISSING_RESTAURANT_ID',
      });
      return;
    }

    if (decoded.restaurantId !== req.restaurantId?.toString()) {
      res.status(403).json({
        success: false,
        message: 'Access denied. Token restaurant mismatch.',
        code: 'RESTAURANT_MISMATCH',
      });
      return;
    }

    // Get admin from database (with restaurant validation)
    const admin = await Admin.findOne({
      _id: decoded.id,
      restaurantId: req.restaurantId,
    }).select('-password');

    if (!admin) {
      res.status(401).json({
        success: false,
        message: 'Invalid token. Admin not found.',
        code: 'ADMIN_NOT_FOUND',
      });
      return;
    }

    // Check if admin account is active
    if (!admin.isActive) {
      res.status(403).json({
        success: false,
        message: 'Account is inactive. Please contact your administrator.',
        code: 'ACCOUNT_INACTIVE',
      });
      return;
    }

    // Attach admin to request
    req.admin = admin;
    next();
  } catch (error: any) {
    // Handle JWT errors
    if (error.name === 'JsonWebTokenError') {
      res.status(401).json({
        success: false,
        message: 'Invalid token',
        code: 'INVALID_TOKEN',
      });
      return;
    }

    if (error.name === 'TokenExpiredError') {
      res.status(401).json({
        success: false,
        message: 'Token expired. Please login again.',
        code: 'TOKEN_EXPIRED',
      });
      return;
    }

    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication error',
      code: 'AUTH_ERROR',
    });
  }
};

/**
 * Super Admin Authentication Middleware
 *
 * Validates JWT token for platform super admins.
 * No tenant context required.
 */
export const superAdminAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'No token provided',
        code: 'NO_TOKEN',
      });
      return;
    }

    const token = authHeader.substring(7);

    // Verify and decode JWT token
    const decoded = jwt.verify(token, jwtConfig.secret) as JwtPayload;

    // Verify this is a super admin token
    if (decoded.type !== 'super_admin') {
      res.status(403).json({
        success: false,
        message: 'Super admin access required',
        code: 'SUPER_ADMIN_REQUIRED',
      });
      return;
    }

    // Get super admin from database
    const superAdmin = await SuperAdmin.findById(decoded.id).select('-password');

    if (!superAdmin) {
      res.status(401).json({
        success: false,
        message: 'Invalid token',
        code: 'SUPER_ADMIN_NOT_FOUND',
      });
      return;
    }

    // Check if super admin account is active
    if (!superAdmin.isActive) {
      res.status(403).json({
        success: false,
        message: 'Account is inactive',
        code: 'ACCOUNT_INACTIVE',
      });
      return;
    }

    // Attach super admin to request
    req.superAdmin = superAdmin;
    next();
  } catch (error: any) {
    if (error.name === 'JsonWebTokenError') {
      res.status(401).json({
        success: false,
        message: 'Invalid token',
        code: 'INVALID_TOKEN',
      });
      return;
    }

    if (error.name === 'TokenExpiredError') {
      res.status(401).json({
        success: false,
        message: 'Token expired',
        code: 'TOKEN_EXPIRED',
      });
      return;
    }

    console.error('Super admin auth error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication error',
      code: 'AUTH_ERROR',
    });
  }
};

/**
 * Permission-based Authorization Middleware
 *
 * Checks if authenticated user (admin or super admin) has specific permission.
 */
export const requirePermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.admin || req.superAdmin;

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Not authenticated',
        code: 'NOT_AUTHENTICATED',
      });
      return;
    }

    // Super admins have all permissions
    if (req.superAdmin) {
      return next();
    }

    // Check if admin has the required permission
    if (req.admin && req.admin.permissions.includes(permission)) {
      return next();
    }

    res.status(403).json({
      success: false,
      message: 'Insufficient permissions',
      code: 'INSUFFICIENT_PERMISSIONS',
      required: permission,
    });
  };
};

/**
 * Role-based Authorization Middleware
 *
 * Checks if authenticated admin has one of the specified roles.
 */
export const requireRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.admin && !req.superAdmin) {
      res.status(401).json({
        success: false,
        message: 'Not authenticated',
        code: 'NOT_AUTHENTICATED',
      });
      return;
    }

    // Super admins can access all roles
    if (req.superAdmin) {
      return next();
    }

    // Check if admin has one of the required roles
    if (req.admin && roles.includes(req.admin.role)) {
      return next();
    }

    res.status(403).json({
      success: false,
      message: 'Access denied. Required role not met.',
      code: 'ROLE_NOT_AUTHORIZED',
      required: roles,
      current: req.admin?.role,
    });
  };
};

/**
 * Customer Authentication Middleware
 *
 * Validates JWT token and ensures:
 * 1. Token is valid and not expired
 * 2. Token type is 'customer'
 * 3. Customer belongs to current restaurant (tenant validation)
 * 4. Customer account is active
 */
export const customerAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'No token provided. Please login.',
        code: 'NO_TOKEN',
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify and decode JWT token
    const decoded = jwt.verify(token, jwtConfig.secret) as JwtPayload;

    // Verify this is a customer token
    if (decoded.type !== 'customer') {
      res.status(403).json({
        success: false,
        message: 'Invalid token type. Customer access required.',
        code: 'INVALID_TOKEN_TYPE',
      });
      return;
    }

    // CRITICAL: Verify customer belongs to current tenant
    if (!decoded.restaurantId) {
      res.status(401).json({
        success: false,
        message: 'Invalid token format. Missing restaurant context.',
        code: 'MISSING_RESTAURANT_ID',
      });
      return;
    }

    if (decoded.restaurantId !== req.restaurantId?.toString()) {
      res.status(403).json({
        success: false,
        message: 'Access denied. Token restaurant mismatch.',
        code: 'RESTAURANT_MISMATCH',
      });
      return;
    }

    // Get customer from database (with restaurant validation)
    const customer = await Customer.findOne({
      _id: decoded.id,
      restaurantId: req.restaurantId,
    }).select('-password');

    if (!customer) {
      res.status(401).json({
        success: false,
        message: 'Invalid token. Customer not found.',
        code: 'CUSTOMER_NOT_FOUND',
      });
      return;
    }

    // Check if customer account is active
    if (!customer.isActive) {
      res.status(403).json({
        success: false,
        message: 'Account is inactive. Please contact support.',
        code: 'ACCOUNT_INACTIVE',
      });
      return;
    }

    // Attach customer to request
    req.customer = customer;
    next();
  } catch (error: any) {
    // Handle JWT errors
    if (error.name === 'JsonWebTokenError') {
      res.status(401).json({
        success: false,
        message: 'Invalid token',
        code: 'INVALID_TOKEN',
      });
      return;
    }

    if (error.name === 'TokenExpiredError') {
      res.status(401).json({
        success: false,
        message: 'Token expired. Please login again.',
        code: 'TOKEN_EXPIRED',
      });
      return;
    }

    console.error('Customer auth middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication error',
      code: 'AUTH_ERROR',
    });
  }
};

/**
 * Optional Customer Authentication Middleware
 *
 * Same as customerAuthMiddleware but doesn't fail if no token is provided.
 * Allows routes to work for both authenticated customers and guests.
 * If a valid token is present, attaches customer to req.customer
 */
export const optionalCustomerAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    // No token provided - continue as guest
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);

    try {
      // Verify and decode JWT token
      const decoded = jwt.verify(token, jwtConfig.secret) as JwtPayload;

      // Only process if this is a customer token
      if (decoded.type === 'customer' && decoded.restaurantId === req.restaurantId?.toString()) {
        // Get customer from database
        const customer = await Customer.findOne({
          _id: decoded.id,
          restaurantId: req.restaurantId,
        }).select('-password');

        // Only attach customer if found and active
        if (customer && customer.isActive) {
          req.customer = customer;
        }
      }
    } catch (jwtError) {
      // Invalid token - continue as guest
      console.log('Optional auth: Invalid token, continuing as guest');
    }

    next();
  } catch (error: any) {
    console.error('Optional customer auth error:', error);
    // Don't fail - continue as guest
    next();
  }
};
