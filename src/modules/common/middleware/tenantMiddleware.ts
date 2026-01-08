/// <reference path="../../../types/express.d.ts" />
import { Request, Response, NextFunction } from 'express';
import Restaurant, { IRestaurant } from '../models/Restaurant';

/**
 * Extract subdomain from host header and parse it
 * Examples:
 * - pizzahut.patlinks.com → pizzahut
 * - pizzahut.localhost:5000 → pizzahut (dev)
 * - localhost:5000 → null
 */
function extractSubdomain(host: string): string | null {
  // Remove port if present
  const hostname = host.split(':')[0];

  // Split by dots
  const parts = hostname.split('.');

  // Handle different scenarios
  if (parts.length === 1) {
    return null; // Just "localhost" or single domain
  }

  if (parts.length === 2 && parts[1] === 'localhost') {
    return parts[0]; // subdomain.localhost → subdomain
  }

  if (parts.length >= 2) {
    // Don't treat www or api as restaurant subdomains
    if (parts[0] === 'www' || parts[0] === 'api') {
      return null;
    }
    return parts[0]; // First part is subdomain
  }

  return null;
}

/**
 * Tenant Extraction Middleware
 *
 * Extracts restaurant subdomain from request, validates it, and attaches to request context.
 * Must run BEFORE authentication middleware.
 *
 * Flow:
 * 1. Extract subdomain from host header
 * 2. Skip for super admin routes
 * 3. Query Restaurant by subdomain
 * 4. Validate restaurant is active
 * 5. Validate subscription status
 * 6. Attach tenant to request
 */
export const extractTenant = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Skip tenant extraction for super admin routes
    if (req.path.startsWith('/super-admin')) {
      return next();
    }

    // Skip for health check and root API endpoint
    if (req.path === '/health' || req.path === '/' || req.path === '') {
      return next();
    }

    // Development mode: allow bypass with x-restaurant-id header
    if (process.env.NODE_ENV === 'development' && req.headers['x-restaurant-id']) {
      const restaurantId = req.headers['x-restaurant-id'] as string;

      const restaurant = await Restaurant.findById(restaurantId).lean<IRestaurant>();

      if (!restaurant) {
        res.status(404).json({
          success: false,
          message: 'Restaurant not found',
          code: 'RESTAURANT_NOT_FOUND',
        });
        return;
      }

      if (!restaurant.isActive) {
        res.status(403).json({
          success: false,
          message: 'This restaurant account is currently inactive',
          code: 'RESTAURANT_INACTIVE',
        });
        return;
      }

      if (restaurant.subscription.status !== 'active') {
        res.status(403).json({
          success: false,
          message: 'This restaurant subscription has expired. Please contact support.',
          code: 'SUBSCRIPTION_EXPIRED',
        });
        return;
      }

      req.tenant = restaurant;
      req.restaurantId = restaurant._id;
      return next();
    }

    // Extract subdomain from host
    const host = req.get('host') || req.hostname;
    const subdomain = extractSubdomain(host);

    // Validate subdomain exists
    if (!subdomain) {
      res.status(400).json({
        success: false,
        message: 'Invalid subdomain. Please access via restaurant subdomain (e.g., restaurant.patlinks.com)',
        code: 'INVALID_SUBDOMAIN',
      });
      return;
    }

    // Lookup restaurant by subdomain (with caching in production)
    const restaurant = await Restaurant.findOne({
      subdomain: subdomain.toLowerCase(),
    }).lean<IRestaurant>();

    if (!restaurant) {
      res.status(404).json({
        success: false,
        message: 'Restaurant not found. Please check your subdomain.',
        code: 'RESTAURANT_NOT_FOUND',
        subdomain,
      });
      return;
    }

    // Check if restaurant is active
    if (!restaurant.isActive) {
      res.status(403).json({
        success: false,
        message: 'This restaurant account is currently inactive. Please contact support.',
        code: 'RESTAURANT_INACTIVE',
      });
      return;
    }

    // Check subscription status
    if (restaurant.subscription.status !== 'active') {
      res.status(403).json({
        success: false,
        message: `This restaurant subscription is ${restaurant.subscription.status}. Please contact support.`,
        code: 'SUBSCRIPTION_INVALID',
        status: restaurant.subscription.status,
      });
      return;
    }

    // Check subscription expiration
    if (new Date(restaurant.subscription.endDate) < new Date()) {
      res.status(403).json({
        success: false,
        message: 'This restaurant subscription has expired. Please renew your subscription.',
        code: 'SUBSCRIPTION_EXPIRED',
      });
      return;
    }

    // Attach tenant to request
    req.tenant = restaurant;
    req.restaurantId = restaurant._id;

    // Optional: Update last login timestamp (can be done async)
    if (process.env.TRACK_RESTAURANT_ACCESS === 'true') {
      Restaurant.findByIdAndUpdate(restaurant._id, {
        lastLoginAt: new Date(),
      }).exec().catch(err => {
        console.error('Failed to update lastLoginAt:', err);
      });
    }

    next();
  } catch (error: any) {
    console.error('Tenant extraction error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during tenant extraction',
      code: 'TENANT_EXTRACTION_ERROR',
    });
  }
};

/**
 * Validate tenant middleware
 * Ensures tenant context exists (lightweight check after extractTenant)
 */
export const validateTenant = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.restaurantId) {
    res.status(400).json({
      success: false,
      message: 'Tenant context not found. Please access via restaurant subdomain.',
      code: 'TENANT_CONTEXT_MISSING',
    });
    return;
  }
  next();
};
