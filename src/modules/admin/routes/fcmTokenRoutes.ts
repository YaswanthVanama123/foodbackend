import express from 'express';
import { registerFCMToken, removeFCMToken, getFCMToken } from '../controllers/fcmTokenController';
import { authMiddleware } from '../../common/middleware/authMiddleware';

const router = express.Router();

/**
 * FCM Token Management Routes for Admin
 * All routes require admin authentication
 */

// POST /api/admin/fcm-token - Register/Update FCM token
router.post('/fcm-token', authMiddleware, registerFCMToken);

// DELETE /api/admin/fcm-token - Remove FCM token
router.delete('/fcm-token', authMiddleware, removeFCMToken);

// GET /api/admin/fcm-token - Get FCM token (debugging)
router.get('/fcm-token', authMiddleware, getFCMToken);

export default router;
