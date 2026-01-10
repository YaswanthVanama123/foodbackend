import { Request, Response, NextFunction } from 'express';
import { RedisCache, CacheKeys } from '../config/redis';

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  message?: string; // Custom error message
  skipSuccessfulRequests?: boolean; // Don't count successful requests
}

/**
 * Redis-based rate limiter
 * More efficient than in-memory rate limiters for distributed systems
 */
export class RateLimiter {
  /**
   * Create a rate limit middleware
   */
  static create(config: RateLimitConfig) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        // Generate identifier (IP + user ID if available)
        const identifier = this.getIdentifier(req);
        const action = req.path;
        const key = CacheKeys.rateLimit(identifier, action);

        // Get current count
        const current = await RedisCache.incr(key);

        // Set expiration on first request
        if (current === 1) {
          await RedisCache.expire(key, Math.ceil(config.windowMs / 1000));
        }

        // Check if limit exceeded
        if (current > config.maxRequests) {
          const ttl = await RedisCache.ttl(key);
          res.status(429).json({
            success: false,
            message: config.message || 'Too many requests. Please try again later.',
            retryAfter: ttl,
          });
          return;
        }

        // Add rate limit headers
        res.setHeader('X-RateLimit-Limit', config.maxRequests);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, config.maxRequests - current));
        res.setHeader('X-RateLimit-Reset', Date.now() + (await RedisCache.ttl(key)) * 1000);

        next();
      } catch (error) {
        // On Redis error, allow request (fail open)
        console.error('Rate limiter error:', error);
        next();
      }
    };
  }

  /**
   * Get unique identifier for request
   */
  private static getIdentifier(req: Request): string {
    // Use customer ID if authenticated, otherwise use IP
    const customerId = req.customer?._id?.toString();
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    return customerId || ip;
  }

  /**
   * Check rate limit without incrementing
   */
  static async check(identifier: string, action: string, maxRequests: number): Promise<boolean> {
    try {
      const key = CacheKeys.rateLimit(identifier, action);
      const current = (await RedisCache.get<number>(key)) || 0;
      return current < maxRequests;
    } catch (error) {
      console.error('Rate limit check error:', error);
      return true; // Fail open
    }
  }

  /**
   * Reset rate limit for identifier
   */
  static async reset(identifier: string, action: string): Promise<void> {
    const key = CacheKeys.rateLimit(identifier, action);
    await RedisCache.del(key);
  }
}

// Predefined rate limiters
export const loginRateLimiter = RateLimiter.create({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10, // 10 login attempts per 15 minutes
  message: 'Too many login attempts. Please try again in 15 minutes.',
});

export const registerRateLimiter = RateLimiter.create({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 5, // 5 registrations per hour per IP
  message: 'Too many registration attempts. Please try again later.',
});

export const cartRateLimiter = RateLimiter.create({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 30, // 30 cart operations per minute
  message: 'Too many cart operations. Please slow down.',
});

export const apiRateLimiter = RateLimiter.create({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // 100 requests per minute
  message: 'Too many requests. Please slow down.',
});
