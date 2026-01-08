import express from 'express';
import { login, logout, getMe, refreshToken } from '../controllers/authController';
import { authMiddleware } from '../common/middleware/authMiddleware';
import { handleValidationErrors } from '../common/middleware/validationMiddleware';
import { loginValidator, refreshTokenValidator } from '../common/utils/validators';

const router = express.Router();

router.post('/login', loginValidator, handleValidationErrors, login);
router.post('/logout', authMiddleware, logout);
router.get('/me', authMiddleware, getMe);
router.post('/refresh', refreshTokenValidator, handleValidationErrors, refreshToken);

export default router;
