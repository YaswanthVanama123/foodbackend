import { Router } from 'express';
import {
  getAllPlans,
  getPlanById,
  createPlan,
  updatePlan,
  deletePlan,
  togglePlanStatus,
} from '../controllers/planController';
import { superAdminAuth } from '../common/middleware/authMiddleware';

const router = Router();

/**
 * Plan Management Routes
 * All routes require super admin authentication
 */

// Get all plans (with pagination, search, filters)
router.get('/', superAdminAuth, getAllPlans);

// Get plan by ID
router.get('/:id', superAdminAuth, getPlanById);

// Create new plan
router.post('/', superAdminAuth, createPlan);

// Update plan
router.put('/:id', superAdminAuth, updatePlan);

// Delete plan
router.delete('/:id', superAdminAuth, deletePlan);

// Toggle plan active status
router.patch('/:id/status', superAdminAuth, togglePlanStatus);

export default router;
