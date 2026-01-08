import { Router } from 'express';
import { getRestaurantBySubdomain } from '../controllers/publicController';

const router = Router();

/**
 * Public Routes - No authentication required
 * These endpoints are used for initial restaurant lookup before login
 */

// Get restaurant by subdomain (for login page)
router.get('/restaurants/by-subdomain/:subdomain', getRestaurantBySubdomain);

export default router;
