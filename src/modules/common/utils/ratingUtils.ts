import { Types } from 'mongoose';
import Review from '../models/Review';
import MenuItem from '../models/MenuItem';

/**
 * Calculate average rating for a specific menu item from all its reviews
 * @param menuItemId - The ID of the menu item
 * @returns Object containing average rating and count
 */
export async function calculateMenuItemRating(menuItemId: string | Types.ObjectId) {
  try {
    const result = await Review.aggregate([
      {
        $match: {
          menuItemId: new Types.ObjectId(menuItemId),
          isVisible: true, // Only count visible reviews
        },
      },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          ratingsCount: { $sum: 1 },
        },
      },
    ]);

    if (result.length === 0) {
      return {
        averageRating: 0,
        ratingsCount: 0,
      };
    }

    return {
      averageRating: Math.round(result[0].averageRating * 10) / 10, // Round to 1 decimal place
      ratingsCount: result[0].ratingsCount,
    };
  } catch (error) {
    console.error('Error calculating menu item rating:', error);
    throw error;
  }
}

/**
 * Update cached rating fields on a menu item
 * @param menuItemId - The ID of the menu item to update
 */
export async function updateMenuItemRating(menuItemId: string | Types.ObjectId) {
  try {
    const { averageRating, ratingsCount } = await calculateMenuItemRating(menuItemId);

    await MenuItem.findByIdAndUpdate(
      menuItemId,
      {
        averageRating,
        ratingsCount,
      },
      { new: true }
    );

    return { averageRating, ratingsCount };
  } catch (error) {
    console.error('Error updating menu item rating:', error);
    throw error;
  }
}

/**
 * Calculate overall restaurant rating from all menu items
 * This can be based on all reviews or average of menu item ratings
 * @param restaurantId - The ID of the restaurant
 * @returns Object containing average rating and total count
 */
export async function calculateRestaurantRating(restaurantId: string | Types.ObjectId) {
  try {
    // Method 1: Calculate from all reviews (more accurate)
    const reviewResult = await Review.aggregate([
      {
        $match: {
          restaurantId: new Types.ObjectId(restaurantId),
          isVisible: true,
          menuItemId: { $exists: true }, // Only menu item reviews
        },
      },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
        },
      },
    ]);

    if (reviewResult.length === 0) {
      return {
        averageRating: 0,
        totalReviews: 0,
      };
    }

    return {
      averageRating: Math.round(reviewResult[0].averageRating * 10) / 10,
      totalReviews: reviewResult[0].totalReviews,
    };
  } catch (error) {
    console.error('Error calculating restaurant rating:', error);
    throw error;
  }
}

/**
 * Get rating distribution for a menu item
 * @param menuItemId - The ID of the menu item
 * @returns Object with count for each rating (1-5 stars)
 */
export async function getMenuItemRatingDistribution(menuItemId: string | Types.ObjectId) {
  try {
    const distribution = await Review.aggregate([
      {
        $match: {
          menuItemId: new Types.ObjectId(menuItemId),
          isVisible: true,
        },
      },
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 },
        },
      },
      {
        $sort: { _id: -1 }, // Sort by rating descending (5 to 1)
      },
    ]);

    // Initialize distribution with 0 counts for all ratings
    const ratingDistribution: { [key: number]: number } = {
      5: 0,
      4: 0,
      3: 0,
      2: 0,
      1: 0,
    };

    // Fill in actual counts
    distribution.forEach((item) => {
      ratingDistribution[item._id] = item.count;
    });

    return ratingDistribution;
  } catch (error) {
    console.error('Error getting rating distribution:', error);
    throw error;
  }
}

/**
 * Get rating distribution for a restaurant
 * @param restaurantId - The ID of the restaurant
 * @returns Object with count for each rating (1-5 stars)
 */
export async function getRestaurantRatingDistribution(restaurantId: string | Types.ObjectId) {
  try {
    const distribution = await Review.aggregate([
      {
        $match: {
          restaurantId: new Types.ObjectId(restaurantId),
          isVisible: true,
          menuItemId: { $exists: true },
        },
      },
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 },
        },
      },
      {
        $sort: { _id: -1 },
      },
    ]);

    const ratingDistribution: { [key: number]: number } = {
      5: 0,
      4: 0,
      3: 0,
      2: 0,
      1: 0,
    };

    distribution.forEach((item) => {
      ratingDistribution[item._id] = item.count;
    });

    return ratingDistribution;
  } catch (error) {
    console.error('Error getting restaurant rating distribution:', error);
    throw error;
  }
}

/**
 * Batch update ratings for multiple menu items (useful for bulk operations)
 * @param menuItemIds - Array of menu item IDs
 */
export async function batchUpdateMenuItemRatings(menuItemIds: (string | Types.ObjectId)[]) {
  try {
    const updatePromises = menuItemIds.map((id) => updateMenuItemRating(id));
    await Promise.all(updatePromises);
    return { success: true, updatedCount: menuItemIds.length };
  } catch (error) {
    console.error('Error batch updating menu item ratings:', error);
    throw error;
  }
}
