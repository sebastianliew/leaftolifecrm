import express, { type IRouter } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/permission.middleware.js';
import { sensitiveOperationRateLimit } from '../middlewares/rateLimiting.middleware.js';
import {
  getRefunds,
  getRefundById,
  createRefund,
  approveRefund,
  rejectRefund,
  processRefund,
  completeRefund,
  cancelRefund,
  getTransactionRefunds,
  getRefundEligibility,
  getRefundStatistics
} from '../controllers/refunds.controller.js';

const router: IRouter = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// GET /api/refunds - Get all refunds with optional filters
router.get('/', requirePermission('transactions', 'canViewTransactions'), getRefunds);

// GET /api/refunds/statistics - Get refund statistics
router.get('/statistics', requirePermission('transactions', 'canViewTransactions'), getRefundStatistics);

// GET /api/refunds/:id - Get refund by ID
router.get('/:id', requirePermission('transactions', 'canViewTransactions'), getRefundById);

// POST /api/refunds - Create new refund (rate limited)
router.post('/', sensitiveOperationRateLimit, requirePermission('transactions', 'canRefundTransactions'), createRefund);

// PUT /api/refunds/:id/approve - Approve refund (rate limited)
router.put('/:id/approve', sensitiveOperationRateLimit, requirePermission('transactions', 'canRefundTransactions'), approveRefund);

// PUT /api/refunds/:id/reject - Reject refund
router.put('/:id/reject', requirePermission('transactions', 'canRefundTransactions'), rejectRefund);

// PUT /api/refunds/:id/process - Process refund (handle inventory)
router.put('/:id/process', requirePermission('transactions', 'canRefundTransactions'), processRefund);

// PUT /api/refunds/:id/complete - Complete refund (finalize payment, rate limited)
router.put('/:id/complete', sensitiveOperationRateLimit, requirePermission('transactions', 'canRefundTransactions'), completeRefund);

// PUT /api/refunds/:id/cancel - Cancel refund
router.put('/:id/cancel', requirePermission('transactions', 'canRefundTransactions'), cancelRefund);

// GET /api/refunds/transaction/:transactionId - Get refunds for a transaction
router.get('/transaction/:transactionId', requirePermission('transactions', 'canViewTransactions'), getTransactionRefunds);

// GET /api/refunds/eligibility/:transactionId - Check refund eligibility for transaction
router.get('/eligibility/:transactionId', requirePermission('transactions', 'canViewTransactions'), getRefundEligibility);

export default router;