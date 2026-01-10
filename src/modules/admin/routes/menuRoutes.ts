import express from 'express';
import {
  getAdminMenuPageData,
  getMenuPageData,
  getMenuItems,
  getMenuItemsByCategory,
  getMenuItemById,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  toggleAvailability,
  uploadImage,
} from '../controllers/menuController';
import { authMiddleware } from '../../common/middleware/authMiddleware';
import { optionalCustomerAuth } from '../../common/middleware/customerAuth';
import { uploadMenuImage } from '../../common/middleware/uploadMiddleware';
import { handleValidationErrors } from '../../common/middleware/validationMiddleware';
import {
  mongoIdValidator,
} from '../../common/utils/validators';

const router = express.Router();

// Admin routes - most specific first
router.get('/admin/page-data', authMiddleware, getAdminMenuPageData); // OPTIMIZED: Returns categories + menu items in 1 call for admin

// Public routes - more specific routes first
router.get('/page-data', optionalCustomerAuth, getMenuPageData); // OPTIMIZED: Returns categories + menu items + ratings + favorites in 1 call
router.get('/category/:categoryId', mongoIdValidator, handleValidationErrors, getMenuItemsByCategory);
router.get('/:id', mongoIdValidator, handleValidationErrors, getMenuItemById);
router.get('/', getMenuItems);

// Protected routes (Admin only) - OPTIMIZED with image upload in single request
router.post('/', authMiddleware, uploadMenuImage.single('image'), createMenuItem);
router.put('/:id', authMiddleware, uploadMenuImage.single('image'), updateMenuItem);
router.delete('/:id', authMiddleware, mongoIdValidator, handleValidationErrors, deleteMenuItem);
router.patch('/:id/availability', authMiddleware, mongoIdValidator, handleValidationErrors, toggleAvailability);
router.post('/:id/image', authMiddleware, mongoIdValidator, handleValidationErrors, uploadMenuImage.single('image'), uploadImage); // Deprecated: Use PUT /:id instead

export default router;
