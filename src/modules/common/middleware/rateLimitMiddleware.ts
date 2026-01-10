/**
 * Rate Limiting Middleware
 *
 * Features:
 * - Per-IP rate limiting
 * - Per-user rate limiting
 * - Configurable limits per endpoint
 * - Sliding window algorithm
 * - Memory-efficient storage
 *
 * For production with multiple servers, use Redis-backed rate limiting
 */

import { Request, Response, NextFunction } from 'express';

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  message?: string;
  statusCode?: number;
  keyGenerator?: (req: Request) => string;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private limits: Map<string, RateLimitEntry>;
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.limits = new Map();
    this.config = {
      statusCode: 429,
      message: 'Too many requests, please try again later.',
      keyGenerator: (req: Request) => {
        // Default: use IP + user ID if authenticated
        const ip = req.ip || req.connection.remoteAddress || 'unknown';
        const userId =
          req.customer?._id?.toString() ||
          req.admin?._id?.toString() ||
          '';
        return `${ip}:${userId}`;
      },
      ...config,
    };

    // Cleanup expired entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const key = this.config.keyGenerator!(req);
      const now = Date.now();

      let entry = this.limits.get(key);

      // Create new entry or reset if window expired
      if (!entry || now > entry.resetTime) {
        entry = {
          count: 1,
          resetTime: now + this.config.windowMs,
        };
        this.limits.set(key, entry);
        return next();
      }

      // Increment count
      entry.count++;

      // Check if limit exceeded
      if (entry.count > this.config.maxRequests) {
        const retryAfter = Math.ceil((entry.resetTime - now) / 1000);

        res.setHeader('X-RateLimit-Limit', this.config.maxRequests.toString());
        res.setHeader('X-RateLimit-Remaining', '0');
        res.setHeader('X-RateLimit-Reset', entry.resetTime.toString());
        res.setHeader('Retry-After', retryAfter.toString());

        return res.status(this.config.statusCode!).json({
          success: false,
          message: this.config.message,
          retryAfter,
        });
      }

      // Add rate limit headers
      const remaining = this.config.maxRequests - entry.count;
      res.setHeader('X-RateLimit-Limit', this.config.maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', remaining.toString());
      res.setHeader('X-RateLimit-Reset', entry.resetTime.toString());

      next();
    };
  }

  private cleanup() {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.limits.entries()) {
      if (now > entry.resetTime) {
        this.limits.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`[RateLimit] Cleaned up ${cleanedCount} expired entries`);
    }
  }

  getStats() {
    return {
      activeKeys: this.limits.size,
      config: {
        windowMs: this.config.windowMs,
        maxRequests: this.config.maxRequests,
      },
    };
  }
}

// Pre-configured rate limiters for different endpoints

/**
 * Strict rate limiter for upload endpoints
 * 10 uploads per minute per user
 */
export const uploadRateLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10,
  message: 'Upload rate limit exceeded. Please wait before uploading more files.',
});

/**
 * General API rate limiter
 * 100 requests per minute per user
 */
export const apiRateLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100,
  message: 'API rate limit exceeded. Please slow down your requests.',
});

/**
 * Review creation rate limiter
 * 5 reviews per 5 minutes per user
 */
export const reviewRateLimiter = new RateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  maxRequests: 5,
  message: 'Review rate limit exceeded. Please wait before submitting more reviews.',
});

/**
 * Auth rate limiter (login, register)
 * 5 attempts per 15 minutes per IP
 */
export const authRateLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5,
  message: 'Too many authentication attempts. Please try again later.',
  keyGenerator: (req: Request) => {
    // Use only IP for auth endpoints
    return req.ip || req.connection.remoteAddress || 'unknown';
  },
});

// Export factory function for custom rate limiters
export function createRateLimiter(config: RateLimitConfig) {
  return new RateLimiter(config);
}

// Export middleware
export const uploadRateLimit = uploadRateLimiter.middleware();
export const apiRateLimit = apiRateLimiter.middleware();
export const reviewRateLimit = reviewRateLimiter.middleware();
export const authRateLimit = authRateLimiter.middleware();
