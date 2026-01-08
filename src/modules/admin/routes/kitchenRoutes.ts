import express from 'express';
import {
  getKitchenOrders,
  startOrder,
  markOrderReady,
  getKitchenStats,
  getKitchenOrderDetails,
} from '../controllers/kitchenController';
import { authMiddleware } from '../common/middleware/authMiddleware';

const router = express.Router();

// All kitchen routes require admin authentication
router.use(authMiddleware);

router.get('/orders', getKitchenOrders);
router.get('/orders/:id', getKitchenOrderDetails);
router.patch('/orders/:id/start', startOrder);
router.patch('/orders/:id/ready', markOrderReady);
router.get('/stats', getKitchenStats);

export default router;
