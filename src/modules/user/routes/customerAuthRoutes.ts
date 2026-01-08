import express from 'express';
import {
  register,
  login,
} from '../controllers/customerAuthController';

const router = express.Router();

// Public routes - Username only authentication (require tenant context via tenantMiddleware)
router.post('/register', register);
router.post('/login', login);

export default router;
