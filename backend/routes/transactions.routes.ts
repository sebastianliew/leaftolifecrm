import express, { type IRouter } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { requirePermission, requireDraftOrEditPermission } from '../middlewares/permission.middleware.js';
import {
  sensitiveOperationRateLimit,
  fileGenerationRateLimit,
  emailRateLimit
} from '../middlewares/rateLimiting.middleware.js';
import {
  getTransactions,
  getTransactionById,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  generateTransactionInvoice,
  sendInvoiceEmail,
  saveDraft,
  getDrafts,
  deleteDraft,
  duplicateTransaction
} from '../controllers/transactions.controller.js';

const router: IRouter = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// GET /api/transactions - Get all transactions
router.get('/', requirePermission('transactions', 'canViewTransactions'), getTransactions);

// Draft-related routes (must come before /:id to avoid conflicts)
// GET /api/transactions/drafts - Get user's drafts
router.get('/drafts', requirePermission('transactions', 'canViewTransactions'), getDrafts);

// POST /api/transactions/drafts/autosave - Save transaction as draft
router.post('/drafts/autosave', requirePermission('transactions', 'canCreateTransactions'), saveDraft);

// DELETE /api/transactions/drafts/:draftId - Delete a specific draft
router.delete('/drafts/:draftId', requirePermission('transactions', 'canDeleteTransactions'), deleteDraft);

// GET /api/transactions/:id - Get transaction by ID
router.get('/:id', requirePermission('transactions', 'canViewTransactions'), getTransactionById);

// POST /api/transactions - Create new transaction (rate limited)
router.post('/', sensitiveOperationRateLimit, requirePermission('transactions', 'canCreateTransactions'), createTransaction);

// POST /api/transactions/:id/invoice - Generate invoice for transaction (rate limited)
router.post('/:id/invoice', fileGenerationRateLimit, requirePermission('transactions', 'canViewTransactions'), generateTransactionInvoice);

// POST /api/transactions/:id/send-invoice-email - Send or resend invoice email (rate limited)
router.post('/:id/send-invoice-email', emailRateLimit, requirePermission('transactions', 'canViewTransactions'), sendInvoiceEmail);

// POST /api/transactions/:id/duplicate - Duplicate a transaction as a new draft
router.post('/:id/duplicate', requirePermission('transactions', 'canCreateTransactions'), duplicateTransaction);

// PUT /api/transactions/:id - Update transaction
// Uses draft-aware permission: drafts require canEditDrafts + ownership, completed transactions require canEditTransactions
router.put('/:id', requireDraftOrEditPermission(), updateTransaction);

// DELETE /api/transactions/:id - Delete transaction
router.delete('/:id', requirePermission('transactions', 'canDeleteTransactions'), deleteTransaction);

export default router;