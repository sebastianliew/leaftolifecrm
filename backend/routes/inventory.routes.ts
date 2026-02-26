import express, { type IRouter } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/permission.middleware.js';
import { bulkOperationRateLimit } from '../middlewares/rateLimiting.middleware.js';
import {
  getUnits,
  getUnitById,
  createUnit,
  updateUnit,
  deleteUnit
} from '../controllers/units.controller.js';
import {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory
} from '../controllers/categories.controller.js';
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductTemplates,
  bulkDeleteProducts,
  getInventoryStats,
  exportProducts
} from '../controllers/products.controller.js';
import {
  getRestockSuggestions,
  restockProduct,
  bulkRestockProducts,
  getRestockHistory,
  getRestockBatches
} from '../controllers/restock.controller.js';
// Container tracking removed — stock is now a single number in base units

const router: IRouter = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Units routes - use inventory permissions since units are part of inventory management
router.get('/units', requirePermission('inventory', 'canViewInventory'), getUnits);
router.get('/units/:id', requirePermission('inventory', 'canViewInventory'), getUnitById);
router.post('/units', requirePermission('inventory', 'canAddProducts'), createUnit);
router.put('/units/:id', requirePermission('inventory', 'canEditProducts'), updateUnit);
router.delete('/units/:id', requirePermission('inventory', 'canDeleteProducts'), deleteUnit);

// Categories routes - use inventory permissions since categories are part of inventory management
router.get('/categories', requirePermission('inventory', 'canViewInventory'), getCategories);
router.get('/categories/:id', requirePermission('inventory', 'canViewInventory'), getCategoryById);
router.post('/categories', requirePermission('inventory', 'canAddProducts'), createCategory);
router.put('/categories/:id', requirePermission('inventory', 'canEditProducts'), updateCategory);
router.delete('/categories/:id', requirePermission('inventory', 'canDeleteProducts'), deleteCategory);

// Products routes
router.get('/products/stats', requirePermission('inventory', 'canViewInventory'), getInventoryStats);
router.get('/products', requirePermission('inventory', 'canViewInventory'), getProducts);
router.get('/products/templates', requirePermission('inventory', 'canViewInventory'), getProductTemplates);
router.get('/products/export', requirePermission('inventory', 'canViewInventory'), exportProducts);
router.post('/products/bulk-delete', bulkOperationRateLimit, requirePermission('inventory', 'canDeleteProducts'), bulkDeleteProducts);
router.get('/products/:id', requirePermission('inventory', 'canViewInventory'), getProductById);
router.post('/products', requirePermission('inventory', 'canAddProducts'), createProduct);
router.put('/products/:id', requirePermission('inventory', 'canEditProducts'), updateProduct);
router.delete('/products/:id', requirePermission('inventory', 'canDeleteProducts'), deleteProduct);

// Restock routes
router.get('/restock/suggestions', requirePermission('inventory', 'canCreateRestockOrders'), getRestockSuggestions);
router.post('/restock', requirePermission('inventory', 'canCreateRestockOrders'), restockProduct);
router.get('/restock', requirePermission('inventory', 'canViewInventory'), getRestockHistory);
router.post('/restock/bulk', bulkOperationRateLimit, requirePermission('inventory', 'canCreateRestockOrders'), bulkRestockProducts);
router.get('/restock/batches', requirePermission('inventory', 'canViewInventory'), getRestockBatches);

// Container (Bottle) routes - for partial unit sales tracking
// Container routes removed — stock is now tracked as a single number in base units

export default router;