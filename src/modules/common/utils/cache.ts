import NodeCache from 'node-cache';

/**
 * Advanced in-memory cache utility with TTL support
 * Optimized for restaurant settings and category data
 */

// Restaurant settings cache - Long TTL (rarely changes)
export const restaurantCache = new NodeCache({
  stdTTL: 3600, // 1 hour default
  checkperiod: 600, // Check for expired keys every 10 minutes
  useClones: false, // Performance optimization - no cloning
  maxKeys: 1000, // Limit max restaurants in cache
});

// Category cache - Medium TTL (changes moderately)
export const categoryCache = new NodeCache({
  stdTTL: 300, // 5 minutes default
  checkperiod: 60, // Check for expired keys every minute
  useClones: false,
  maxKeys: 5000, // Limit max categories in cache
});

// Subdomain to Restaurant ID mapping cache - Very long TTL
export const subdomainCache = new NodeCache({
  stdTTL: 7200, // 2 hours
  checkperiod: 600,
  useClones: false,
  maxKeys: 1000,
});

// Platform analytics cache - Medium TTL (for super admin dashboards)
export const analyticsCache = new NodeCache({
  stdTTL: 300, // 5 minutes default
  checkperiod: 60, // Check for expired keys every minute
  useClones: false,
  maxKeys: 100, // Limit analytics entries
});

/**
 * Cache key generators
 */
export const CacheKeys = {
  // Restaurant keys
  restaurant: (id: string) => `restaurant:${id}`,
  restaurantSettings: (id: string) => `restaurant:settings:${id}`,
  restaurantBranding: (id: string) => `restaurant:branding:${id}`,
  restaurantBySubdomain: (subdomain: string) => `restaurant:subdomain:${subdomain}`,

  // Category keys
  categories: (restaurantId: string, includeInactive = false) =>
    `categories:${restaurantId}:${includeInactive ? 'all' : 'active'}`,
  category: (id: string) => `category:${id}`,
  categoryTree: (restaurantId: string) => `categories:tree:${restaurantId}`,

  // Analytics keys
  globalAnalytics: () => 'analytics:global',
  platformRevenue: (startDate: string, endDate: string) => `analytics:revenue:${startDate}:${endDate}`,
  platformStats: () => 'analytics:stats',
  restaurantGrowth: () => 'analytics:growth',
  topRestaurants: () => 'analytics:top-restaurants',
};

/**
 * Cache invalidation helpers
 */
export const invalidateRestaurantCache = (restaurantId: string) => {
  const keys = [
    CacheKeys.restaurant(restaurantId),
    CacheKeys.restaurantSettings(restaurantId),
    CacheKeys.restaurantBranding(restaurantId),
  ];

  keys.forEach(key => restaurantCache.del(key));

  // Also invalidate subdomain cache - we don't know the subdomain here
  // so we clear all subdomain mappings for this restaurant
  const allKeys = subdomainCache.keys();
  allKeys.forEach((key: string) => {
    const value = subdomainCache.get(key);
    if (value === restaurantId) {
      subdomainCache.del(key);
    }
  });
};

export const invalidateCategoryCache = (restaurantId: string, categoryId?: string) => {
  // Clear all category lists for this restaurant
  const keys = [
    CacheKeys.categories(restaurantId, false),
    CacheKeys.categories(restaurantId, true),
    CacheKeys.categoryTree(restaurantId),
  ];

  if (categoryId) {
    keys.push(CacheKeys.category(categoryId));
  }

  keys.forEach(key => categoryCache.del(key));
};

export const invalidateAnalyticsCache = () => {
  // Clear all analytics cache
  const keys = [
    CacheKeys.globalAnalytics(),
    CacheKeys.platformStats(),
    CacheKeys.restaurantGrowth(),
    CacheKeys.topRestaurants(),
  ];

  keys.forEach(key => analyticsCache.del(key));

  // Also clear revenue cache entries
  analyticsCache.keys().forEach((key: string) => {
    if (key.startsWith('analytics:revenue:')) {
      analyticsCache.del(key);
    }
  });
};

/**
 * Cache statistics for monitoring
 */
export const getCacheStats = () => {
  return {
    restaurant: restaurantCache.getStats(),
    category: categoryCache.getStats(),
    subdomain: subdomainCache.getStats(),
    analytics: analyticsCache.getStats(),
  };
};

/**
 * Clear all caches (useful for testing or deployment)
 */
export const clearAllCaches = () => {
  restaurantCache.flushAll();
  categoryCache.flushAll();
  subdomainCache.flushAll();
  analyticsCache.flushAll();
};

/**
 * Pre-warm cache function (call on server start)
 */
export const prewarmCache = async (Restaurant: any) => {
  try {
    console.log('[Cache] Pre-warming restaurant cache...');

    // Load all active restaurants with minimal data
    const restaurants = await Restaurant.find({ isActive: true })
      .select('_id subdomain name branding settings')
      .lean()
      .exec();

    let cached = 0;
    for (const restaurant of restaurants) {
      const id = restaurant._id.toString();

      // Cache full restaurant
      restaurantCache.set(CacheKeys.restaurant(id), restaurant, 3600);

      // Cache subdomain mapping
      subdomainCache.set(
        CacheKeys.restaurantBySubdomain(restaurant.subdomain),
        id,
        7200
      );

      // Cache settings separately for faster access
      if (restaurant.settings) {
        restaurantCache.set(
          CacheKeys.restaurantSettings(id),
          restaurant.settings,
          3600
        );
      }

      // Cache branding separately (without logo buffers if any)
      if (restaurant.branding) {
        restaurantCache.set(
          CacheKeys.restaurantBranding(id),
          restaurant.branding,
          3600
        );
      }

      cached++;
    }

    console.log(`[Cache] Pre-warmed ${cached} restaurants`);
    return { success: true, cached };
  } catch (error) {
    console.error('[Cache] Pre-warm failed:', error);
    return { success: false, error };
  }
};
