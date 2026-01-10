import express from 'express';
import { getHomePageData, registerFCMToken } from '../controllers/homeController';
import { optionalCustomerAuth } from '../../common/middleware/customerAuth';
import { customerAuth } from '../../common/middleware/customerAuth';

const router = express.Router();

/**
 * Combined home page endpoint
 * Returns restaurant info, tables, and active order (if authenticated) in one request
 * Uses optionalCustomerAuth to allow both authenticated and unauthenticated access
 */
router.get('/', optionalCustomerAuth, getHomePageData);

/**
 * FCM token registration
 * Only call this if token not in localStorage
 */
router.post('/fcm-token', customerAuth, registerFCMToken);

export default router;
