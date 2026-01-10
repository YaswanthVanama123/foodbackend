/**
 * In-Memory Cache Utility
 * Provides aggressive caching for frequently accessed data
 * Target: Public menu <50ms (cached), favorites <30ms
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  etag: string;
}

class CacheManager {
  private cache: Map<string, CacheEntry<any>>;
  private readonly DEFAULT_TTL = 30 * 60 * 1000; // 30 minutes in milliseconds

  constructor() {
    this.cache = new Map();

    // Cleanup expired entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Generate ETag from data for HTTP caching
   */
  private generateETag(data: any): string {
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `"${Math.abs(hash).toString(36)}"`;
  }

  /**
   * Set cache entry with TTL
   */
  set<T>(key: string, data: T, ttlMs?: number): void {
    const ttl = ttlMs || this.DEFAULT_TTL;
    const etag = this.generateETag(data);

    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttl,
      etag,
    });
  }

  /**
   * Get cache entry if not expired
   */
  get<T>(key: string): { data: T; etag: string } | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return {
      data: entry.data as T,
      etag: entry.etag,
    };
  }

  /**
   * Check if cache has valid entry
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete specific cache entry
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Delete all cache entries matching pattern
   */
  deletePattern(pattern: string | RegExp): number {
    let count = 0;
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }

    return count;
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[Cache] Cleaned ${cleaned} expired entries`);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Singleton instance
export const cache = new CacheManager();

// Cache key generators
export const CacheKeys = {
  publicMenu: (restaurantId: string) => `public:menu:${restaurantId}`,
  restaurant: (subdomain: string) => `public:restaurant:${subdomain}`,
  menuPageData: (restaurantId: string, available?: boolean) =>
    `menu:page:${restaurantId}:${available ? 'available' : 'all'}`,
  favorites: (customerId: string) => `favorites:${customerId}`,
  favoriteBatch: (customerId: string, menuItemIds: string[]) =>
    `favorites:batch:${customerId}:${menuItemIds.sort().join(',')}`,
};
