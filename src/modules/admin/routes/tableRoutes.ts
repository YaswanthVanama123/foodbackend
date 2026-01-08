import express from 'express';
import {
  getTables,
  getTableById,
  createTable,
  updateTable,
  deleteTable,
  toggleTable,
  getTableStatus,
} from '../controllers/tableController';
import { authMiddleware } from '../common/middleware/authMiddleware';
import { handleValidationErrors } from '../common/middleware/validationMiddleware';
import {
  createTableValidator,
  updateTableValidator,
  mongoIdValidator,
} from '../common/utils/validators';

const router = express.Router();

// Public routes
router.get('/', getTables);
router.get('/:id/status', mongoIdValidator, handleValidationErrors, getTableStatus);
router.get('/:id', mongoIdValidator, handleValidationErrors, getTableById);

// Protected routes (Admin only)
router.post('/', authMiddleware, createTableValidator, handleValidationErrors, createTable);
router.put('/:id', authMiddleware, updateTableValidator, handleValidationErrors, updateTable);
router.delete('/:id', authMiddleware, mongoIdValidator, handleValidationErrors, deleteTable);
router.patch('/:id/toggle', authMiddleware, mongoIdValidator, handleValidationErrors, toggleTable);

export default router;
