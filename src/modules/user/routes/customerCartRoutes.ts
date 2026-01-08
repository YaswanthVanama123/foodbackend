import express from 'express';
import {
  getCart,
  saveCart,
  addItemToCart,
  updateCartItemQuantity,
  removeItemFromCart,
  clearCart,
} from '../controllers/customerCartController';
import { customerAuthMiddleware } from '../common/middleware/authMiddleware';

const customerCartRouter = express.Router();

// All routes require customer authentication
customerCartRouter.use(customerAuthMiddleware);

// Cart operations
customerCartRouter.get('/', getCart); // Get customer's cart
customerCartRouter.post('/', saveCart); // Save/replace entire cart
customerCartRouter.delete('/', clearCart); // Clear cart

// Cart item operations
customerCartRouter.post('/items', addItemToCart); // Add item to cart
customerCartRouter.patch('/items/:index', updateCartItemQuantity); // Update item quantity
customerCartRouter.delete('/items/:index', removeItemFromCart); // Remove item from cart

export default customerCartRouter;
