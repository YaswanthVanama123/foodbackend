import Restaurant from '../models/Restaurant';
import { prewarmCache, getCacheStats } from './cache';

/**
 * Initialize and pre-warm caches on server startup
 * OPTIMIZATION 10: Pre-load restaurant config on server start
 */
export const initializeCache = async () => {
  try {
    console.log('===========================================');
    console.log('🔥 Initializing Cache System...');
    console.log('===========================================');

    // Pre-warm restaurant cache
    const result = await prewarmCache(Restaurant);

    if (result.success) {
      console.log(`✅ Successfully pre-warmed ${result.cached} restaurants`);
    } else {
      console.error('❌ Cache pre-warming failed:', result.error);
    }

    // Display cache statistics
    const stats = getCacheStats();
    console.log('\n📊 Cache Statistics:');
    console.log(`   Restaurant Cache: ${stats.restaurant.keys} keys`);
    console.log(`   Category Cache: ${stats.category.keys} keys`);
    console.log(`   Subdomain Cache: ${stats.subdomain.keys} keys`);
    console.log('===========================================\n');

    return result.success;
  } catch (error) {
    console.error('❌ Cache initialization failed:', error);
    return false;
  }
};

/**
 * Monitor cache performance (call periodically)
 */
export const monitorCache = () => {
  const stats = getCacheStats();

  console.log('\n📈 Cache Performance Monitor:');
  console.log('-------------------------------------------');

  // Restaurant cache stats
  const restStats = stats.restaurant;
  console.log(`Restaurant Cache:`);
  console.log(`  Keys: ${restStats.keys}`);
  console.log(`  Hits: ${restStats.hits} | Misses: ${restStats.misses}`);
  console.log(`  Hit Rate: ${restStats.hits > 0 ? ((restStats.hits / (restStats.hits + restStats.misses)) * 100).toFixed(2) : 0}%`);

  // Category cache stats
  const catStats = stats.category;
  console.log(`\nCategory Cache:`);
  console.log(`  Keys: ${catStats.keys}`);
  console.log(`  Hits: ${catStats.hits} | Misses: ${catStats.misses}`);
  console.log(`  Hit Rate: ${catStats.hits > 0 ? ((catStats.hits / (catStats.hits + catStats.misses)) * 100).toFixed(2) : 0}%`);

  // Subdomain cache stats
  const subStats = stats.subdomain;
  console.log(`\nSubdomain Cache:`);
  console.log(`  Keys: ${subStats.keys}`);
  console.log(`  Hits: ${subStats.hits} | Misses: ${subStats.misses}`);
  console.log(`  Hit Rate: ${subStats.hits > 0 ? ((subStats.hits / (subStats.hits + subStats.misses)) * 100).toFixed(2) : 0}%`);

  console.log('-------------------------------------------\n');
};
