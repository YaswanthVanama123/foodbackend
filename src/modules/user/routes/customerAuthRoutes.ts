import express from 'express';
import {
  register,
  login,
  getActiveOrder,
} from '../controllers/customerAuthController';
import { customerAuth } from '../../common/middleware/customerAuth';

const router = express.Router();

// Public routes - Username only authentication (require tenant context via tenantMiddleware)
router.post('/register', register);
router.post('/login', login);

// Protected routes - Require authentication
router.get('/active-order', customerAuth, getActiveOrder);

export default router;
