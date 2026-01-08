import express from 'express';
import {
  getRevenueAnalytics,
  getPopularItems,
  getCategoryPerformance,
  getPeakHours,
  getTablePerformance,
  getPreparationTime,
  getDashboardAnalytics,
} from '../controllers/analyticsController';
import { authMiddleware } from '../common/middleware/authMiddleware';

const router = express.Router();

// All analytics routes require admin authentication
router.use(authMiddleware);

router.get('/revenue', getRevenueAnalytics);
router.get('/popular-items', getPopularItems);
router.get('/category-performance', getCategoryPerformance);
router.get('/peak-hours', getPeakHours);
router.get('/table-performance', getTablePerformance);
router.get('/preparation-time', getPreparationTime);
router.get('/dashboard', getDashboardAnalytics);

export default router;
