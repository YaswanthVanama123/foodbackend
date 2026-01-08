import express from 'express';
import { getDashboardStatsController, getActiveOrdersController } from '../controllers/orderController';
import { authMiddleware } from '../../common/middleware/authMiddleware';

const dashboardRouter = express.Router();

// Apply authentication middleware to all dashboard routes
dashboardRouter.use(authMiddleware);

// Dashboard routes
dashboardRouter.get('/stats', getDashboardStatsController);
dashboardRouter.get('/active-orders', getActiveOrdersController);

export default dashboardRouter;
