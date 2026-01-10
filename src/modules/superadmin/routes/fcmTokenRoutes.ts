import express from 'express';
import { registerFCMToken, removeFCMToken, getFCMToken } from '../controllers/fcmTokenController';
import { superAdminAuth } from '../../common/middleware/authMiddleware';

const router = express.Router();

/**
 * FCM Token Management Routes for Super Admin
 * All routes require super admin authentication
 */

// POST /api/super-admin/fcm-token - Register/Update FCM token
router.post('/fcm-token', superAdminAuth, registerFCMToken);

// DELETE /api/super-admin/fcm-token - Remove FCM token
router.delete('/fcm-token', superAdminAuth, removeFCMToken);

// GET /api/super-admin/fcm-token - Get FCM token (debugging)
router.get('/fcm-token', superAdminAuth, getFCMToken);

export default router;
