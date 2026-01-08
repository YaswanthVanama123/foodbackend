/**
 * Cleanup Orphaned Images Script
 * Remove images from cloud storage that are no longer referenced in the database
 *
 * Usage:
 *   npm run cleanup:images
 *   ts-node src/scripts/cleanupImages.ts
 *   ts-node src/scripts/cleanupImages.ts --restaurant=restaurant-id
 *   ts-node src/scripts/cleanupImages.ts --dry-run
 */

import connectDB from '../config/database';
import {
  cleanupOrphanedImages,
  getStorageInfo,
  checkCDNHealth
} from '../utils/cdnUtils';
import Restaurant from '../models/Restaurant';
import MenuItem from '../models/MenuItem';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface CleanupStats {
  totalRestaurants: number;
  totalImagesDeleted: number;
  totalErrors: number;
  details: Array<{
    restaurant: string;
    deleted: number;
    errors: number;
  }>;
}

/**
 * Cleanup images for a single restaurant
 */
async function cleanupRestaurant(
  restaurantId: string,
  restaurantName: string,
  dryRun: boolean = false
): Promise<{ deleted: number; errors: number }> {
  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Cleaning up images for: ${restaurantName}`);
    console.log(`Restaurant ID: ${restaurantId}`);
    console.log(`${'='.repeat(60)}\n`);

    // Get all active image URLs from database
    const menuItems = await MenuItem.find({ restaurantId });
    const restaurant = await Restaurant.findById(restaurantId);

    const activeUrls: string[] = [];

    // Collect menu item images
    menuItems.forEach(item => {
      if (item.image) {
        activeUrls.push(item.image);
      }
    });

    // Collect restaurant logo
    if (restaurant?.logo) {
      activeUrls.push(restaurant.logo);
    }

    console.log(`Active images in database: ${activeUrls.length}`);

    if (dryRun) {
      console.log('\nDRY RUN MODE - No images will be deleted');
      console.log('Active URLs:');
      activeUrls.forEach(url => console.log(`  - ${url}`));
      return { deleted: 0, errors: 0 };
    }

    // Run cleanup
    const result = await cleanupOrphanedImages(restaurantId, activeUrls);

    console.log(`\nCleanup Results:`);
    console.log(`  Deleted: ${result.deleted}`);
    console.log(`  Errors: ${result.errors.length}`);

    if (result.errors.length > 0) {
      console.log(`\n  Error details:`);
      result.errors.forEach((error, index) => {
        if (index < 10) { // Show first 10 errors
          console.log(`    - ${error}`);
        }
      });
      if (result.errors.length > 10) {
        console.log(`    ... and ${result.errors.length - 10} more errors`);
      }
    }

    return {
      deleted: result.deleted,
      errors: result.errors.length
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`\nCleanup failed for ${restaurantName}:`, errorMessage);
    return {
      deleted: 0,
      errors: 1
    };
  }
}

/**
 * Main cleanup function
 */
async function main() {
  const stats: CleanupStats = {
    totalRestaurants: 0,
    totalImagesDeleted: 0,
    totalErrors: 0,
    details: []
  };

  try {
    // Check for dry-run flag
    const dryRun = process.argv.includes('--dry-run');

    if (dryRun) {
      console.log('\n⚠️  DRY RUN MODE ENABLED - No images will be deleted\n');
    }

    // Connect to database
    console.log('Connecting to database...');
    await connectDB();
    console.log('Database connected\n');

    // Check CDN health
    console.log('Checking CDN health...');
    const health = await checkCDNHealth();
    console.log(`CDN Status: ${health.message}`);
    console.log(`Provider: ${health.provider}\n`);

    if (!health.healthy) {
      throw new Error('CDN health check failed. Please check your configuration.');
    }

    const storageInfo = getStorageInfo();
    if (!storageInfo.isCloud) {
      console.log('⚠️  Warning: CDN provider is set to LOCAL. Cleanup only works with cloud providers (S3 or Cloudinary)');
      process.exit(0);
    }

    // Check for specific restaurant in command line args
    const restaurantIdArg = process.argv.find(arg => arg.startsWith('--restaurant='));
    const specificRestaurantId = restaurantIdArg?.split('=')[1];

    // Get restaurants to cleanup
    let restaurants;
    if (specificRestaurantId) {
      const restaurant = await Restaurant.findById(specificRestaurantId);
      if (!restaurant) {
        throw new Error(`Restaurant with ID ${specificRestaurantId} not found`);
      }
      restaurants = [restaurant];
      console.log(`Cleaning up specific restaurant: ${restaurant.name}\n`);
    } else {
      restaurants = await Restaurant.find({});
      console.log(`Found ${restaurants.length} restaurants to cleanup\n`);
    }

    stats.totalRestaurants = restaurants.length;

    // Confirm before proceeding (unless dry-run)
    if (!dryRun && restaurants.length > 0) {
      console.log('⚠️  WARNING: This will permanently delete orphaned images from cloud storage!');
      console.log('Make sure you have a backup before proceeding.\n');
      console.log('To preview what would be deleted, run with --dry-run flag\n');

      // In a real-world scenario, you'd want to add a confirmation prompt here
      // For now, we'll proceed automatically
      console.log('Proceeding with cleanup...\n');
    }

    // Cleanup each restaurant
    for (let i = 0; i < restaurants.length; i++) {
      const restaurant = restaurants[i];

      console.log(`\nProcessing ${i + 1}/${restaurants.length}...`);

      const result = await cleanupRestaurant(
        restaurant._id.toString(),
        restaurant.name,
        dryRun
      );

      stats.totalImagesDeleted += result.deleted;
      stats.totalErrors += result.errors;
      stats.details.push({
        restaurant: restaurant.name,
        deleted: result.deleted,
        errors: result.errors
      });

      // Add a small delay between restaurants to avoid rate limiting
      if (i < restaurants.length - 1) {
        console.log('\nWaiting 2 seconds before next restaurant...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Print final summary
    console.log(`\n${'='.repeat(60)}`);
    console.log(dryRun ? 'DRY RUN COMPLETE' : 'CLEANUP COMPLETE');
    console.log(`${'='.repeat(60)}`);
    console.log(`\nRestaurants processed: ${stats.totalRestaurants}`);
    console.log(`Total images deleted: ${stats.totalImagesDeleted}`);
    console.log(`Total errors: ${stats.totalErrors}`);

    if (stats.details.length > 0) {
      console.log(`\nDetails by restaurant:`);
      stats.details.forEach(detail => {
        console.log(`  ${detail.restaurant}:`);
        console.log(`    Deleted: ${detail.deleted}`);
        console.log(`    Errors: ${detail.errors}`);
      });
    }

    console.log(`\n${'='.repeat(60)}`);

    if (dryRun) {
      console.log('\nThis was a dry run. Run without --dry-run flag to actually delete images.');
    } else if (stats.totalErrors > 0) {
      console.log('\nCleanup completed with errors. Please review the logs above.');
    } else {
      console.log('\nCleanup completed successfully!');
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Cleanup failed:', error);
    console.error('\nPlease check:');
    console.error('1. Database connection is working');
    console.error('2. CDN provider is configured correctly in .env');
    console.error('3. Provider credentials are valid and have delete permissions');
    process.exit(1);
  }
}

// Run cleanup
console.log(`
╔══════════════════════════════════════════════════════════╗
║     Patlinks Orphaned Images Cleanup                     ║
╚══════════════════════════════════════════════════════════╝
`);

main();
