import express from 'express';
import monitoringController from '../controllers/monitoringController';
import { superAdminAuth } from '../../common/middleware/authMiddleware';

const router = express.Router();

// All routes require super admin authentication
router.use(superAdminAuth);

// System metrics and health
router.get('/metrics', monitoringController.getSystemMetrics);
router.get('/health', monitoringController.getHealthStatus);

// Activity feed
router.get('/activity', monitoringController.getActivityFeed);

// Subscription alerts
router.get('/subscription-alerts', monitoringController.getSubscriptionAlerts);

// Revenue analytics
router.get('/revenue-analytics', monitoringController.getRevenueAnalytics);

export default router;
