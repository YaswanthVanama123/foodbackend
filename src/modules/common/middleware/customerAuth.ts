import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import Customer from '../models/Customer';
import { jwtConfig } from '../config/jwt';
import { RedisCache, CacheKeys } from '../config/redis';

// JWT Payload structure for customer tokens
interface CustomerJwtPayload {
  id: string;
  restaurantId: string;
  type: 'customer';
  iat?: number;
  exp?: number;
}

// Cached session data
interface CachedSession {
  customer: {
    _id: string;
    username: string;
    restaurantId: string;
    isActive: boolean;
    fcmToken?: string;
    createdAt: Date;
    updatedAt: Date;
  };
  cachedAt: number;
}

/**
 * Customer Authentication Middleware (OPTIMIZED)
 *
 * Validates JWT token and ensures:
 * 1. Token is valid and not expired
 * 2. Token type is 'customer'
 * 3. Customer belongs to current restaurant (tenant validation)
 * 4. Customer account is active
 *
 * OPTIMIZATIONS:
 * - Redis caching to avoid DB lookups (cached for 5 minutes)
 * - .lean() queries for faster JSON conversion
 * - Explicit field selection to minimize data transfer
 * - Short-circuit validation for faster failures
 *
 * Attaches customer object and restaurantId to request
 */
export const customerAuth = async (
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
    const decoded = jwt.verify(token, jwtConfig.secret) as CustomerJwtPayload;

    // Verify this is a customer token (not admin or super admin)
    if (decoded.type !== 'customer') {
      res.status(403).json({
        success: false,
        message: 'Invalid token type. Customer access required.',
        code: 'INVALID_TOKEN_TYPE',
      });
      return;
    }

    // CRITICAL: Verify customer token contains restaurant context
    if (!decoded.restaurantId) {
      res.status(401).json({
        success: false,
        message: 'Invalid token format. Missing restaurant context.',
        code: 'MISSING_RESTAURANT_ID',
      });
      return;
    }

    // CRITICAL: Verify customer belongs to current tenant
    if (decoded.restaurantId !== req.restaurantId?.toString()) {
      res.status(403).json({
        success: false,
        message: 'Access denied. Token restaurant mismatch.',
        code: 'RESTAURANT_MISMATCH',
      });
      return;
    }

    // OPTIMIZATION: Try to get customer from Redis cache first
    const cacheKey = CacheKeys.jwtSession(decoded.id, decoded.restaurantId);
    const cachedSession = await RedisCache.get<CachedSession>(cacheKey);

    if (cachedSession) {
      // Verify cached data is still valid
      if (cachedSession.customer.isActive) {
        // Convert cached data to match Customer document structure
        req.customer = cachedSession.customer as any;
        return next();
      } else {
        // Customer became inactive, remove from cache
        await RedisCache.del(cacheKey);
      }
    }

    // Cache miss or invalid - fetch from database
    // OPTIMIZATION: Use .lean() for faster query, select only needed fields
    const customer = await Customer.findOne({
      _id: decoded.id,
      restaurantId: req.restaurantId,
    })
      .select('_id username restaurantId isActive fcmToken createdAt updatedAt')
      .lean()
      .exec();

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
        message: 'Account is inactive. Please contact the restaurant.',
        code: 'ACCOUNT_INACTIVE',
      });
      return;
    }

    // OPTIMIZATION: Cache session in Redis (5 minutes TTL)
    const sessionData: CachedSession = {
      customer: customer as any,
      cachedAt: Date.now(),
    };
    await RedisCache.set(cacheKey, sessionData, 300); // 5 minutes

    // Attach customer to request
    req.customer = customer as any;
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
 * Invalidate customer session cache
 * Call this when customer data changes (logout, profile update, etc.)
 */
export const invalidateCustomerSession = async (
  customerId: string,
  restaurantId: string
): Promise<void> => {
  const cacheKey = CacheKeys.jwtSession(customerId, restaurantId);
  await RedisCache.del(cacheKey);
};

/**
 * Optional Customer Authentication Middleware (OPTIMIZED)
 *
 * Similar to customerAuth but doesn't fail if no token is provided.
 * Useful for endpoints that work for both authenticated and guest customers.
 *
 * If token is provided and valid, attaches customer to request.
 * If no token or invalid token, continues without customer.
 *
 * OPTIMIZATIONS:
 * - Redis caching for authenticated sessions
 * - .lean() queries for faster JSON conversion
 */
export const optionalCustomerAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    // If no token, continue without customer
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);

    // Verify and decode JWT token
    const decoded = jwt.verify(token, jwtConfig.secret) as CustomerJwtPayload;

    // Verify token type
    if (decoded.type !== 'customer') {
      return next();
    }

    // Verify restaurant context
    if (!decoded.restaurantId || decoded.restaurantId !== req.restaurantId?.toString()) {
      return next();
    }

    // OPTIMIZATION: Try Redis cache first
    const cacheKey = CacheKeys.jwtSession(decoded.id, decoded.restaurantId);
    const cachedSession = await RedisCache.get<CachedSession>(cacheKey);

    if (cachedSession && cachedSession.customer.isActive) {
      req.customer = cachedSession.customer as any;
      return next();
    }

    // Get customer from database with optimizations
    const customer = await Customer.findOne({
      _id: decoded.id,
      restaurantId: req.restaurantId,
    })
      .select('_id username restaurantId isActive fcmToken createdAt updatedAt')
      .lean()
      .exec();

    // If customer found and active, attach to request and cache
    if (customer && customer.isActive) {
      req.customer = customer as any;

      // Cache the session
      const sessionData: CachedSession = {
        customer: customer as any,
        cachedAt: Date.now(),
      };
      await RedisCache.set(cacheKey, sessionData, 300);
    }

    next();
  } catch (error: any) {
    // On any error, just continue without customer
    next();
  }
};
