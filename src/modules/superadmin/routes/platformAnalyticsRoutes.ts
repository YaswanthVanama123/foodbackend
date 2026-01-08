import { Router } from 'express';
import {
  getPlatformRevenue,
  getRestaurantGrowth,
  getTopRestaurants,
  getPlatformStats,
} from '../controllers/platformAnalyticsController';
import { superAdminAuth } from '../common/middleware/authMiddleware';

const router = Router();

/**
 * Platform Analytics Routes
 * All routes require super admin authentication
 */

// GET /api/superadmin/analytics/revenue
// Query params: startDate (optional), endDate (optional)
router.get('/revenue', superAdminAuth, getPlatformRevenue);

// GET /api/superadmin/analytics/growth
// Returns last 12 months of restaurant growth data
router.get('/growth', superAdminAuth, getRestaurantGrowth);

// GET /api/superadmin/analytics/top-restaurants
// Returns top 10 restaurants by revenue, customers, and orders
router.get('/top-restaurants', superAdminAuth, getTopRestaurants);

// GET /api/superadmin/analytics/stats
// Returns platform-wide overview statistics
router.get('/stats', superAdminAuth, getPlatformStats);

export default router;
