import express from 'express';
import {
  getRestaurantById,
  updateRestaurant,
} from '../controllers/restaurantController';
import { authMiddleware } from '../../common/middleware/authMiddleware';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Get restaurant by ID
router.get('/:id', getRestaurantById);

// Update restaurant
router.put('/:id', updateRestaurant);

export default router;
