import NodeCache from 'node-cache';

/**
 * High-performance in-memory cache for table data
 * Optimized for sub-30ms response times
 */

// Table cache with aggressive TTL for real-time updates
export const tableCache = new NodeCache({
  stdTTL: 30, // 30 seconds default - WebSocket provides real-time updates
  checkperiod: 10, // Check for expired keys every 10 seconds
  useClones: false, // Performance optimization - no deep cloning
  maxKeys: 10000, // Support up to 10k cached table entries
});

/**
 * Cache key generators for table data
 */
export const CacheKeys = {
  // All tables for a restaurant
  tables: (restaurantId: string, includeInactive: boolean = false) =>
    `tables:${restaurantId}:${includeInactive ? 'all' : 'active'}`,

  // Single table by ID
  table: (tableId: string) => `table:${tableId}`,

  // Table status (lightweight)
  tableStatus: (tableId: string) => `table:status:${tableId}`,

  // Available tables query
  availableTables: (restaurantId: string, minCapacity?: number) =>
    minCapacity
      ? `tables:available:${restaurantId}:capacity:${minCapacity}`
      : `tables:available:${restaurantId}`,

  // Table count for a restaurant
  tableCount: (restaurantId: string) => `tables:count:${restaurantId}`,

  // Occupied tables count
  occupiedCount: (restaurantId: string) => `tables:occupied:${restaurantId}`,
};

/**
 * Cache invalidation helper
 * Called whenever table data changes (create, update, delete)
 */
export const invalidateTableCache = (restaurantId: string, tableId?: string) => {
  // Invalidate all listing caches for this restaurant
  const listingKeys = [
    CacheKeys.tables(restaurantId, false),
    CacheKeys.tables(restaurantId, true),
    CacheKeys.tableCount(restaurantId),
    CacheKeys.occupiedCount(restaurantId),
  ];

  listingKeys.forEach(key => tableCache.del(key));

  // Invalidate all available tables queries (with different capacity filters)
  const allKeys = tableCache.keys();
  allKeys.forEach(key => {
    if (key.startsWith(`tables:available:${restaurantId}`)) {
      tableCache.del(key);
    }
  });

  // If specific table ID provided, invalidate that table's cache
  if (tableId) {
    tableCache.del(CacheKeys.table(tableId));
    tableCache.del(CacheKeys.tableStatus(tableId));
  }

  console.log(`[TableCache] Invalidated cache for restaurant: ${restaurantId}${tableId ? ` (table: ${tableId})` : ''}`);
};

/**
 * Bulk cache invalidation for multiple tables
 */
export const invalidateTablesCacheBulk = (restaurantId: string, tableIds: string[]) => {
  // Invalidate listing caches
  invalidateTableCache(restaurantId);

  // Invalidate individual table caches
  tableIds.forEach(tableId => {
    tableCache.del(CacheKeys.table(tableId));
    tableCache.del(CacheKeys.tableStatus(tableId));
  });

  console.log(`[TableCache] Bulk invalidated ${tableIds.length} tables for restaurant: ${restaurantId}`);
};

/**
 * Pre-warm table cache for a restaurant
 * Call this when restaurant starts operations
 */
export const prewarmTableCache = async (restaurantId: string, Table: any) => {
  try {
    console.log(`[TableCache] Pre-warming cache for restaurant: ${restaurantId}`);

    // Load all active tables
    const tables = await Table.find({
      restaurantId,
      isActive: true,
    })
      .select('_id restaurantId tableNumber capacity location isActive isOccupied')
      .sort({ tableNumber: 1 })
      .lean()
      .exec();

    // Cache the list
    tableCache.set(CacheKeys.tables(restaurantId, false), tables, 60);

    // Cache individual tables
    tables.forEach((table: any) => {
      tableCache.set(CacheKeys.table(table._id.toString()), table, 60);
    });

    // Cache counts
    const occupiedCount = tables.filter((t: any) => t.isOccupied).length;
    tableCache.set(CacheKeys.tableCount(restaurantId), tables.length, 60);
    tableCache.set(CacheKeys.occupiedCount(restaurantId), occupiedCount, 60);

    console.log(`[TableCache] Pre-warmed ${tables.length} tables for restaurant: ${restaurantId}`);
    return { success: true, count: tables.length };
  } catch (error) {
    console.error('[TableCache] Pre-warm failed:', error);
    return { success: false, error };
  }
};

/**
 * Clear all table caches (for testing or deployment)
 */
export const clearTableCache = () => {
  tableCache.flushAll();
  console.log('[TableCache] All caches cleared');
};

/**
 * Get cache statistics for monitoring
 */
export const getTableCacheStats = () => {
  const stats = tableCache.getStats();
  return {
    ...stats,
    hitRate: stats.hits / (stats.hits + stats.misses) || 0,
    size: tableCache.keys().length,
  };
};

/**
 * Helper function to wrap table queries with caching
 */
export async function withTableCache<T>(
  key: string,
  ttl: number,
  fetchFn: () => Promise<T>
): Promise<{ data: T; cached: boolean }> {
  // Try to get from cache first
  const cached = tableCache.get<T>(key);

  if (cached !== undefined) {
    return { data: cached, cached: true };
  }

  // Fetch fresh data
  const data = await fetchFn();

  // Store in cache
  tableCache.set(key, data, ttl);

  return { data, cached: false };
}
