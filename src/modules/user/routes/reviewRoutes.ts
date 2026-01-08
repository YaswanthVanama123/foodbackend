import express from 'express';
import {
  createReview,
  getReviews,
  getMyReviews,
  updateReview,
  deleteReview,
  markHelpful,
  getMenuItemRatings,
  getRestaurantRatings,
  addRestaurantResponse,
  toggleReviewVisibility,
} from '../controllers/reviewController';
import { authMiddleware, customerAuthMiddleware, optionalCustomerAuth } from '../common/middleware/authMiddleware';
import { handleValidationErrors } from '../common/middleware/validationMiddleware';
import {
  createReviewValidator,
  updateReviewValidator,
  reviewResponseValidator,
  toggleVisibilityValidator,
  reviewQueryValidator,
  mongoIdValidator,
  paginationValidator,
} from '../common/utils/validators';

const reviewsRouter = express.Router();

// Public routes (no authentication required)
// Get reviews with filters (public)
reviewsRouter.get(
  '/',
  reviewQueryValidator,
  handleValidationErrors,
  getReviews
);

// Get restaurant overall ratings (public)
reviewsRouter.get(
  '/restaurant/ratings',
  getRestaurantRatings
);

// Get menu item ratings summary (public)
reviewsRouter.get(
  '/menu-item/:menuItemId/ratings',
  mongoIdValidator,
  handleValidationErrors,
  getMenuItemRatings
);

// Customer protected routes
// Get customer's own reviews
reviewsRouter.get(
  '/my',
  customerAuthMiddleware,
  paginationValidator,
  handleValidationErrors,
  getMyReviews
);

// Create review (customer only)
reviewsRouter.post(
  '/',
  customerAuthMiddleware,
  createReviewValidator,
  handleValidationErrors,
  createReview
);

// Update own review (customer only)
reviewsRouter.put(
  '/:id',
  customerAuthMiddleware,
  updateReviewValidator,
  handleValidationErrors,
  updateReview
);

// Delete own review (customer only)
reviewsRouter.delete(
  '/:id',
  customerAuthMiddleware,
  mongoIdValidator,
  handleValidationErrors,
  deleteReview
);

// Mark review as helpful (customer only)
reviewsRouter.post(
  '/:id/helpful',
  customerAuthMiddleware,
  mongoIdValidator,
  handleValidationErrors,
  markHelpful
);

// Admin protected routes
// Add restaurant response to review (admin only)
reviewsRouter.post(
  '/:id/response',
  authMiddleware,
  reviewResponseValidator,
  handleValidationErrors,
  addRestaurantResponse
);

// Toggle review visibility (admin only)
reviewsRouter.patch(
  '/:id/visibility',
  authMiddleware,
  toggleVisibilityValidator,
  handleValidationErrors,
  toggleReviewVisibility
);

export default reviewsRouter;
