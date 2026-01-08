import express from 'express';
import {
  bulkUpdateOrderStatus,
  bulkDeleteOrders,
  exportOrders,
} from '../controllers/orderBulkController';
import { authMiddleware } from '../common/middleware/authMiddleware';
import { handleValidationErrors } from '../common/middleware/validationMiddleware';
import {
  bulkUpdateOrderStatusValidator,
  bulkDeleteOrdersValidator,
  exportOrdersValidator,
} from '../common/utils/validators';

const orderBulkRouter = express.Router();

// All routes require admin authentication
orderBulkRouter.use(authMiddleware);

// Bulk operations
orderBulkRouter.patch(
  '/update-status',
  bulkUpdateOrderStatusValidator,
  handleValidationErrors,
  bulkUpdateOrderStatus
);

orderBulkRouter.delete(
  '/delete',
  bulkDeleteOrdersValidator,
  handleValidationErrors,
  bulkDeleteOrders
);

// Export
orderBulkRouter.get(
  '/export',
  exportOrdersValidator,
  handleValidationErrors,
  exportOrders
);

export default orderBulkRouter;
