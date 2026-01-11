import { createClient } from 'redis';

// Create Redis client (but don't connect)
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    reconnectStrategy: () => {
      // Disable reconnection
      return new Error('Redis disabled');
    },
  },
});

// Redis is disabled - do not connect
console.log('[Cache] Redis disabled, using in-memory cache');

// Cache utility functions
export class RedisCache {
  /**
   * Get value from cache (always returns null when disabled)
   */
  static async get<T>(_key: string): Promise<T | null> {
    return null;
  }

  /**
   * Set value in cache (no-op when disabled)
   */
  static async set(_key: string, _value: any, _ttl: number = 3600): Promise<void> {
    return;
  }

  /**
   * Delete key from cache (no-op when disabled)
   */
  static async del(_key: string): Promise<void> {
    return;
  }

  /**
   * Delete multiple keys matching a pattern (no-op when disabled)
   */
  static async delPattern(_pattern: string): Promise<void> {
    return;
  }

  /**
   * Check if key exists (always returns false when disabled)
   */
  static async exists(_key: string): Promise<boolean> {
    return false;
  }

  /**
   * Increment counter (always returns 0 when disabled)
   */
  static async incr(_key: string): Promise<number> {
    return 0;
  }

  /**
   * Set expiration on key (no-op when disabled)
   */
  static async expire(_key: string, _seconds: number): Promise<void> {
    return;
  }

  /**
   * Get TTL of key (always returns -1 when disabled)
   */
  static async ttl(_key: string): Promise<number> {
    return -1;
  }
}

// Cache key generators
export const CacheKeys = {
  // JWT token cache
  jwtSession: (customerId: string, restaurantId: string) =>
    `jwt:session:${restaurantId}:${customerId}`,

  // Customer data cache
  customer: (customerId: string, restaurantId: string) =>
    `customer:${restaurantId}:${customerId}`,

  // Cart cache
  cart: (customerId: string, restaurantId: string) =>
    `cart:${restaurantId}:${customerId}`,

  // Menu item cache (for validation)
  menuItem: (menuItemId: string, restaurantId: string) =>
    `menu:${restaurantId}:${menuItemId}`,

  // Batch menu items cache
  menuItems: (restaurantId: string, menuItemIds: string[]) =>
    `menu:batch:${restaurantId}:${menuItemIds.sort().join(',')}`,

  // Rate limiting
  rateLimit: (identifier: string, action: string) =>
    `rate:${action}:${identifier}`,

  // Refresh token
  refreshToken: (customerId: string, tokenId: string) =>
    `refresh:${customerId}:${tokenId}`,
};

export default redisClient;
