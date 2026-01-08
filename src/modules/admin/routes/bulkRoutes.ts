import express from 'express';
import {
  bulkUpdateAvailability,
  bulkUpdatePrices,
  bulkUpdateCategory,
  bulkDeleteMenuItems,
  bulkUpdateTableStatus,
  exportOrders,
  getBulkSummary,
} from '../controllers/bulkController';
import { authMiddleware } from '../../common/middleware/authMiddleware';

const router = express.Router();

// All bulk operations require admin authentication
router.use(authMiddleware);

// Menu bulk operations
router.patch('/menu/availability', bulkUpdateAvailability);
router.patch('/menu/prices', bulkUpdatePrices);
router.patch('/menu/category', bulkUpdateCategory);
router.delete('/menu', bulkDeleteMenuItems);

// Table bulk operations
router.patch('/tables/status', bulkUpdateTableStatus);

// Export operations
router.post('/orders/export', exportOrders);

// Summary
router.get('/summary', getBulkSummary);

export default router;
