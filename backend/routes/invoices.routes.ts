import express, { type IRouter } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/permission.middleware.js';
import { downloadInvoice } from '../controllers/invoices.controller.js';

const router: IRouter = express.Router();

// Apply authentication middleware
router.use(authenticateToken);

// GET /api/invoices/:filename - Download invoice PDF
router.get('/:filename', requirePermission('transactions', 'canViewTransactions'), downloadInvoice);

export default router;
