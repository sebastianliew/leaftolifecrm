import express, { type IRouter } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/permission.middleware.js';
import {
  getBundles,
  getBundleById,
  createBundle,
  updateBundle,
  deleteBundle,
  getBundleCategories,
  getPopularBundles,
  getPromotedBundles,
  getBundleStats,
  checkBundleAvailability,
  calculateBundlePricing
} from '../controllers/bundles.controller.js';

const router: IRouter = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);


// View routes - require canViewBundles permission
router.get('/', requirePermission('bundles', 'canViewBundles'), getBundles);
router.get('/categories', requirePermission('bundles', 'canViewBundles'), getBundleCategories);
router.get('/popular', requirePermission('bundles', 'canViewBundles'), getPopularBundles);
router.get('/promoted', requirePermission('bundles', 'canViewBundles'), getPromotedBundles);

// Protected view routes
router.get('/stats', requirePermission('bundles', 'canViewBundles'), getBundleStats);
router.get('/:id', requirePermission('bundles', 'canViewBundles'), getBundleById);
router.get('/:id/availability', requirePermission('bundles', 'canViewBundles'), checkBundleAvailability);

// Write routes - require specific permissions
router.post('/', requirePermission('bundles', 'canCreateBundles'), createBundle);
router.post('/calculate-pricing', requirePermission('bundles', 'canViewBundles'), calculateBundlePricing);
router.put('/:id', requirePermission('bundles', 'canEditBundles'), updateBundle);
router.delete('/:id', requirePermission('bundles', 'canDeleteBundles'), deleteBundle);

export default router;