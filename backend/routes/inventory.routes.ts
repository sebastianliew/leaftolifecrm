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
  addStock,
  getProductTemplates,
  bulkDeleteProducts
} from '../controllers/products.controller.js';
import {
  getRestockSuggestions,
  restockProduct,
  bulkRestockProducts,
  getRestockHistory,
  getRestockBatches
} from '../controllers/restock.controller.js';
import {
  getProductContainers,
  getContainerDetails,
  getContainerSaleHistory,
  createContainer,
  updateContainer,
  deleteContainer
} from '../controllers/containers.controller.js';

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
router.get('/products', requirePermission('inventory', 'canViewInventory'), getProducts);
router.get('/products/:id', requirePermission('inventory', 'canViewInventory'), getProductById);
router.post('/products', requirePermission('inventory', 'canAddProducts'), createProduct);
router.put('/products/:id', requirePermission('inventory', 'canEditProducts'), updateProduct);
router.delete('/products/:id', requirePermission('inventory', 'canDeleteProducts'), deleteProduct);
router.post('/products/bulk-delete', bulkOperationRateLimit, requirePermission('inventory', 'canDeleteProducts'), bulkDeleteProducts);
router.post('/products/add-stock', requirePermission('inventory', 'canManageStock'), addStock);
router.get('/products/templates', requirePermission('inventory', 'canViewInventory'), getProductTemplates);

// Restock routes
router.get('/restock/suggestions', requirePermission('inventory', 'canCreateRestockOrders'), getRestockSuggestions);
router.post('/restock', requirePermission('inventory', 'canCreateRestockOrders'), restockProduct);
router.get('/restock', requirePermission('inventory', 'canViewInventory'), getRestockHistory);
router.post('/restock/bulk', bulkOperationRateLimit, requirePermission('inventory', 'canCreateRestockOrders'), bulkRestockProducts);
router.get('/restock/batches', requirePermission('inventory', 'canViewInventory'), getRestockBatches);

// Container (Bottle) routes - for partial unit sales tracking
router.get('/products/:productId/containers', requirePermission('inventory', 'canViewInventory'), getProductContainers);
router.get('/products/:productId/containers/:containerId', requirePermission('inventory', 'canViewInventory'), getContainerDetails);
router.get('/products/:productId/containers/:containerId/history', requirePermission('inventory', 'canViewInventory'), getContainerSaleHistory);
router.post('/products/:productId/containers', requirePermission('inventory', 'canManageStock'), createContainer);
router.put('/products/:productId/containers/:containerId', requirePermission('inventory', 'canManageStock'), updateContainer);
router.delete('/products/:productId/containers/:containerId', requirePermission('inventory', 'canManageStock'), deleteContainer);

export default router;