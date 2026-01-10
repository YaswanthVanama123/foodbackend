import Redis from 'ioredis';

// Redis client instance
let redisClient: Redis | null = null;

// Initialize Redis client
export const initRedis = (): Redis | null => {
  try {
    if (redisClient) {
      return redisClient;
    }

    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        if (times > 3) {
          console.warn('Redis connection failed after 3 retries. Running without cache.');
          return null;
        }
        return Math.min(times * 200, 1000);
      },
      lazyConnect: true,
    });

    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      console.log('Redis Client Connected');
    });

    // Attempt to connect
    redisClient.connect().catch((err) => {
      console.warn('Redis connection failed. Running without cache:', err.message);
      redisClient = null;
    });

    return redisClient;
  } catch (error) {
    console.warn('Failed to initialize Redis. Running without cache:', error);
    return null;
  }
};

// Get Redis client instance
export const getRedisClient = (): Redis | null => {
  if (!redisClient) {
    return initRedis();
  }
  return redisClient;
};

// Cache configuration
export const CACHE_TTL = {
  MENU_LIST: 300, // 5 minutes
  MENU_ITEM: 300, // 5 minutes
  MENU_STATS: 300, // 5 minutes
  MENU_PAGE_DATA: 300, // 5 minutes
};

// Cache key prefixes
export const CACHE_KEYS = {
  MENU_LIST: (restaurantId: string, filters: string) => `menu:list:${restaurantId}:${filters}`,
  MENU_ITEM: (restaurantId: string, itemId: string) => `menu:item:${restaurantId}:${itemId}`,
  MENU_CATEGORY: (restaurantId: string, categoryId: string, filters: string) =>
    `menu:category:${restaurantId}:${categoryId}:${filters}`,
  MENU_STATS: (restaurantId: string) => `menu:stats:${restaurantId}`,
  MENU_PAGE_DATA: (restaurantId: string, filters: string) => `menu:page:${restaurantId}:${filters}`,
  ADMIN_MENU_PAGE_DATA: (restaurantId: string) => `admin:menu:page:${restaurantId}`,
};

// Get cached data
export const getCached = async <T>(key: string): Promise<T | null> => {
  try {
    const client = getRedisClient();
    if (!client || !client.status || client.status !== 'ready') {
      return null;
    }

    const cached = await client.get(key);
    if (!cached) {
      return null;
    }

    return JSON.parse(cached) as T;
  } catch (error) {
    console.error('Cache get error:', error);
    return null;
  }
};

// Set cached data
export const setCached = async (key: string, data: any, ttl: number): Promise<void> => {
  try {
    const client = getRedisClient();
    if (!client || !client.status || client.status !== 'ready') {
      return;
    }

    await client.setex(key, ttl, JSON.stringify(data));
  } catch (error) {
    console.error('Cache set error:', error);
  }
};

// Invalidate cache by pattern
export const invalidateCache = async (pattern: string): Promise<void> => {
  try {
    const client = getRedisClient();
    if (!client || !client.status || client.status !== 'ready') {
      return;
    }

    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(...keys);
    }
  } catch (error) {
    console.error('Cache invalidation error:', error);
  }
};

// Invalidate all menu-related cache for a restaurant
export const invalidateMenuCache = async (restaurantId: string): Promise<void> => {
  await invalidateCache(`menu:*:${restaurantId}:*`);
  await invalidateCache(`menu:*:${restaurantId}`);
  await invalidateCache(`admin:menu:page:${restaurantId}`); // Admin menu page cache
};

// Invalidate specific menu item cache
export const invalidateMenuItemCache = async (restaurantId: string, itemId: string): Promise<void> => {
  await invalidateCache(`menu:item:${restaurantId}:${itemId}`);
  await invalidateMenuCache(restaurantId); // Also invalidate list caches
};

// Close Redis connection
export const closeRedis = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
};
