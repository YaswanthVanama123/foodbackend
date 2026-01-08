/**
 * Image Migration Script
 * Migrate local images to cloud storage (S3 or Cloudinary)
 *
 * Usage:
 *   npm run migrate:images
 *   ts-node src/scripts/migrateImages.ts
 *   ts-node src/scripts/migrateImages.ts --restaurant=restaurant-id
 */

import connectDB from '../config/database';
import {
  migrateLocalToCloud,
  updateDatabaseUrls,
  getStorageInfo,
  checkCDNHealth
} from '../utils/cdnUtils';
import Restaurant from '../models/Restaurant';
import MenuItem from '../models/MenuItem';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface MigrationStats {
  totalRestaurants: number;
  successfulRestaurants: number;
  failedRestaurants: number;
  totalImages: number;
  successfulImages: number;
  failedImages: number;
  errors: Array<{ restaurant: string; error: string }>;
}

/**
 * Migrate images for a single restaurant
 */
async function migrateRestaurant(
  restaurantId: string,
  restaurantName: string
): Promise<{
  success: boolean;
  imagesProcessed: number;
  imagesFailed: number;
  error?: string;
}> {
  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Migrating images for: ${restaurantName}`);
    console.log(`Restaurant ID: ${restaurantId}`);
    console.log(`${'='.repeat(60)}\n`);

    // Run migration
    const migrationResult = await migrateLocalToCloud(restaurantId);

    console.log(`\nMigration Results:`);
    console.log(`  Total: ${migrationResult.total}`);
    console.log(`  Success: ${migrationResult.success}`);
    console.log(`  Failed: ${migrationResult.failed}`);

    if (migrationResult.errors.length > 0) {
      console.log(`\n  Errors:`);
      migrationResult.errors.forEach(error => {
        console.log(`    - ${error.file}: ${error.error}`);
      });
    }

    // Update database URLs if migration was successful
    if (migrationResult.success > 0) {
      console.log(`\nUpdating database URLs...`);
      await updateDatabaseUrls(migrationResult, {
        MenuItem,
        Restaurant
      });
      console.log(`Database updated successfully`);

      // Log URL mappings
      console.log(`\nURL Mappings (${migrationResult.migratedUrls.length} total):`);
      migrationResult.migratedUrls.forEach((mapping, index) => {
        if (index < 5) { // Show first 5
          console.log(`  ${mapping.oldUrl} -> ${mapping.newUrl}`);
        }
      });
      if (migrationResult.migratedUrls.length > 5) {
        console.log(`  ... and ${migrationResult.migratedUrls.length - 5} more`);
      }
    }

    return {
      success: migrationResult.failed === 0,
      imagesProcessed: migrationResult.success,
      imagesFailed: migrationResult.failed
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`\nMigration failed for ${restaurantName}:`, errorMessage);

    return {
      success: false,
      imagesProcessed: 0,
      imagesFailed: 0,
      error: errorMessage
    };
  }
}

/**
 * Main migration function
 */
async function main() {
  const stats: MigrationStats = {
    totalRestaurants: 0,
    successfulRestaurants: 0,
    failedRestaurants: 0,
    totalImages: 0,
    successfulImages: 0,
    failedImages: 0,
    errors: []
  };

  try {
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
      throw new Error('CDN provider is set to LOCAL. Please set CDN_PROVIDER to S3 or CLOUDINARY in .env file');
    }

    // Check for specific restaurant in command line args
    const restaurantIdArg = process.argv.find(arg => arg.startsWith('--restaurant='));
    const specificRestaurantId = restaurantIdArg?.split('=')[1];

    // Get restaurants to migrate
    let restaurants;
    if (specificRestaurantId) {
      const restaurant = await Restaurant.findById(specificRestaurantId);
      if (!restaurant) {
        throw new Error(`Restaurant with ID ${specificRestaurantId} not found`);
      }
      restaurants = [restaurant];
      console.log(`Migrating specific restaurant: ${restaurant.name}\n`);
    } else {
      restaurants = await Restaurant.find({});
      console.log(`Found ${restaurants.length} restaurants to migrate\n`);
    }

    stats.totalRestaurants = restaurants.length;

    // Migrate each restaurant
    for (let i = 0; i < restaurants.length; i++) {
      const restaurant = restaurants[i];

      console.log(`\nProcessing ${i + 1}/${restaurants.length}...`);

      const result = await migrateRestaurant(
        restaurant._id.toString(),
        restaurant.name
      );

      stats.totalImages += result.imagesProcessed + result.imagesFailed;
      stats.successfulImages += result.imagesProcessed;
      stats.failedImages += result.imagesFailed;

      if (result.success) {
        stats.successfulRestaurants++;
      } else {
        stats.failedRestaurants++;
        stats.errors.push({
          restaurant: restaurant.name,
          error: result.error || 'Unknown error'
        });
      }

      // Add a small delay between restaurants to avoid rate limiting
      if (i < restaurants.length - 1) {
        console.log('\nWaiting 2 seconds before next restaurant...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Print final summary
    console.log(`\n${'='.repeat(60)}`);
    console.log('MIGRATION COMPLETE');
    console.log(`${'='.repeat(60)}`);
    console.log(`\nRestaurants:`);
    console.log(`  Total: ${stats.totalRestaurants}`);
    console.log(`  Successful: ${stats.successfulRestaurants}`);
    console.log(`  Failed: ${stats.failedRestaurants}`);
    console.log(`\nImages:`);
    console.log(`  Total: ${stats.totalImages}`);
    console.log(`  Successful: ${stats.successfulImages}`);
    console.log(`  Failed: ${stats.failedImages}`);

    if (stats.errors.length > 0) {
      console.log(`\nErrors (${stats.errors.length}):`);
      stats.errors.forEach(error => {
        console.log(`  - ${error.restaurant}: ${error.error}`);
      });
    }

    console.log(`\n${'='.repeat(60)}`);

    if (stats.failedRestaurants > 0 || stats.failedImages > 0) {
      console.log('\nMigration completed with errors. Please review the logs above.');
      process.exit(1);
    } else {
      console.log('\nMigration completed successfully!');
      console.log('\nNext steps:');
      console.log('1. Verify all images are accessible');
      console.log('2. Test upload/delete operations');
      console.log('3. Run cleanup to remove orphaned images');
      console.log('4. (Optional) Delete local files after verification');
      process.exit(0);
    }
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('\nPlease check:');
    console.error('1. Database connection is working');
    console.error('2. CDN provider is configured correctly in .env');
    console.error('3. Required dependencies are installed');
    console.error('   - For S3: npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner');
    console.error('   - For Cloudinary: npm install cloudinary');
    console.error('4. Provider credentials are valid');
    process.exit(1);
  }
}

// Run migration
console.log(`
╔══════════════════════════════════════════════════════════╗
║     Patlinks Image Migration to Cloud Storage           ║
╚══════════════════════════════════════════════════════════╝
`);

main();
