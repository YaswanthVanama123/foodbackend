import express from 'express';
import {
  register,
  login,
  logout,
  getCurrentCustomer,
  updateProfile,
  changePassword,
  refreshToken,
} from '../controllers/customerAuthController';
import { customerAuth } from '../../common/middleware/customerAuth';

const router = express.Router();

// Public routes (require tenant context via tenantMiddleware)
router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refreshToken);

// Protected routes (require customerAuth middleware)
router.get('/me', customerAuth, getCurrentCustomer);
router.put('/profile', customerAuth, updateProfile);
router.put('/password', customerAuth, changePassword);
router.post('/logout', customerAuth, logout);

export default router;
