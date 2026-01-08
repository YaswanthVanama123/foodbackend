import express from 'express';
import { customerAuthMiddleware } from '../../common/middleware/authMiddleware';
import {
  addFavorite,
  removeFavorite,
  getFavorites,
  checkFavorite,
} from '../controllers/favoritesController';

const router = express.Router();

// All routes require customer authentication and are tenant-scoped
router.use(customerAuthMiddleware);

/**
 * @route   GET /api/customers/favorites
 * @desc    Get all favorites for current customer
 * @access  Private (Customer)
 */
router.get('/', getFavorites);

/**
 * @route   GET /api/customers/favorites/check/:menuItemId
 * @desc    Check if menu item is favorited
 * @access  Private (Customer)
 */
router.get('/check/:menuItemId', checkFavorite);

/**
 * @route   POST /api/customers/favorites
 * @desc    Add menu item to favorites
 * @access  Private (Customer)
 * @body    { menuItemId: string }
 */
router.post('/', addFavorite);

/**
 * @route   DELETE /api/customers/favorites/:menuItemId
 * @desc    Remove menu item from favorites
 * @access  Private (Customer)
 */
router.delete('/:menuItemId', removeFavorite);

export default router;
