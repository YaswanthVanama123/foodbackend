import express from 'express';
import {
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
import { uploadMenuImage } from '../../common/middleware/uploadMiddleware';
import { handleValidationErrors } from '../../common/middleware/validationMiddleware';
import {
  createMenuItemValidator,
  updateMenuItemValidator,
  mongoIdValidator,
} from '../../common/utils/validators';

const router = express.Router();

// Public routes - more specific routes first
router.get('/page-data', getMenuPageData); // OPTIMIZED: Returns categories + menu items + ratings in 1 call
router.get('/category/:categoryId', mongoIdValidator, handleValidationErrors, getMenuItemsByCategory);
router.get('/:id', mongoIdValidator, handleValidationErrors, getMenuItemById);
router.get('/', getMenuItems);

// Protected routes (Admin only)
router.post('/', authMiddleware, createMenuItemValidator, handleValidationErrors, createMenuItem);
router.put('/:id', authMiddleware, updateMenuItemValidator, handleValidationErrors, updateMenuItem);
router.delete('/:id', authMiddleware, mongoIdValidator, handleValidationErrors, deleteMenuItem);
router.patch('/:id/availability', authMiddleware, mongoIdValidator, handleValidationErrors, toggleAvailability);
router.post('/:id/image', authMiddleware, mongoIdValidator, handleValidationErrors, uploadMenuImage.single('image'), uploadImage);

export default router;
