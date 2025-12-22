import express, { type IRouter } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/permission.middleware.js';
import {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier
} from '../controllers/suppliers.controller.js';

const router: IRouter = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// View routes - use inventory permissions since suppliers are part of inventory management
router.get('/', requirePermission('inventory', 'canViewInventory'), getSuppliers);
router.get('/:id', requirePermission('inventory', 'canViewInventory'), getSupplierById);

// Write routes - use inventory permissions since suppliers are part of inventory management
router.post('/', requirePermission('inventory', 'canAddProducts'), createSupplier);
router.put('/:id', requirePermission('inventory', 'canEditProducts'), updateSupplier);
router.delete('/:id', requirePermission('inventory', 'canDeleteProducts'), deleteSupplier);

export default router;