import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import Admin from '../models/Admin';
import SuperAdmin from '../models/SuperAdmin';
import Customer from '../models/Customer';
import { jwtConfig } from '../config/jwt';
import { CacheKeys, CacheTTL, withCache } from '../utils/cacheUtils';

// JWT Payload structure for multi-tenant
interface JwtPayload {
  id: string;
  restaurantId?: string; // Present for restaurant admins and customers
  type: 'admin' | 'super_admin' | 'customer'; // Token type
}

// JWT verification cache to avoid repeated crypto operations
const jwtVerificationCache = new Map<string, { decoded: JwtPayload; timestamp: number }>();
const JWT_CACHE_TTL = 300000; // 5 minutes

/**
 * Verify JWT with caching to avoid repeated crypto operations
 * OPTIMIZATION: Caches verification results for 5 minutes
 */
const verifyJwtWithCache = (token: string): JwtPayload => {
  // Check in-memory cache first (fastest)
  const cached = jwtVerificationCache.get(token);
  if (cached && Date.now() - cached.timestamp < JWT_CACHE_TTL) {
    return cached.decoded;
  }

  // Verify token
  const decoded = jwt.verify(token, jwtConfig.secret) as JwtPayload;

  // Cache the result
  jwtVerificationCache.set(token, { decoded, timestamp: Date.now() });

  // Cleanup old entries periodically
  if (jwtVerificationCache.size > 1000) {
    const cutoff = Date.now() - JWT_CACHE_TTL;
    for (const [key, value] of jwtVerificationCache.entries()) {
      if (value.timestamp < cutoff) {
        jwtVerificationCache.delete(key);
      }
    }
  }

  return decoded;
};

/**
 * Restaurant Admin Authentication Middleware
 *
 * Validates JWT token and ensures:
 * 1. Token is valid and not expired
 * 2. Token type is 'admin'
 * 3. Admin belongs to current restaurant (tenant validation)
 * 4. Admin account is active
 *
 * OPTIMIZATIONS:
 * - JWT verification caching (5 min TTL)
 * - User data caching with Redis
 * - Request deduplication for concurrent requests
 * - Lean MongoDB queries with field selection
 * - Timeout protection (10ms target)
 */
export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const startTime = Date.now();

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

    // Verify and decode JWT token (with caching)
    const decoded = verifyJwtWithCache(token);

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

    // Get admin from cache or database with request deduplication
    const cacheKey = CacheKeys.adminUser(decoded.id, req.restaurantId!.toString());
    const admin = await withCache(
      cacheKey,
      CacheTTL.USER_DATA,
      async () => {
        // OPTIMIZATION: Use lean() for plain objects and select() for specific fields
        return Admin.findOne({
          _id: decoded.id,
          restaurantId: req.restaurantId,
        })
          .select('_id email fullName role permissions isActive restaurantId')
          .lean()
          .exec();
      }
    );

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
    req.admin = admin as any;

    const duration = Date.now() - startTime;
    if (duration > 10) {
      console.warn(`[AUTH SLOW] Admin auth took ${duration}ms for ${decoded.id}`);
    }

    next();
  } catch (error: any) {
    // Clear cache on JWT errors
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      const token = req.headers.authorization?.substring(7);
      if (token) {
        jwtVerificationCache.delete(token);
      }
    }

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
 *
 * OPTIMIZATIONS: Same as authMiddleware
 */
export const superAdminAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const startTime = Date.now();

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

    // Verify and decode JWT token (with caching)
    const decoded = verifyJwtWithCache(token);

    // Verify this is a super admin token
    if (decoded.type !== 'super_admin') {
      res.status(403).json({
        success: false,
        message: 'Super admin access required',
        code: 'SUPER_ADMIN_REQUIRED',
      });
      return;
    }

    // Get super admin from cache or database
    const cacheKey = CacheKeys.superAdminUser(decoded.id);
    const superAdmin = await withCache(
      cacheKey,
      CacheTTL.USER_DATA,
      async () => {
        // OPTIMIZATION: Use lean() and select()
        return SuperAdmin.findById(decoded.id)
          .select('_id email fullName isActive')
          .lean()
          .exec();
      }
    );

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
    req.superAdmin = superAdmin as any;

    const duration = Date.now() - startTime;
    if (duration > 10) {
      console.warn(`[AUTH SLOW] SuperAdmin auth took ${duration}ms for ${decoded.id}`);
    }

    next();
  } catch (error: any) {
    // Clear cache on JWT errors
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      const token = req.headers.authorization?.substring(7);
      if (token) {
        jwtVerificationCache.delete(token);
      }
    }

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
 *
 * OPTIMIZATIONS: Same as authMiddleware
 */
export const customerAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const startTime = Date.now();

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

    // Verify and decode JWT token (with caching)
    const decoded = verifyJwtWithCache(token);

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

    // Get customer from cache or database with request deduplication
    const cacheKey = CacheKeys.customerUser(decoded.id, req.restaurantId!.toString());
    const customer = await withCache(
      cacheKey,
      CacheTTL.USER_DATA,
      async () => {
        // OPTIMIZATION: Use lean() and select()
        return Customer.findOne({
          _id: decoded.id,
          restaurantId: req.restaurantId,
        })
          .select('_id email fullName phone isActive restaurantId')
          .lean()
          .exec();
      }
    );

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
    req.customer = customer as any;

    const duration = Date.now() - startTime;
    if (duration > 10) {
      console.warn(`[AUTH SLOW] Customer auth took ${duration}ms for ${decoded.id}`);
    }

    next();
  } catch (error: any) {
    // Clear cache on JWT errors
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      const token = req.headers.authorization?.substring(7);
      if (token) {
        jwtVerificationCache.delete(token);
      }
    }

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
 *
 * OPTIMIZATIONS: Same as authMiddleware
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
      // Verify and decode JWT token (with caching)
      const decoded = verifyJwtWithCache(token);

      // Only process if this is a customer token
      if (decoded.type === 'customer' && decoded.restaurantId === req.restaurantId?.toString()) {
        // Get customer from cache or database
        const cacheKey = CacheKeys.customerUser(decoded.id, req.restaurantId!.toString());
        const customer = await withCache(
          cacheKey,
          CacheTTL.USER_DATA,
          async () => {
            // OPTIMIZATION: Use lean() and select()
            return Customer.findOne({
              _id: decoded.id,
              restaurantId: req.restaurantId,
            })
              .select('_id email fullName phone isActive restaurantId')
              .lean()
              .exec();
          }
        );

        // Only attach customer if found and active
        if (customer && customer.isActive) {
          req.customer = customer as any;
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
