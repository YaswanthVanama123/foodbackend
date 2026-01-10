import express from 'express';
import { getDashboardStatsController, getActiveOrdersController } from '../controllers/orderController';
import { getDashboardPageData } from '../controllers/dashboardController';
import { authMiddleware } from '../../common/middleware/authMiddleware';

const dashboardRouter = express.Router();

// Apply authentication middleware to all dashboard routes
dashboardRouter.use(authMiddleware);

// Dashboard routes
dashboardRouter.get('/page-data', getDashboardPageData); // NEW: Combined stats + active orders (single query)
dashboardRouter.get('/stats', getDashboardStatsController); // DEPRECATED: Use /page-data instead
dashboardRouter.get('/active-orders', getActiveOrdersController); // DEPRECATED: Use /page-data instead

export default dashboardRouter;
