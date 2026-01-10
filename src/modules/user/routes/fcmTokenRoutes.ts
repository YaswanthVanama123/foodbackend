import express from 'express';
import { registerFCMToken, removeFCMToken, getFCMToken } from '../controllers/fcmTokenController';
import { customerAuthMiddleware } from '../../common/middleware/authMiddleware';

const router = express.Router();

/**
 * FCM Token Management Routes
 * All routes require customer authentication
 */

// POST /api/customers/fcm-token - Register/Update FCM token
router.post('/fcm-token', customerAuthMiddleware, registerFCMToken);

// DELETE /api/customers/fcm-token - Remove FCM token
router.delete('/fcm-token', customerAuthMiddleware, removeFCMToken);

// GET /api/customers/fcm-token - Get FCM token (debugging)
router.get('/fcm-token', customerAuthMiddleware, getFCMToken);

export default router;
