import express, { type IRouter } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/permission.middleware.js';
import {
  getBrands,
  getBrandById,
  createBrand,
  updateBrand,
  deleteBrand
} from '../controllers/brands.controller.js';

const router: IRouter = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// View routes - use inventory permissions since brands are part of inventory management
router.get('/', requirePermission('inventory', 'canViewInventory'), getBrands);
router.get('/:id', requirePermission('inventory', 'canViewInventory'), getBrandById);

// Write routes - use inventory permissions since brands are part of inventory management
router.post('/', requirePermission('inventory', 'canAddProducts'), createBrand);
router.put('/:id', requirePermission('inventory', 'canEditProducts'), updateBrand);
router.delete('/:id', requirePermission('inventory', 'canDeleteProducts'), deleteBrand);

export default router;