import { createClient } from 'redis';

// Create Redis client
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    reconnectStrategy: (retries: number) => {
      if (retries > 10) {
        return new Error('Redis connection failed after 10 retries');
      }
      return Math.min(retries * 100, 3000);
    },
  },
});

// Error handling
redisClient.on('error', (err: Error) => {
  console.error('Redis Client Error:', err);
});

redisClient.on('connect', () => {
  console.log('Redis Client Connected');
});

// Connect to Redis
let isRedisConnected = false;

(async () => {
  try {
    await redisClient.connect();
    isRedisConnected = true;
    console.log('✅ Redis connected successfully');
  } catch (error) {
    console.warn('⚠️  Redis connection failed. Running without Redis cache.');
    console.warn('   Install Redis or set REDIS_URL to enable caching.');
    isRedisConnected = false;
  }
})();

// Cache utility functions
export class RedisCache {
  /**
   * Get value from cache
   */
  static async get<T>(key: string): Promise<T | null> {
    if (!isRedisConnected) return null;

    try {
      const value = await redisClient.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error(`Redis GET error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set value in cache with expiration
   * @param key Cache key
   * @param value Value to cache
   * @param ttl Time to live in seconds (default: 3600 = 1 hour)
   */
  static async set(key: string, value: any, ttl: number = 3600): Promise<void> {
    if (!isRedisConnected) return;

    try {
      await redisClient.setEx(key, ttl, JSON.stringify(value));
    } catch (error) {
      console.error(`Redis SET error for key ${key}:`, error);
    }
  }

  /**
   * Delete key from cache
   */
  static async del(key: string): Promise<void> {
    if (!isRedisConnected) return;

    try {
      await redisClient.del(key);
    } catch (error) {
      console.error(`Redis DEL error for key ${key}:`, error);
    }
  }

  /**
   * Delete multiple keys matching a pattern
   */
  static async delPattern(pattern: string): Promise<void> {
    if (!isRedisConnected) return;

    try {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await redisClient.del(keys);
      }
    } catch (error) {
      console.error(`Redis DEL pattern error for ${pattern}:`, error);
    }
  }

  /**
   * Check if key exists
   */
  static async exists(key: string): Promise<boolean> {
    if (!isRedisConnected) return false;

    try {
      const exists = await redisClient.exists(key);
      return exists === 1;
    } catch (error) {
      console.error(`Redis EXISTS error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Increment counter (for rate limiting)
   */
  static async incr(key: string): Promise<number> {
    if (!isRedisConnected) return 0;

    try {
      return await redisClient.incr(key);
    } catch (error) {
      console.error(`Redis INCR error for key ${key}:`, error);
      return 0;
    }
  }

  /**
   * Set expiration on key
   */
  static async expire(key: string, seconds: number): Promise<void> {
    if (!isRedisConnected) return;

    try {
      await redisClient.expire(key, seconds);
    } catch (error) {
      console.error(`Redis EXPIRE error for key ${key}:`, error);
    }
  }

  /**
   * Get TTL of key
   */
  static async ttl(key: string): Promise<number> {
    if (!isRedisConnected) return -1;

    try {
      return await redisClient.ttl(key);
    } catch (error) {
      console.error(`Redis TTL error for key ${key}:`, error);
      return -1;
    }
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
