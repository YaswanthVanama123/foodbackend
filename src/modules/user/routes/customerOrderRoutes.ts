import express from 'express';
import {
  getOrderHistory,
  getOrderDetails,
  reorder,
} from '../controllers/customerOrderController';
import { customerAuthMiddleware } from '../common/middleware/authMiddleware';
import { handleValidationErrors } from '../common/middleware/validationMiddleware';
import { param, query, body } from 'express-validator';

const customerOrderRouter = express.Router();

// Validation middleware
const orderIdValidator = [
  param('orderId')
    .isMongoId()
    .withMessage('Invalid order ID format'),
];

const orderHistoryValidator = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('status')
    .optional()
    .isString()
    .matches(/^(received|preparing|ready|served|cancelled)(,(received|preparing|ready|served|cancelled))*$/)
    .withMessage('Invalid status format. Valid values: received, preparing, ready, served, cancelled'),
];

const reorderValidator = [
  param('orderId')
    .isMongoId()
    .withMessage('Invalid order ID format'),
  body('tableId')
    .optional()
    .isMongoId()
    .withMessage('Invalid table ID format'),
  body('notes')
    .optional()
    .isString()
    .withMessage('Notes must be a string'),
];

// All routes require customer authentication
customerOrderRouter.use(customerAuthMiddleware);

// GET /api/customers/orders - Get customer's order history
customerOrderRouter.get(
  '/',
  orderHistoryValidator,
  handleValidationErrors,
  getOrderHistory
);

// GET /api/customers/orders/:orderId - Get single order details
customerOrderRouter.get(
  '/:orderId',
  orderIdValidator,
  handleValidationErrors,
  getOrderDetails
);

// POST /api/customers/orders/:orderId/reorder - Create new order from previous order
customerOrderRouter.post(
  '/:orderId/reorder',
  reorderValidator,
  handleValidationErrors,
  reorder
);

export default customerOrderRouter;
