import { Router } from 'express';
import {
  superAdminLogin,
  getRestaurants,
  createRestaurant,
  getRestaurantById,
  updateRestaurant,
  toggleRestaurantStatus,
  deleteRestaurant,
  createRestaurantAdmin,
  getRestaurantAdmins,
  getGlobalAnalytics,
} from '../controllers/superAdminController';
import { superAdminAuth } from '../../common/middleware/authMiddleware';

const router = Router();

/**
 * Super Admin Authentication Routes
 * No authentication required for login
 */
router.post('/auth/login', superAdminLogin);

/**
 * Restaurant Management Routes
 * All routes require super admin authentication
 */

// Get all restaurants (with pagination, search, filters)
router.get('/restaurants', superAdminAuth, getRestaurants);

// Create new restaurant
router.post('/restaurants', superAdminAuth, createRestaurant);

// Get restaurant by ID with detailed stats
router.get('/restaurants/:id', superAdminAuth, getRestaurantById);

// Update restaurant
router.put('/restaurants/:id', superAdminAuth, updateRestaurant);

// Toggle restaurant active status
router.patch('/restaurants/:id/status', superAdminAuth, toggleRestaurantStatus);

// Delete restaurant (with cascade delete of all data)
router.delete('/restaurants/:id', superAdminAuth, deleteRestaurant);

/**
 * Restaurant Admin Management Routes
 */

// Create admin for a specific restaurant
router.post('/restaurants/:restaurantId/admins', superAdminAuth, createRestaurantAdmin);

// Get all admins for a specific restaurant
router.get('/restaurants/:restaurantId/admins', superAdminAuth, getRestaurantAdmins);

/**
 * Analytics Routes
 */

// Get global platform analytics
router.get('/analytics/global', superAdminAuth, getGlobalAnalytics);

export default router;
