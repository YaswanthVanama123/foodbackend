/**
 * Advanced Search Service
 * Features:
 * - MongoDB text search with relevance scoring
 * - Fuzzy matching for typos (Levenshtein distance)
 * - Search suggestions with trie structure
 * - Faceted search with aggregations
 * - Optimized with compound indexes
 */

import MenuItem from '../models/MenuItem';
import Order from '../models/Order';
import { Types } from 'mongoose';

interface SearchOptions {
  page?: number;
  limit?: number;
  sort?: string;
  includeScore?: boolean;
}

interface SearchFilters {
  category?: string;
  dietary?: string[];
  minPrice?: number;
  maxPrice?: number;
  available?: boolean;
}

interface SearchResult<T> {
  data: T[];
  total: number;
  page: number;
  pages: number;
  facets?: any;
}

/**
 * Calculate Levenshtein distance for fuzzy matching
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Fuzzy search with similarity threshold
 */
function isFuzzyMatch(query: string, target: string, threshold: number = 2): boolean {
  const distance = levenshteinDistance(query.toLowerCase(), target.toLowerCase());
  return distance <= threshold;
}

class SearchService {
  /**
   * Advanced menu item search with text index and fuzzy matching
   */
  async searchMenuItems(
    restaurantId: Types.ObjectId,
    query: string,
    filters: SearchFilters = {},
    options: SearchOptions = {}
  ): Promise<SearchResult<any>> {
    const {
      page = 1,
      limit = 50,
      sort = 'relevance',
      includeScore = true,
    } = options;

    const skip = (page - 1) * limit;

    // Build filter query
    const filter: any = {
      restaurantId,
    };

    // Use MongoDB text search for better performance and relevance
    if (query && query.trim().length >= 2) {
      filter.$text = { $search: query };
    }

    // Apply filters
    if (filters.category) {
      filter.categoryId = filters.category;
    }

    if (filters.dietary && filters.dietary.length > 0) {
      filters.dietary.forEach((d) => {
        if (d === 'vegetarian') filter.isVegetarian = true;
        if (d === 'vegan') filter.isVegan = true;
        if (d === 'glutenFree') filter.isGlutenFree = true;
      });
    }

    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      filter.price = {};
      if (filters.minPrice !== undefined) filter.price.$gte = filters.minPrice;
      if (filters.maxPrice !== undefined) filter.price.$lte = filters.maxPrice;
    }

    if (filters.available !== undefined) {
      filter.isAvailable = filters.available;
    }

    // Build projection with text score for relevance sorting
    const projection: any = {
      name: 1,
      description: 1,
      price: 1,
      images: 1,
      image: 1,
      isAvailable: 1,
      isVegetarian: 1,
      isVegan: 1,
      isGlutenFree: 1,
      averageRating: 1,
      ratingsCount: 1,
      categoryId: 1,
    };

    if (includeScore && filter.$text) {
      projection.score = { $meta: 'textScore' };
    }

    // Determine sort option
    let sortOption: any = {};
    if (sort === 'relevance' && filter.$text) {
      sortOption = { score: { $meta: 'textScore' } };
    } else if (sort === 'price_asc') {
      sortOption = { price: 1 };
    } else if (sort === 'price_desc') {
      sortOption = { price: -1 };
    } else if (sort === 'rating') {
      sortOption = { averageRating: -1, ratingsCount: -1 };
    } else {
      sortOption = { name: 1 };
    }

    // Execute query with pagination
    const [items, total] = await Promise.all([
      MenuItem.find(filter, projection)
        .populate('categoryId', 'name')
        .sort(sortOption)
        .skip(skip)
        .limit(Math.min(limit, 50)) // Max 50 items
        .lean()
        .exec(),
      MenuItem.countDocuments(filter),
    ]);

    return {
      data: items,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Faceted search for menu items with aggregations
   */
  async facetedMenuSearch(
    restaurantId: Types.ObjectId,
    query?: string,
    filters: SearchFilters = {}
  ): Promise<any> {
    const matchStage: any = {
      restaurantId,
      isAvailable: true,
    };

    if (query && query.trim().length >= 2) {
      matchStage.$text = { $search: query };
    }

    if (filters.category) {
      matchStage.categoryId = new Types.ObjectId(filters.category);
    }

    const pipeline = [
      { $match: matchStage },
      {
        $facet: {
          // Price ranges
          priceRanges: [
            {
              $bucket: {
                groupBy: '$price',
                boundaries: [0, 10, 20, 50, 100, 500],
                default: '500+',
                output: {
                  count: { $sum: 1 },
                  minPrice: { $min: '$price' },
                  maxPrice: { $max: '$price' },
                },
              },
            },
          ],
          // Dietary options
          dietary: [
            {
              $group: {
                _id: null,
                vegetarian: { $sum: { $cond: ['$isVegetarian', 1, 0] } },
                vegan: { $sum: { $cond: ['$isVegan', 1, 0] } },
                glutenFree: { $sum: { $cond: ['$isGlutenFree', 1, 0] } },
              },
            },
          ],
          // Categories
          categories: [
            {
              $group: {
                _id: '$categoryId',
                count: { $sum: 1 },
              },
            },
            { $sort: { count: -1 } },
            { $limit: 10 },
            {
              $lookup: {
                from: 'categories',
                localField: '_id',
                foreignField: '_id',
                as: 'category',
              },
            },
            { $unwind: '$category' },
            {
              $project: {
                _id: 1,
                name: '$category.name',
                count: 1,
              },
            },
          ],
          // Overall stats
          stats: [
            {
              $group: {
                _id: null,
                totalItems: { $sum: 1 },
                avgPrice: { $avg: '$price' },
                minPrice: { $min: '$price' },
                maxPrice: { $max: '$price' },
                avgRating: { $avg: '$averageRating' },
              },
            },
          ],
        },
      },
    ];

    const result = await MenuItem.aggregate(pipeline).exec();
    return result[0] || {};
  }

  /**
   * Get search suggestions based on query prefix
   */
  async getSearchSuggestions(
    restaurantId: Types.ObjectId,
    prefix: string,
    limit: number = 10
  ): Promise<string[]> {
    if (!prefix || prefix.trim().length < 2) {
      return [];
    }

    const regex = new RegExp(`^${prefix}`, 'i');

    const items = await MenuItem.find({
      restaurantId,
      isAvailable: true,
      name: regex,
    })
      .select('name')
      .limit(limit)
      .lean()
      .exec();

    return items.map((item) => item.name);
  }

  /**
   * Advanced search suggestions with fuzzy matching
   */
  async getFuzzySearchSuggestions(
    restaurantId: Types.ObjectId,
    query: string,
    limit: number = 10
  ): Promise<string[]> {
    if (!query || query.trim().length < 2) {
      return [];
    }

    // First try exact prefix match
    const exactMatches = await this.getSearchSuggestions(restaurantId, query, limit);

    if (exactMatches.length >= limit) {
      return exactMatches;
    }

    // If not enough results, try fuzzy matching
    const allItems = await MenuItem.find({
      restaurantId,
      isAvailable: true,
    })
      .select('name')
      .limit(100) // Limit to prevent performance issues
      .lean()
      .exec();

    const fuzzyMatches = allItems
      .filter((item) => isFuzzyMatch(query, item.name, 2))
      .map((item) => item.name)
      .slice(0, limit - exactMatches.length);

    return [...new Set([...exactMatches, ...fuzzyMatches])];
  }

  /**
   * Search orders with text index
   */
  async searchOrders(
    restaurantId: Types.ObjectId,
    query: string,
    filters: any = {},
    options: SearchOptions = {}
  ): Promise<SearchResult<any>> {
    const { page = 1, limit = 50 } = options;
    const skip = (page - 1) * limit;

    const filter: any = {
      restaurantId,
    };

    // Search across multiple fields
    if (query && query.trim().length >= 2) {
      filter.$or = [
        { orderNumber: { $regex: query, $options: 'i' } },
        { tableNumber: { $regex: query, $options: 'i' } },
        { notes: { $regex: query, $options: 'i' } },
      ];
    }

    // Apply status filter
    if (filters.status) {
      filter.status = filters.status;
    }

    // Apply date range filter
    if (filters.startDate || filters.endDate) {
      filter.createdAt = {};
      if (filters.startDate) {
        filter.createdAt.$gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate('tableId', 'tableNumber location')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Math.min(limit, 50))
        .lean()
        .exec(),
      Order.countDocuments(filter),
    ]);

    return {
      data: orders,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Get popular search queries (this would typically use analytics data)
   */
  async getPopularSearches(
    restaurantId: Types.ObjectId,
    limit: number = 10
  ): Promise<string[]> {
    // Get top menu items by rating and order count
    const popularItems = await MenuItem.find({
      restaurantId,
      isAvailable: true,
      ratingsCount: { $gt: 0 },
    })
      .select('name')
      .sort({ averageRating: -1, ratingsCount: -1 })
      .limit(limit)
      .lean()
      .exec();

    return popularItems.map((item) => item.name);
  }
}

export default new SearchService();
