import express from 'express';
import {
  getAddOns,
  getAddOnById,
  createAddOn,
  updateAddOn,
  deleteAddOn,
  toggleAvailability,
} from '../controllers/addOnController';

const router = express.Router();

// All routes use auth and restaurant middleware (applied in main router)

router.get('/', getAddOns);
router.get('/:id', getAddOnById);
router.post('/', createAddOn);
router.put('/:id', updateAddOn);
router.delete('/:id', deleteAddOn);
router.patch('/:id/toggle-availability', toggleAvailability);

export default router;
