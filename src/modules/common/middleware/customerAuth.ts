import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import Customer from '../models/Customer';
import { jwtConfig } from '../config/jwt';

// JWT Payload structure for customer tokens
interface CustomerJwtPayload {
  id: string;
  restaurantId: string;
  type: 'customer';
}

/**
 * Customer Authentication Middleware
 *
 * Validates JWT token and ensures:
 * 1. Token is valid and not expired
 * 2. Token type is 'customer'
 * 3. Customer belongs to current restaurant (tenant validation)
 * 4. Customer account is active
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
        message: 'Account is inactive. Please contact the restaurant.',
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
 * Similar to customerAuth but doesn't fail if no token is provided.
 * Useful for endpoints that work for both authenticated and guest customers.
 *
 * If token is provided and valid, attaches customer to request.
 * If no token or invalid token, continues without customer.
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

    // Get customer from database
    const customer = await Customer.findOne({
      _id: decoded.id,
      restaurantId: req.restaurantId,
    }).select('-password');

    // If customer found and active, attach to request
    if (customer && customer.isActive) {
      req.customer = customer;
    }

    next();
  } catch (error: any) {
    // On any error, just continue without customer
    next();
  }
};
