import { Router } from 'express';
import {
  superAdminLogin,
  superAdminRegister,
  getCurrentSuperAdmin,
  getRestaurants,
  createRestaurant,
  getRestaurantById,
  updateRestaurant,
  toggleRestaurantStatus,
  deleteRestaurant,
  createRestaurantAdmin,
  getRestaurantAdmins,
  getGlobalAnalytics,
  getAllAdmins,
  getAdminsPageData,
  getAdminById,
  updateAdmin,
  deleteAdmin,
  toggleAdminStatus,
  resetAdminPassword,
} from '../controllers/superAdminController';
import { superAdminAuth } from '../../common/middleware/authMiddleware';

const router = Router();

/**
 * Super Admin Authentication Routes
 * No authentication required for login/register
 */
router.post('/auth/register', superAdminRegister);
router.post('/auth/login', superAdminLogin);

/**
 * Super Admin Profile Routes
 * Authentication required
 */
router.get('/auth/me', superAdminAuth, getCurrentSuperAdmin);

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

/**
 * Admin Management Routes (Global)
 * Manage all restaurant admins across platform
 */

// Get admins page data (admins + restaurants) - OPTIMIZED
router.get('/admins/page-data', superAdminAuth, getAdminsPageData);

// Get all admins across all restaurants
router.get('/admins', superAdminAuth, getAllAdmins);

// Create admin (with restaurantId in body)
router.post('/admins', superAdminAuth, createRestaurantAdmin);

// Get admin by ID
router.get('/admins/:id', superAdminAuth, getAdminById);

// Update admin
router.put('/admins/:id', superAdminAuth, updateAdmin);

// Delete admin
router.delete('/admins/:id', superAdminAuth, deleteAdmin);

// Toggle admin status
router.patch('/admins/:id/status', superAdminAuth, toggleAdminStatus);

// Reset admin password
router.post('/admins/:id/reset-password', superAdminAuth, resetAdminPassword);

export default router;
