import express from 'express';
import {
  getOrders,
  getActiveOrdersController,
  getOrderById,
  getTableOrders,
  createOrder,
  updateOrderStatus,
  cancelOrder,
  getOrderHistory,
  getDashboardStatsController,
} from '../controllers/orderController';
import {
  addItemsToOrder,
  removeItemFromOrder,
  updateItemQuantity,
  addOrderNote,
  duplicateOrder,
  getOrderModifications,
} from '../controllers/orderModificationController';
import { authMiddleware, optionalCustomerAuth } from '../common/middleware/authMiddleware';
import { handleValidationErrors } from '../common/middleware/validationMiddleware';
import {
  createOrderValidator,
  updateOrderStatusValidator,
  mongoIdValidator,
  paginationValidator,
} from '../common/utils/validators';

const ordersRouter = express.Router();

// Protected routes (Admin only) - more specific routes first
ordersRouter.get('/active', authMiddleware, getActiveOrdersController);
ordersRouter.get('/history', authMiddleware, paginationValidator, handleValidationErrors, getOrderHistory);
ordersRouter.get('/', authMiddleware, paginationValidator, handleValidationErrors, getOrders);

// Public routes - with optional customer authentication
ordersRouter.post('/', optionalCustomerAuth, createOrderValidator, handleValidationErrors, createOrder);

// Order modification routes
ordersRouter.post('/:id/items', authMiddleware, addItemsToOrder); // Add items to existing order
ordersRouter.delete('/:id/items/:itemIndex', authMiddleware, removeItemFromOrder); // Remove item
ordersRouter.patch('/:id/items/:itemIndex/quantity', authMiddleware, updateItemQuantity); // Update quantity
ordersRouter.patch('/:id/notes', addOrderNote); // Add/update notes (public)
ordersRouter.post('/:id/duplicate', duplicateOrder); // Duplicate order (reorder)
ordersRouter.get('/:id/modifications', authMiddleware, getOrderModifications); // Get modification history

// Protected routes for specific order
ordersRouter.get('/:id', mongoIdValidator, handleValidationErrors, getOrderById);
ordersRouter.patch('/:id/status', authMiddleware, updateOrderStatusValidator, handleValidationErrors, updateOrderStatus);
ordersRouter.delete('/:id', authMiddleware, mongoIdValidator, handleValidationErrors, cancelOrder);

// Table orders route
ordersRouter.get('/table/:tableId', mongoIdValidator, handleValidationErrors, getTableOrders);

// Dashboard routes
export const dashboardRouter = express.Router();
dashboardRouter.get('/stats', authMiddleware, getDashboardStatsController);
dashboardRouter.get('/active-orders', authMiddleware, getActiveOrdersController);

export default ordersRouter;
