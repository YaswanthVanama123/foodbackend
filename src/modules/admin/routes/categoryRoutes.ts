import express from 'express';
import {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  toggleCategory,
} from '../controllers/categoryController';
import { authMiddleware } from '../../common/middleware/authMiddleware';
import { handleValidationErrors } from '../../common/middleware/validationMiddleware';
import {
  createCategoryValidator,
  updateCategoryValidator,
  mongoIdValidator,
} from '../../common/utils/validators';

const router = express.Router();

// Public routes
router.get('/', getCategories);
router.get('/:id', mongoIdValidator, handleValidationErrors, getCategoryById);

// Protected routes (Admin only)
router.post('/', authMiddleware, createCategoryValidator, handleValidationErrors, createCategory);
router.put('/:id', authMiddleware, updateCategoryValidator, handleValidationErrors, updateCategory);
router.delete('/:id', authMiddleware, mongoIdValidator, handleValidationErrors, deleteCategory);
router.patch('/:id/toggle', authMiddleware, mongoIdValidator, handleValidationErrors, toggleCategory);

export default router;
