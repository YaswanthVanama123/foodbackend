import express from 'express';
import {
  searchMenuItems,
  searchOrders,
  filterMenuItems,
  getDietaryOptions,
  getPriceRange,
} from '../controllers/searchController';
import { authMiddleware } from '../../common/middleware/authMiddleware';

const router = express.Router();

// Public routes
router.get('/menu', searchMenuItems);
router.get('/menu/filter', filterMenuItems);
router.get('/dietary-options', getDietaryOptions);
router.get('/price-range', getPriceRange);

// Protected routes (Admin)
router.get('/orders', authMiddleware, searchOrders);

export default router;
