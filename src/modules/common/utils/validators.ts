import { body, param, query, ValidationChain } from 'express-validator';

// Auth Validators
export const loginValidator: ValidationChain[] = [
  body('username').trim().notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

export const refreshTokenValidator: ValidationChain[] = [
  body('refreshToken').notEmpty().withMessage('Refresh token is required'),
];

// Category Validators
export const createCategoryValidator: ValidationChain[] = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Category name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Category name must be between 2 and 50 characters'),
  body('description').optional().trim().isLength({ max: 200 }),
  body('displayOrder').optional().isInt({ min: 0 }),
  body('isActive').optional().isBoolean(),
];

export const updateCategoryValidator: ValidationChain[] = [
  param('id').isMongoId().withMessage('Invalid category ID'),
  body('name').optional().trim().isLength({ min: 2, max: 50 }),
  body('description').optional().trim().isLength({ max: 200 }),
  body('displayOrder').optional().isInt({ min: 0 }),
  body('isActive').optional().isBoolean(),
];

// Menu Item Validators
export const createMenuItemValidator: ValidationChain[] = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Menu item name is required')
    .isLength({ min: 2, max: 100 }),
  body('description').optional().trim().isLength({ max: 500 }),
  body('categoryId')
    .notEmpty()
    .withMessage('Category is required')
    .isMongoId()
    .withMessage('Invalid category ID'),
  body('price')
    .notEmpty()
    .withMessage('Price is required')
    .isFloat({ min: 0.01 })
    .withMessage('Price must be greater than 0'),
  body('isVegetarian').optional().isBoolean(),
  body('isVegan').optional().isBoolean(),
  body('isGlutenFree').optional().isBoolean(),
  body('preparationTime').optional().isInt({ min: 0 }),
];

export const updateMenuItemValidator: ValidationChain[] = [
  param('id').isMongoId().withMessage('Invalid menu item ID'),
  body('name').optional().trim().isLength({ min: 2, max: 100 }),
  body('description').optional().trim().isLength({ max: 500 }),
  body('categoryId').optional().isMongoId(),
  body('price').optional().isFloat({ min: 0.01 }),
  body('isAvailable').optional().isBoolean(),
  body('isVegetarian').optional().isBoolean(),
  body('isVegan').optional().isBoolean(),
  body('isGlutenFree').optional().isBoolean(),
  body('preparationTime').optional().isInt({ min: 0 }),
];

// Table Validators
export const createTableValidator: ValidationChain[] = [
  body('tableNumber')
    .trim()
    .notEmpty()
    .withMessage('Table number is required')
    .isLength({ min: 1, max: 20 }),
  body('capacity')
    .notEmpty()
    .withMessage('Capacity is required')
    .isInt({ min: 1, max: 20 })
    .withMessage('Capacity must be between 1 and 20'),
  body('location').optional().trim().isLength({ max: 100 }),
  body('isActive').optional().isBoolean(),
];

export const updateTableValidator: ValidationChain[] = [
  param('id').isMongoId().withMessage('Invalid table ID'),
  body('tableNumber').optional().trim().isLength({ min: 1, max: 20 }),
  body('capacity').optional().isInt({ min: 1, max: 20 }),
  body('location').optional().trim().isLength({ max: 100 }),
  body('isActive').optional().isBoolean(),
  body('isOccupied').optional().isBoolean(),
];

// Order Validators
export const createOrderValidator: ValidationChain[] = [
  body('tableId')
    .notEmpty()
    .withMessage('Table ID is required')
    .isMongoId()
    .withMessage('Invalid table ID'),
  body('items')
    .isArray({ min: 1 })
    .withMessage('Order must contain at least one item'),
  body('items.*.menuItemId')
    .notEmpty()
    .isMongoId()
    .withMessage('Invalid menu item ID'),
  body('items.*.name').trim().notEmpty(),
  body('items.*.price').isFloat({ min: 0 }),
  body('items.*.quantity').isInt({ min: 1, max: 99 }),
  body('items.*.subtotal').isFloat({ min: 0 }),
  body('notes').optional().trim().isLength({ max: 500 }),
];

export const updateOrderStatusValidator: ValidationChain[] = [
  param('id').isMongoId().withMessage('Invalid order ID'),
  body('status')
    .notEmpty()
    .withMessage('Status is required')
    .isIn(['received', 'preparing', 'ready', 'served', 'cancelled'])
    .withMessage('Invalid status'),
];

// Query Validators
export const paginationValidator: ValidationChain[] = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
];

export const mongoIdValidator: ValidationChain[] = [
  param('id').isMongoId().withMessage('Invalid ID format'),
];

// Review Validators
export const createReviewValidator: ValidationChain[] = [
  body('orderId')
    .notEmpty()
    .withMessage('Order ID is required')
    .isMongoId()
    .withMessage('Invalid order ID'),
  body('menuItemId')
    .optional()
    .isMongoId()
    .withMessage('Invalid menu item ID'),
  body('rating')
    .notEmpty()
    .withMessage('Rating is required')
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  body('comment')
    .trim()
    .notEmpty()
    .withMessage('Comment is required')
    .isLength({ min: 10, max: 500 })
    .withMessage('Comment must be between 10 and 500 characters'),
];

export const updateReviewValidator: ValidationChain[] = [
  param('id').isMongoId().withMessage('Invalid review ID'),
  body('rating')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Rating must be between 1 and 5'),
  body('comment')
    .optional()
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage('Comment must be between 10 and 500 characters'),
];

export const reviewResponseValidator: ValidationChain[] = [
  param('id').isMongoId().withMessage('Invalid review ID'),
  body('text')
    .trim()
    .notEmpty()
    .withMessage('Response text is required')
    .isLength({ min: 10, max: 500 })
    .withMessage('Response must be between 10 and 500 characters'),
];

export const toggleVisibilityValidator: ValidationChain[] = [
  param('id').isMongoId().withMessage('Invalid review ID'),
  body('isVisible')
    .notEmpty()
    .withMessage('Visibility status is required')
    .isBoolean()
    .withMessage('Visibility must be a boolean'),
];

export const reviewQueryValidator: ValidationChain[] = [
  query('menuItemId').optional().isMongoId().withMessage('Invalid menu item ID'),
  query('orderId').optional().isMongoId().withMessage('Invalid order ID'),
  query('customerId').optional().trim(),
  query('minRating').optional().isInt({ min: 1, max: 5 }).withMessage('Min rating must be between 1 and 5'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('sortBy').optional().isIn(['createdAt', 'rating', 'helpfulCount']).withMessage('Invalid sort field'),
  query('order').optional().isIn(['asc', 'desc']).withMessage('Order must be asc or desc'),
];

// Bulk Order Validators
export const bulkUpdateOrderStatusValidator: ValidationChain[] = [
  body('orderIds')
    .isArray({ min: 1 })
    .withMessage('Order IDs array is required and must not be empty'),
  body('orderIds.*')
    .isMongoId()
    .withMessage('All order IDs must be valid MongoDB IDs'),
  body('status')
    .notEmpty()
    .withMessage('Status is required')
    .isIn(['received', 'preparing', 'ready', 'served', 'cancelled'])
    .withMessage('Invalid status'),
];

export const bulkDeleteOrdersValidator: ValidationChain[] = [
  body('orderIds')
    .isArray({ min: 1 })
    .withMessage('Order IDs array is required and must not be empty'),
  body('orderIds.*')
    .isMongoId()
    .withMessage('All order IDs must be valid MongoDB IDs'),
  body('confirm')
    .notEmpty()
    .withMessage('Confirmation is required')
    .equals('true')
    .withMessage('Confirm must be true to proceed with deletion'),
];

export const exportOrdersValidator: ValidationChain[] = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),
  query('status')
    .optional()
    .isIn(['received', 'preparing', 'ready', 'served', 'cancelled'])
    .withMessage('Invalid status'),
];

