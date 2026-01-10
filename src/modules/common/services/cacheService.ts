/**
 * Cache Service with Redis support and in-memory fallback
 * Uses Redis for production with automatic fallback to in-memory LRU cache
 *
 * Features:
 * - Redis support for distributed caching (automatic fallback)
 * - LRU (Least Recently Used) eviction policy for in-memory
 * - TTL (Time To Live) support
 * - Pattern-based invalidation
 * - Memory limit protection
 * - Kitchen display order caching (10s refresh)
 */

import Redis from 'ioredis';

interface CacheEntry<T> {
  value: T;
  expiry: number;
  accessCount: number;
  lastAccessed: number;
}

class CacheService {
  private cache: Map<string, CacheEntry<any>>;
  private redis: Redis | null = null;
  private isRedisEnabled: boolean = false;
  private maxSize: number;
  private defaultTTL: number; // milliseconds

  constructor(maxSize: number = 1000, defaultTTL: number = 300000) {
    // Default 5 minutes
    this.cache = new Map();
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
    this.initializeRedis();
  }

  /**
   * Initialize Redis connection with graceful fallback
   */
  private initializeRedis(): void {
    if (!process.env.REDIS_ENABLED || process.env.REDIS_ENABLED === 'false') {
      console.log('[Cache] Redis disabled, using in-memory cache');
      return;
    }

    try {
      this.redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0'),
        keyPrefix: 'patlinks:',
        retryStrategy: (times) => {
          if (times > 3) {
            console.warn('[Cache] Redis connection failed after 3 retries, using in-memory fallback');
            this.isRedisEnabled = false;
            return null;
          }
          return Math.min(times * 100, 3000);
        },
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });

      this.redis.on('connect', () => {
        console.log('[Cache] Redis connected successfully');
        this.isRedisEnabled = true;
      });

      this.redis.on('error', (err) => {
        console.error('[Cache] Redis error:', err.message);
        this.isRedisEnabled = false;
      });

      this.redis.connect().catch((err) => {
        console.warn('[Cache] Redis connection failed, using in-memory fallback:', err.message);
        this.isRedisEnabled = false;
      });
    } catch (error: any) {
      console.error('[Cache] Redis initialization error, using in-memory fallback:', error.message);
      this.isRedisEnabled = false;
    }
  }

  /**
   * Set a value in cache (Redis with in-memory fallback)
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const ttlMs = ttl || this.defaultTTL;
    const ttlSeconds = Math.ceil(ttlMs / 1000);

    try {
      if (this.isRedisEnabled && this.redis) {
        await this.redis.setex(key, ttlSeconds, JSON.stringify(value));
      } else {
        // In-memory fallback
        const expiryTime = Date.now() + ttlMs;

        // Evict oldest entry if cache is full
        if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
          this.evictLRU();
        }

        this.cache.set(key, {
          value,
          expiry: expiryTime,
          accessCount: 0,
          lastAccessed: Date.now(),
        });
      }
    } catch (error: any) {
      console.error('[Cache] Set error:', error.message);
      // Fallback to in-memory
      const expiryTime = Date.now() + ttlMs;
      if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
        this.evictLRU();
      }
      this.cache.set(key, {
        value,
        expiry: expiryTime,
        accessCount: 0,
        lastAccessed: Date.now(),
      });
    }
  }

  /**
   * Get a value from cache (Redis with in-memory fallback)
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      if (this.isRedisEnabled && this.redis) {
        const data = await this.redis.get(key);
        return data ? JSON.parse(data) : null;
      } else {
        // In-memory fallback
        const entry = this.cache.get(key);

        if (!entry) {
          return null;
        }

        // Check if expired
        if (Date.now() > entry.expiry) {
          this.cache.delete(key);
          return null;
        }

        // Update access statistics
        entry.accessCount++;
        entry.lastAccessed = Date.now();

        return entry.value as T;
      }
    } catch (error: any) {
      console.error('[Cache] Get error:', error.message);
      return null;
    }
  }

  /**
   * Get or compute value (with callback)
   */
  async getOrSet<T>(
    key: string,
    computeFn: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = this.get<T>(key);

    if (cached !== null) {
      return cached as T;
    }

    const value = await computeFn();
    this.set(key, value, ttl);
    return value;
  }

  /**
   * Delete a specific key (Redis with in-memory fallback)
   */
  async delete(key: string): Promise<boolean> {
    try {
      if (this.isRedisEnabled && this.redis) {
        await this.redis.del(key);
        return true;
      } else {
        return this.cache.delete(key);
      }
    } catch (error: any) {
      console.error('[Cache] Delete error:', error.message);
      return false;
    }
  }

  /**
   * Delete all keys matching a pattern (Redis with in-memory fallback)
   */
  async deletePattern(pattern: string): Promise<number> {
    try {
      if (this.isRedisEnabled && this.redis) {
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
        return keys.length;
      } else {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        let deletedCount = 0;

        for (const key of this.cache.keys()) {
          if (regex.test(key)) {
            this.cache.delete(key);
            deletedCount++;
          }
        }

        return deletedCount;
      }
    } catch (error: any) {
      console.error('[Cache] DeletePattern error:', error.message);
      return 0;
    }
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Clean up expired entries
   */
  cleanup(): number {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const now = Date.now();
    let expiredCount = 0;
    let totalAccessCount = 0;

    for (const entry of this.cache.values()) {
      if (now > entry.expiry) {
        expiredCount++;
      }
      totalAccessCount += entry.accessCount;
    }

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      expiredCount,
      averageAccessCount:
        this.cache.size > 0 ? totalAccessCount / this.cache.size : 0,
    };
  }
}

// Create singleton instance
const cacheService = new CacheService(
  parseInt(process.env.CACHE_MAX_SIZE || '1000'),
  parseInt(process.env.CACHE_DEFAULT_TTL || '300000')
);

// Cleanup expired entries every minute
setInterval(() => {
  const cleaned = cacheService.cleanup();
  if (cleaned > 0) {
    console.log(`[Cache] Cleaned up ${cleaned} expired entries`);
  }
}, 60000);

export default cacheService;

/**
 * Cache key generators for consistent naming
 */
export const CacheKeys = {
  // Kitchen display caches
  kitchenOrders: (restaurantId: string) => `kitchen:orders:${restaurantId}`,
  kitchenStats: (restaurantId: string) => `kitchen:stats:${restaurantId}`,

  // Search caches
  menuSearch: (restaurantId: string, query: string, filters: string) =>
    `search:menu:${restaurantId}:${query}:${filters}`,
  orderSearch: (restaurantId: string, query: string, filters: string) =>
    `search:orders:${restaurantId}:${query}:${filters}`,
  menuFilter: (restaurantId: string, filters: string, page: number) =>
    `filter:menu:${restaurantId}:${filters}:${page}`,
  dietaryOptions: (restaurantId: string) => `dietary:${restaurantId}`,
  priceRange: (restaurantId: string) => `pricerange:${restaurantId}`,
  searchSuggestions: (restaurantId: string, prefix: string) =>
    `suggestions:${restaurantId}:${prefix}`,

  // Review caches
  reviewList: (restaurantId: string, filters: any) =>
    `review:list:${restaurantId}:${JSON.stringify(filters)}`,
  reviewRatings: (restaurantId: string, menuItemId?: string) =>
    menuItemId
      ? `review:ratings:${restaurantId}:${menuItemId}`
      : `review:ratings:${restaurantId}`,
  reviewAggregation: (restaurantId: string, menuItemId: string) =>
    `review:agg:${restaurantId}:${menuItemId}`,

  // Plan caches (rarely change - long TTL)
  planList: (filters: any) => `plan:list:${JSON.stringify(filters)}`,
  planById: (planId: string) => `plan:id:${planId}`,
  activePlans: () => `plan:active:list`,
  allPlans: () => `plan:all:list`,

  // Subscription caches
  subscriptionList: (filters: any) => `subscription:list:${JSON.stringify(filters)}`,
  subscriptionById: (subscriptionId: string) => `subscription:id:${subscriptionId}`,
  subscriptionByRestaurant: (restaurantId: string) => `subscription:restaurant:${restaurantId}`,
  activeSubscription: (restaurantId: string) => `subscription:active:${restaurantId}`,
  subscriptionStats: (filters: any) => `subscription:stats:${JSON.stringify(filters)}`,
  billingHistory: (restaurantId: string) => `subscription:billing:${restaurantId}`,

  // Home page combined data cache (short TTL for real-time updates)
  homePageData: (restaurantId: string) => `home:data:${restaurantId}`,

  // Patterns for invalidation
  kitchenPattern: (restaurantId: string) => `kitchen:*:${restaurantId}*`,
  searchPattern: (restaurantId: string) => `search:*:${restaurantId}*`,
  filterPattern: (restaurantId: string) => `filter:*:${restaurantId}*`,
  reviewPattern: (restaurantId: string) => `review:*:${restaurantId}*`,
  reviewItemPattern: (restaurantId: string, menuItemId: string) =>
    `review:*:${restaurantId}*${menuItemId}*`,
  planPattern: () => `plan:*`,
  subscriptionPattern: (restaurantId?: string) =>
    restaurantId ? `subscription:*:${restaurantId}*` : `subscription:*`,
  allRestaurantPattern: (restaurantId: string) => `*:${restaurantId}*`,
};
