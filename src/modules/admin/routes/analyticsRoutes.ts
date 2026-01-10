import express from 'express';
import {
  getAnalyticsPageData,
  getRevenueAnalytics,
  getPopularItems,
  getCategoryPerformance,
  getPeakHours,
  getTablePerformance,
  getPreparationTime,
  getDashboardAnalytics,
} from '../controllers/analyticsController';
import { authMiddleware } from '../../common/middleware/authMiddleware';

const router = express.Router();

// All analytics routes require admin authentication
router.use(authMiddleware);

// Combined endpoint (most specific first)
router.get('/page-data', getAnalyticsPageData); // OPTIMIZED: All analytics in 1 call

router.get('/revenue', getRevenueAnalytics);
router.get('/popular-items', getPopularItems);
router.get('/category-performance', getCategoryPerformance);
router.get('/peak-hours', getPeakHours);
router.get('/table-performance', getTablePerformance);
router.get('/preparation-time', getPreparationTime);
router.get('/dashboard', getDashboardAnalytics);

export default router;
