import { RedisCache } from '../config/redis';

/**
 * Enhanced Cache Utility with Redis and In-Memory Fallback
 * Provides distributed caching with request deduplication
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class CacheManager {
  private memoryCache: Map<string, CacheEntry<any>>;
  private cleanupInterval: NodeJS.Timeout;
  private pendingRequests: Map<string, Promise<any>> = new Map();

  constructor() {
    this.memoryCache = new Map();
    // Cleanup expired entries every 60 seconds
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Set a cache entry with TTL (in milliseconds for memory, seconds for Redis)
   */
  async set<T>(key: string, data: T, ttl: number = 60000): Promise<void> {
    // Store in memory cache
    this.memoryCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });

    // Store in Redis (convert ms to seconds)
    await RedisCache.set(key, data, Math.floor(ttl / 1000));
  }

  /**
   * Get a cache entry if it exists and hasn't expired
   * Tries Redis first, falls back to memory cache
   */
  async get<T>(key: string): Promise<T | null> {
    // Try Redis first
    try {
      const redisData = await RedisCache.get<T>(key);
      if (redisData !== null) {
        return redisData;
      }
    } catch (error) {
      console.error('Redis get error, falling back to memory:', error);
    }

    // Fallback to memory cache
    const entry = this.memoryCache.get(key);

    if (!entry) {
      return null;
    }

    const isExpired = Date.now() - entry.timestamp > entry.ttl;

    if (isExpired) {
      this.memoryCache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Check if a cache entry exists and is valid
   */
  async has(key: string): Promise<boolean> {
    const data = await this.get(key);
    return data !== null;
  }

  /**
   * Delete a specific cache entry
   */
  async delete(key: string): Promise<boolean> {
    await RedisCache.del(key);
    return this.memoryCache.delete(key);
  }

  /**
   * Delete all cache entries matching a pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    let deleted = 0;
    const regex = new RegExp(pattern);

    // Delete from Redis
    await RedisCache.delPattern(pattern);

    // Delete from memory cache
    for (const key of this.memoryCache.keys()) {
      if (regex.test(key)) {
        this.memoryCache.delete(key);
        deleted++;
      }
    }

    return deleted;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.memoryCache.clear();
  }

  /**
   * Request deduplication - prevents duplicate concurrent requests
   */
  async deduplicate<T>(key: string, callback: () => Promise<T>): Promise<T> {
    // Check if request is already in-flight
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key) as Promise<T>;
    }

    // Create new promise for this request
    const promise = callback()
      .finally(() => {
        // Remove from pending after completion
        this.pendingRequests.delete(key);
      });

    // Store in pending map
    this.pendingRequests.set(key, promise);

    return promise;
  }

  /**
   * Cleanup expired entries from memory cache
   */
  private cleanup(): void {
    const now = Date.now();

    for (const [key, entry] of this.memoryCache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.memoryCache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.memoryCache.size,
      keys: Array.from(this.memoryCache.keys()),
      pending: this.pendingRequests.size,
    };
  }

  /**
   * Cleanup interval on process exit
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.memoryCache.clear();
    this.pendingRequests.clear();
  }
}

// Singleton instance
export const cacheManager = new CacheManager();

// Cleanup on process exit
process.on('SIGINT', () => {
  cacheManager.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  cacheManager.destroy();
  process.exit(0);
});

/**
 * Cache key generators for different data types
 */
export const CacheKeys = {
  // Dashboard and analytics
  dashboardPageData: (restaurantId: string) => `dashboard:page-data:${restaurantId}`,
  dashboardStats: (restaurantId: string) => `dashboard:stats:${restaurantId}`,
  activeOrders: (restaurantId: string) => `dashboard:active:${restaurantId}`,

  // Orders
  ordersList: (restaurantId: string, filterKey: string) => `orders:list:${restaurantId}:${filterKey}`,

  // Kitchen
  kitchenOrders: (restaurantId: string) => `kitchen:orders:${restaurantId}`,

  revenueAnalytics: (restaurantId: string, period: string) => `analytics:revenue:${restaurantId}:${period}`,
  popularItems: (restaurantId: string, period: string, limit: number) =>
    `analytics:popular:${restaurantId}:${period}:${limit}`,
  categoryPerformance: (restaurantId: string, period: string) =>
    `analytics:category:${restaurantId}:${period}`,
  peakHours: (restaurantId: string, period: string) =>
    `analytics:peak:${restaurantId}:${period}`,
  tablePerformance: (restaurantId: string, period: string) =>
    `analytics:table:${restaurantId}:${period}`,
  preparationTime: (restaurantId: string, period: string) =>
    `analytics:prep:${restaurantId}:${period}`,
  dashboardAnalytics: (restaurantId: string) => `analytics:dashboard:${restaurantId}`,

  // Auth and tenant caching
  jwtVerification: (token: string) => `jwt:verify:${token.substring(0, 20)}`,
  adminUser: (adminId: string, restaurantId: string) => `admin:${restaurantId}:${adminId}`,
  superAdminUser: (adminId: string) => `superadmin:${adminId}`,
  customerUser: (customerId: string, restaurantId: string) => `customer:${restaurantId}:${customerId}`,
  tenant: (subdomain: string) => `tenant:${subdomain}`,
  tenantById: (restaurantId: string) => `tenant:id:${restaurantId}`,
};

/**
 * Default TTL values (in milliseconds)
 */
export const CacheTTL = {
  // Dashboard and analytics
  DASHBOARD_STATS: 60000, // 1 minute
  ACTIVE_ORDERS: 10000, // 10 seconds
  ANALYTICS_SHORT: 300000, // 5 minutes
  ANALYTICS_LONG: 900000, // 15 minutes

  // Auth and middleware (optimized for speed)
  JWT_VERIFICATION: 300000, // 5 minutes
  USER_DATA: 300000, // 5 minutes
  TENANT_DATA: 300000, // 5 minutes
};

/**
 * Helper function to wrap async functions with caching and request deduplication
 */
export async function withCache<T>(
  key: string,
  ttl: number,
  fetchFn: () => Promise<T>
): Promise<T> {
  // Try to get from cache first
  const cached = await cacheManager.get<T>(key);

  if (cached !== null) {
    return cached;
  }

  // Use request deduplication to prevent multiple concurrent fetches
  return cacheManager.deduplicate(key, async () => {
    // Fetch fresh data
    const data = await fetchFn();

    // Store in cache
    await cacheManager.set(key, data, ttl);

    return data;
  });
}
