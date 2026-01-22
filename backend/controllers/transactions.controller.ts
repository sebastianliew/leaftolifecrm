import { Request, Response } from 'express';
import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';
import { Transaction } from '../models/Transaction.js';
import { getNextSequence } from '../models/Counter.js';
import { InvoiceGenerator } from '../services/invoiceGenerator.js';
import { emailService } from '../services/EmailService.js';
import { blobStorageService } from '../services/BlobStorageService.js';
import { PermissionService } from '../lib/permissions/PermissionService.js';
import type { FeaturePermissions } from '../lib/permissions/types.js';
import { createAuditLog } from '../models/AuditLog.js';
import { transactionInventoryService } from '../services/TransactionInventoryService.js';

const permissionService = PermissionService.getInstance();

// Helper function to generate invoice asynchronously (fire-and-forget)
// This runs in background after response is sent to user
async function generateInvoiceAsync(
  savedTransaction: {
    _id: unknown;
    transactionNumber: string;
    transactionDate: Date;
    customerName: string;
    customerEmail?: string;
    customerPhone?: string;
    items: Array<{
      name: string;
      quantity: number;
      unitPrice: number;
      discountAmount?: number;
      itemType?: string;
    }>;
    discountAmount: number;
    totalAmount: number;
    paymentMethod: string;
    paymentStatus: string;
    notes?: string;
    currency: string;
    dueDate?: Date;
    paidDate?: Date;
    paidAmount: number;
  },
  transactionId: unknown
): Promise<void> {
  const invoiceNumber = savedTransaction.transactionNumber;

  try {
    // Update status to generating
    await Transaction.findByIdAndUpdate(transactionId, { invoiceStatus: 'generating' });

    // Ensure invoices directory exists
    const invoicesDir = path.join(process.cwd(), 'invoices');
    if (!fs.existsSync(invoicesDir)) {
      fs.mkdirSync(invoicesDir, { recursive: true });
    }

    // Prepare invoice data
    const subtotal = savedTransaction.items.reduce((sum, item) => sum + ((item.unitPrice ?? 0) * (item.quantity ?? 0)), 0);
    const totalDiscounts = savedTransaction.items.reduce((sum, item) => sum + (item.discountAmount ?? 0), 0);
    const additionalDiscount = savedTransaction.discountAmount ?? 0;
    // Calculate correct total from subtotal minus discounts
    const calculatedTotal = subtotal - totalDiscounts - additionalDiscount;

    const invoiceData = {
      invoiceNumber,
      transactionNumber: savedTransaction.transactionNumber,
      transactionDate: savedTransaction.transactionDate,
      customerName: savedTransaction.customerName,
      customerEmail: savedTransaction.customerEmail,
      customerPhone: savedTransaction.customerPhone,
      items: savedTransaction.items.map(item => ({
        name: item.name,
        quantity: item.quantity ?? 0,
        unitPrice: item.unitPrice ?? 0,
        totalPrice: (item.unitPrice ?? 0) * (item.quantity ?? 0) - (item.discountAmount ?? 0),
        discountAmount: item.discountAmount,
        itemType: item.itemType as 'product' | 'fixed_blend' | 'custom_blend' | 'bundle' | 'miscellaneous' | 'consultation' | 'service' | undefined
      })),
      subtotal,
      discountAmount: totalDiscounts,
      additionalDiscount,
      totalAmount: calculatedTotal,
      paymentMethod: savedTransaction.paymentMethod,
      paymentStatus: savedTransaction.paymentStatus,
      notes: savedTransaction.notes,
      currency: savedTransaction.currency || 'SGD',
      dueDate: savedTransaction.dueDate || undefined,
      paidDate: savedTransaction.paidDate,
      paidAmount: savedTransaction.paidAmount,
      status: savedTransaction.paymentStatus
    };

    // Generate PDF
    const invoiceFileName = `${invoiceNumber}-LeafToLife.pdf`;
    const invoiceFilePath = path.join(invoicesDir, invoiceFileName);
    const relativeInvoicePath = `invoices/${invoiceFileName}`;

    const generator = new InvoiceGenerator();
    await generator.generateInvoice(invoiceData, invoiceFilePath);

    // Upload to blob storage
    await blobStorageService.uploadFile(invoiceFilePath, invoiceFileName);

    // Update transaction with invoice info and correct total if needed
    const invoiceUpdateData: Record<string, unknown> = {
      invoiceGenerated: true,
      invoiceStatus: 'completed',
      invoiceNumber: invoiceNumber,
      invoicePath: relativeInvoicePath
    };
    // Also correct totalAmount if it differs from calculated (fixes old transactions with incorrect totals)
    if (savedTransaction.totalAmount !== calculatedTotal) {
      console.log('[Transaction] Correcting stored totalAmount from', savedTransaction.totalAmount, 'to', calculatedTotal);
      invoiceUpdateData.totalAmount = calculatedTotal;
    }
    await Transaction.findByIdAndUpdate(transactionId, invoiceUpdateData);

    console.log('[Transaction] Background invoice generated:', invoiceNumber);

    // Email sending (non-critical, also async)
    if (savedTransaction.customerEmail && emailService.isEnabled()) {
      try {
        const emailSent = await emailService.sendInvoiceEmail(
          savedTransaction.customerEmail,
          savedTransaction.customerName,
          invoiceNumber,
          invoiceFilePath,
          calculatedTotal, // Use calculated total instead of stored value
          savedTransaction.transactionDate,
          savedTransaction.paymentStatus || 'pending'
        );

        if (emailSent) {
          await Transaction.findByIdAndUpdate(transactionId, {
            invoiceEmailSent: true,
            invoiceEmailSentAt: new Date(),
            invoiceEmailRecipient: savedTransaction.customerEmail
          });
          console.log('[Transaction] Invoice email sent:', savedTransaction.customerEmail);
        }
      } catch (emailError) {
        console.error('[Transaction] Email sending failed:', emailError);
      }
    }

  } catch (pdfError) {
    // PDF generation failed - mark transaction but don't delete it
    const invoiceError = pdfError instanceof Error ? pdfError.message : 'Unknown error';
    console.error('[Transaction] Invoice generation failed:', invoiceError);

    await Transaction.findByIdAndUpdate(transactionId, {
      invoiceStatus: 'failed',
      invoiceError: invoiceError
    });
  }
}

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    username: string;
    featurePermissions?: Partial<FeaturePermissions>;
  };
}

// GET /api/transactions - Get all transactions with pagination
export const getTransactions = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const {
      search,
      page = '1',
      limit = '20',
      paymentStatus,
      status,
      dateFrom,
      dateTo
    } = req.query;

    const pageNumber = Math.max(1, parseInt(page as string, 10));
    const limitNumber = Math.max(1, Math.min(100, parseInt(limit as string, 10))); // Cap at 100
    const skip = (pageNumber - 1) * limitNumber;

    // Build filter
    interface TransactionFilter {
      $or?: Array<{
        transactionNumber?: { $regex: unknown; $options: string };
        customerName?: { $regex: unknown; $options: string };
        customerEmail?: { $regex: unknown; $options: string };
      }>;
      paymentStatus?: string;
      status?: string;
      transactionDate?: {
        $gte?: Date;
        $lte?: Date;
      };
    }

    const filter: TransactionFilter = {};

    // Payment status filter
    if (paymentStatus && typeof paymentStatus === 'string') {
      filter.paymentStatus = paymentStatus;
    }

    // Transaction status filter
    if (status && typeof status === 'string') {
      filter.status = status;
    }

    // Date range filter
    if (dateFrom || dateTo) {
      filter.transactionDate = {};
      if (dateFrom && typeof dateFrom === 'string') {
        filter.transactionDate.$gte = new Date(dateFrom);
      }
      if (dateTo && typeof dateTo === 'string') {
        // Set to end of day for inclusive date range
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        filter.transactionDate.$lte = endDate;
      }
    }

    // Text search filter
    if (search) {
      // Split search term into words for better multi-word matching
      const searchTerm = search as string;
      const searchWords = searchTerm.trim().split(/\s+/);

      if (searchWords.length > 1) {
        // For multi-word searches, create patterns that match all words in any order
        const wordPatterns = searchWords.map(word => `(?=.*${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`);
        const combinedPattern = `^${wordPatterns.join('')}.*`;

        filter.$or = [
          { transactionNumber: { $regex: searchTerm, $options: 'i' } },
          { customerName: { $regex: combinedPattern, $options: 'i' } },
          { customerEmail: { $regex: searchTerm, $options: 'i' } },
          // Also try exact phrase match
          { customerName: { $regex: searchTerm, $options: 'i' } }
        ];
      } else {
        // Single word search (original behavior)
        filter.$or = [
          { transactionNumber: { $regex: searchTerm, $options: 'i' } },
          { customerName: { $regex: searchTerm, $options: 'i' } },
          { customerEmail: { $regex: searchTerm, $options: 'i' } }
        ];
      }
    }

    // Get total count for pagination
    const totalCount = await Transaction.countDocuments(filter);

    // Get transactions with pagination
    const transactions = await Transaction.find(filter)
      .sort({ transactionDate: -1 })
      .skip(skip)
      .limit(limitNumber)
      .lean();

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limitNumber);
    const hasNextPage = pageNumber < totalPages;
    const hasPreviousPage = pageNumber > 1;

    res.status(200).json({
      transactions,
      pagination: {
        currentPage: pageNumber,
        totalPages,
        totalCount,
        limit: limitNumber,
        hasNextPage,
        hasPreviousPage
      }
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
};

// GET /api/transactions/:id - Get transaction by ID
export const getTransactionById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid transaction ID' });
      return;
    }

    const transaction = await Transaction.findById(id);

    if (!transaction) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }

    res.status(200).json(transaction);
  } catch (error) {
    console.error('Error fetching transaction:', error);
    res.status(500).json({ error: 'Failed to fetch transaction' });
  }
};

// POST /api/transactions - Create transaction
// FIX: Two-phase approach - transaction saved immediately (visible for updates),
// then PDF generated separately. This prevents "unable to update item" during invoice generation.
// The atomic counter (pre-save hook) handles transaction number uniqueness without sessions.
export const createTransaction = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const startTime = Date.now();

  try {
    const transactionData = req.body;

    // Basic validation
    if (!transactionData.customerName || !transactionData.items || transactionData.items.length === 0) {
      res.status(400).json({ error: 'Customer name and items are required' });
      return;
    }

    // Validate all items have valid names (prevent "Unknown Item" entries)
    const invalidItems = transactionData.items.filter((item: { name?: string }) =>
      !item.name || item.name.trim() === '' || item.name === 'Unknown Item'
    );
    if (invalidItems.length > 0) {
      res.status(400).json({
        error: `${invalidItems.length} item(s) have missing or invalid names`,
        details: 'Items must have valid product names'
      });
      return;
    }

    // Validate discount permissions
    if (req.user) {
      // Check bill-level discount
      if (transactionData.discountAmount && transactionData.discountAmount > 0) {
        const subtotal = transactionData.items.reduce((sum: number, item: { unitPrice?: number; quantity?: number }) =>
          sum + ((item.unitPrice ?? 0) * (item.quantity ?? 0)), 0);
        const discountPercent = subtotal > 0 ? (transactionData.discountAmount / subtotal) * 100 : 0;

        const billDiscountCheck = permissionService.checkDiscountPermission(
          { role: req.user.role, featurePermissions: req.user.featurePermissions },
          discountPercent,
          transactionData.discountAmount,
          'bill'
        );

        if (!billDiscountCheck.allowed) {
          res.status(403).json({ error: billDiscountCheck.reason || 'Bill discount not permitted' });
          return;
        }
      }

      // Check item-level discounts
      for (const item of transactionData.items) {
        if (item.discountAmount && item.discountAmount > 0) {
          const itemTotal = (item.unitPrice ?? 0) * (item.quantity ?? 0);
          const itemDiscountPercent = itemTotal > 0 ? (item.discountAmount / itemTotal) * 100 : 0;

          const productDiscountCheck = permissionService.checkDiscountPermission(
            { role: req.user.role, featurePermissions: req.user.featurePermissions },
            itemDiscountPercent,
            item.discountAmount,
            'product'
          );

          if (!productDiscountCheck.allowed) {
            res.status(403).json({
              error: productDiscountCheck.reason || 'Product discount not permitted',
              item: item.name
            });
            return;
          }
        }
      }
    }

    // Always remove transaction numbers that are empty or start with DRAFT to ensure proper TXN generation
    if (!transactionData.transactionNumber ||
        transactionData.transactionNumber.trim() === '' ||
        transactionData.transactionNumber.startsWith('DRAFT')) {
      delete transactionData.transactionNumber;
    }

    // ========================================================================
    // PHASE 1: Create and save transaction with inventory deduction (atomic)
    // Uses MongoDB session for atomicity - if inventory deduction fails,
    // transaction is rolled back to maintain data consistency.
    // ========================================================================
    const session = await mongoose.startSession();
    let savedTransaction;
    let transactionId;

    try {
      session.startTransaction();

      // Set type to COMPLETED for non-draft transactions
      const transactionType = transactionData.status !== 'draft' ? 'COMPLETED' : 'DRAFT';

      const transaction = new Transaction({
        ...transactionData,
        type: transactionType,
        createdBy: req.user?.id || 'system',
        invoiceStatus: 'pending'
      });

      savedTransaction = await transaction.save({ session });
      transactionId = savedTransaction._id;

      console.log('[Transaction] Transaction saved:', transactionId);

      // ========================================================================
      // PHASE 2: Process inventory deduction (skip for draft transactions)
      // Deducts stock for products, fixed blends, and bundles.
      // Custom blends are handled separately by CustomBlendService.
      // ========================================================================
      if (savedTransaction.status !== 'draft') {
        const inventoryResult = await transactionInventoryService.processTransactionInventory(
          savedTransaction,
          req.user?.id || 'system',
          session
        );

        if (inventoryResult.errors.length > 0) {
          // Log warnings but don't fail - system allows negative stock
          console.warn('[Transaction] Inventory processing had errors:', inventoryResult.errors);
        }

        console.log(`[Transaction] Inventory processed: ${inventoryResult.movements.length} movements created`);
      } else {
        console.log('[Transaction] Skipping inventory deduction for draft transaction');
      }

      await session.commitTransaction();
      console.log('[Transaction] Session committed successfully');

    } catch (sessionError) {
      await session.abortTransaction();
      console.error('[Transaction] Session aborted due to error:', sessionError);
      throw sessionError;
    } finally {
      session.endSession();
    }

    // Create audit log (fire-and-forget)
    createAuditLog({
      entityType: 'transaction',
      entityId: savedTransaction._id,
      action: 'create',
      status: 'success',
      userId: req.user?.id,
      userEmail: req.user?.email,
      metadata: {
        transactionNumber: savedTransaction.transactionNumber,
        totalAmount: savedTransaction.totalAmount
      },
      duration: Date.now() - startTime
    });

    // Return response IMMEDIATELY - don't wait for invoice generation
    // This reduces response time from 6-10 seconds to ~100-200ms
    res.status(201).json({
      ...savedTransaction.toObject(),
      _invoiceGenerated: false,
      _emailSent: false,
      _invoiceGenerating: true, // Indicates invoice is being generated in background
      _invoiceError: null
    });

    // ========================================================================
    // ASYNC PHASE: Generate invoice in background (fire-and-forget)
    // This runs AFTER response is sent - user doesn't wait for it
    // ========================================================================
    generateInvoiceAsync(savedTransaction, transactionId).catch(error => {
      console.error('[Transaction] Background invoice generation failed:', error);
    });

  } catch (error) {
    console.error('Error creating transaction:', error);

    // Log the failure
    createAuditLog({
      entityType: 'transaction',
      entityId: 'unknown',
      action: 'create',
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      userEmail: req.user?.email,
      metadata: {
        customerName: req.body?.customerName,
        totalAmount: req.body?.totalAmount
      },
      duration: Date.now() - startTime
    });

    res.status(500).json({
      error: 'Failed to create transaction',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// PUT /api/transactions/:id - Update transaction
// FIX: When converting a draft to a completed transaction, generate an invoice
export const updateTransaction = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid transaction ID' });
      return;
    }

    // Validate all items have valid names if items are being updated
    if (updateData.items && Array.isArray(updateData.items)) {
      const invalidItems = updateData.items.filter((item: { name?: string }) =>
        !item.name || item.name.trim() === '' || item.name === 'Unknown Item'
      );
      if (invalidItems.length > 0) {
        res.status(400).json({
          error: `${invalidItems.length} item(s) have missing or invalid names`,
          details: 'Items must have valid product names'
        });
        return;
      }
    }

    // Fetch current transaction to check if we're converting from draft
    const existingTransaction = await Transaction.findById(id);
    if (!existingTransaction) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }

    // Detect cancelled transaction being edited - restore to draft
    const wasCancelled = existingTransaction.status === 'cancelled';
    if (wasCancelled) {
      console.log('[Transaction] Cancelled transaction being edited, restoring to draft:', id);
      updateData.status = 'draft';
      updateData.type = 'DRAFT';
      // Reset invoice fields so new invoice generates on completion
      updateData.invoiceGenerated = false;
      updateData.invoiceStatus = 'none';
      updateData.invoiceUrl = undefined;
      updateData.invoicePdfPath = undefined;
    }

    // Check if this is a draft being converted to a completed transaction
    const wasDraft = existingTransaction.status === 'draft' || wasCancelled;
    const isBeingCompleted = updateData.status && updateData.status !== 'draft';
    const needsInventoryDeduction = wasDraft && isBeingCompleted;
    const needsInvoice = needsInventoryDeduction && !existingTransaction.invoiceGenerated;

    // When a draft is being completed, update type to COMPLETED
    if (wasDraft && isBeingCompleted) {
      updateData.type = 'COMPLETED';
    }

    // Check if this is a completed transaction being cancelled (needs inventory reversal)
    const wasCompleted = existingTransaction.status === 'completed';
    const isBeingCancelled = updateData.status === 'cancelled';
    const needsInventoryReversal = wasCompleted && isBeingCancelled;

    // Update the transaction first
    const updatedTransaction = await Transaction.findByIdAndUpdate(
      id,
      { ...updateData, lastModifiedBy: req.user?.id || 'system' },
      { new: true }
    );

    if (!updatedTransaction) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }

    // If converting from draft to completed, process inventory deduction
    if (needsInventoryDeduction) {
      console.log('[Transaction] Draft being converted to completed, processing inventory:', id);

      try {
        const inventorySession = await mongoose.startSession();
        try {
          inventorySession.startTransaction();

          const inventoryResult = await transactionInventoryService.processTransactionInventory(
            updatedTransaction,
            req.user?.id || 'system',
            inventorySession
          );

          await inventorySession.commitTransaction();
          console.log(`[Transaction] Inventory processed for draft conversion: ${inventoryResult.movements.length} movements`);

          if (inventoryResult.errors.length > 0) {
            console.warn('[Transaction] Inventory processing had errors:', inventoryResult.errors);
          }
        } catch (invError) {
          await inventorySession.abortTransaction();
          console.error('[Transaction] Inventory processing failed for draft conversion:', invError);
          // Continue - inventory can be reconciled later
        } finally {
          inventorySession.endSession();
        }
      } catch (sessionError) {
        console.error('[Transaction] Failed to create inventory session:', sessionError);
      }
    }

    // If cancelling a completed transaction, reverse inventory deductions
    if (needsInventoryReversal) {
      console.log('[Transaction] Completed transaction being cancelled, reversing inventory:', id);

      try {
        const reversalSession = await mongoose.startSession();
        try {
          reversalSession.startTransaction();

          const reversalResult = await transactionInventoryService.reverseTransactionInventory(
            existingTransaction.transactionNumber,
            req.user?.id || 'system',
            reversalSession
          );

          await reversalSession.commitTransaction();
          console.log(`[Transaction] Inventory reversed: ${reversalResult.reversedCount}/${reversalResult.originalMovementCount} movements`);

          if (reversalResult.errors.length > 0) {
            console.warn('[Transaction] Inventory reversal had errors:', reversalResult.errors);
          }
          if (reversalResult.warnings.length > 0) {
            console.log('[Transaction] Inventory reversal warnings:', reversalResult.warnings);
          }
        } catch (reversalError) {
          await reversalSession.abortTransaction();
          console.error('[Transaction] Inventory reversal failed:', reversalError);
          // Continue - cancellation succeeds, inventory can be reconciled manually
        } finally {
          reversalSession.endSession();
        }
      } catch (sessionError) {
        console.error('[Transaction] Failed to create reversal session:', sessionError);
      }
    }

    // If converting from draft to completed AND no invoice exists, generate invoice
    if (needsInvoice) {
      console.log('[Transaction] Attempting invoice generation:', id);

      // ATOMIC LOCK: Only proceed if we can atomically set invoiceStatus to 'generating'
      // This prevents multiple concurrent requests from generating duplicate invoices
      const lockedTransaction = await Transaction.findOneAndUpdate(
        {
          _id: id,
          invoiceGenerated: { $ne: true },
          invoiceStatus: { $nin: ['generating', 'completed'] }
        },
        { $set: { invoiceStatus: 'generating' } },
        { new: true }
      );

      if (!lockedTransaction) {
        console.log('[Transaction] Invoice generation already in progress or completed, skipping:', id);
        // Invoice is already being generated or was generated - return current state
        const currentTransaction = await Transaction.findById(id);
        res.status(200).json({
          ...currentTransaction?.toObject(),
          _invoiceSkipped: true,
          _reason: 'Invoice generation already in progress or completed'
        });
        return;
      }

      try {

        // Ensure invoices directory exists
        const invoicesDir = path.join(process.cwd(), 'invoices');
        if (!fs.existsSync(invoicesDir)) {
          fs.mkdirSync(invoicesDir, { recursive: true });
        }

        // Prepare invoice data
        const invoiceNumber = updatedTransaction.transactionNumber;
        const subtotal = updatedTransaction.items.reduce((sum, item) => sum + ((item.unitPrice ?? 0) * (item.quantity ?? 0)), 0);
        const totalDiscounts = updatedTransaction.items.reduce((sum, item) => sum + (item.discountAmount ?? 0), 0);

        const invoiceData = {
          invoiceNumber,
          transactionNumber: updatedTransaction.transactionNumber,
          transactionDate: updatedTransaction.transactionDate,
          customerName: updatedTransaction.customerName,
          customerEmail: updatedTransaction.customerEmail,
          customerPhone: updatedTransaction.customerPhone,
          items: updatedTransaction.items.map(item => ({
            name: item.name,
            quantity: item.quantity ?? 0,
            unitPrice: item.unitPrice ?? 0,
            totalPrice: (item.unitPrice ?? 0) * (item.quantity ?? 0) - (item.discountAmount ?? 0),
            discountAmount: item.discountAmount,
            itemType: item.itemType
          })),
          subtotal,
          discountAmount: totalDiscounts,
          additionalDiscount: updatedTransaction.discountAmount ?? 0,
          totalAmount: updatedTransaction.totalAmount,
          paymentMethod: updatedTransaction.paymentMethod,
          paymentStatus: updatedTransaction.paymentStatus,
          notes: updatedTransaction.notes,
          currency: updatedTransaction.currency || 'SGD',
          dueDate: updatedTransaction.dueDate || undefined,
          paidDate: updatedTransaction.paidDate,
          paidAmount: updatedTransaction.paidAmount,
          status: updatedTransaction.paymentStatus
        };

        // Generate PDF
        const invoiceFileName = `${invoiceNumber}-LeafToLife.pdf`;
        const invoiceFilePath = path.join(invoicesDir, invoiceFileName);
        const relativeInvoicePath = `invoices/${invoiceFileName}`;

        const generator = new InvoiceGenerator();
        await generator.generateInvoice(invoiceData, invoiceFilePath);

        // Upload to storage
        await blobStorageService.uploadFile(invoiceFilePath, invoiceFileName);

        // Update transaction with invoice info
        const finalTransaction = await Transaction.findByIdAndUpdate(
          id,
          {
            invoiceGenerated: true,
            invoiceStatus: 'completed',
            invoiceNumber: invoiceNumber,
            invoicePath: relativeInvoicePath
          },
          { new: true }
        );

        console.log('[Transaction] Invoice generated for converted draft:', invoiceNumber);

        res.status(200).json({
          ...finalTransaction?.toObject(),
          _invoiceGenerated: true
        });
        return;

      } catch (invoiceError) {
        console.error('[Transaction] Invoice generation failed for draft conversion:', invoiceError);

        // Mark invoice as failed but still return the updated transaction
        await Transaction.findByIdAndUpdate(id, {
          invoiceStatus: 'failed',
          invoiceError: invoiceError instanceof Error ? invoiceError.message : 'Unknown error'
        });

        // Return the transaction anyway - invoice can be regenerated later
        const failedTransaction = await Transaction.findById(id);
        res.status(200).json({
          ...failedTransaction?.toObject(),
          _invoiceGenerated: false,
          _invoiceError: invoiceError instanceof Error ? invoiceError.message : 'Unknown error'
        });
        return;
      }
    }

    res.status(200).json(updatedTransaction);
  } catch (error) {
    console.error('Error updating transaction:', error);
    res.status(500).json({ error: 'Failed to update transaction' });
  }
};

// DELETE /api/transactions/:id - Delete transaction
export const deleteTransaction = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid transaction ID' });
      return;
    }

    const deletedTransaction = await Transaction.findByIdAndDelete(id);

    if (!deletedTransaction) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }

    res.status(200).json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
};

// POST /api/transactions/:id/invoice - Generate invoice for transaction
export const generateTransactionInvoice = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    console.log('[Invoice] Generating invoice for transaction:', id);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid transaction ID' });
      return;
    }

    // Fetch transaction
    const transaction = await Transaction.findById(id);

    if (!transaction) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }

    // Check if invoice already exists - if so, delete it to allow regeneration
    if (transaction.invoiceGenerated && transaction.invoicePath) {
      console.log('[Invoice] Invoice already exists for transaction:', id);
      // Use process.cwd() for consistent path resolution
      const invoiceFilePath = path.join(process.cwd(), transaction.invoicePath);

      // Delete existing file if it exists to allow regeneration with updated data
      if (fs.existsSync(invoiceFilePath)) {
        console.log('[Invoice] Deleting existing invoice to regenerate:', invoiceFilePath);
        fs.unlinkSync(invoiceFilePath);
      }
    }

    // Generate invoice number using transaction number format
    const invoiceNumber = transaction.transactionNumber;

    // Ensure invoices directory exists
    // Use process.cwd() for consistent path in both dev and production
    const invoicesDir = path.join(process.cwd(), 'invoices');
    if (!fs.existsSync(invoicesDir)) {
      console.log('[Invoice] Creating invoices directory:', invoicesDir);
      fs.mkdirSync(invoicesDir, { recursive: true });
    }

    // Prepare invoice data
    const subtotal = transaction.items.reduce((sum, item) => sum + ((item.unitPrice ?? 0) * (item.quantity ?? 0)), 0);
    const totalDiscounts = transaction.items.reduce((sum, item) => sum + (item.discountAmount ?? 0), 0);

    // Calculate correct total from subtotal minus discounts
    const additionalDiscount = transaction.discountAmount ?? 0;
    const calculatedTotal = subtotal - totalDiscounts - additionalDiscount;

    const invoiceData = {
      invoiceNumber,
      transactionNumber: transaction.transactionNumber,
      transactionDate: transaction.transactionDate,
      customerName: transaction.customerName,
      customerEmail: transaction.customerEmail,
      customerPhone: transaction.customerPhone,
      items: transaction.items.map(item => ({
        name: item.name,
        quantity: item.quantity ?? 0,
        unitPrice: item.unitPrice ?? 0,
        totalPrice: (item.unitPrice ?? 0) * (item.quantity ?? 0) - (item.discountAmount ?? 0),
        discountAmount: item.discountAmount,
        itemType: item.itemType
      })),
      subtotal,
      discountAmount: totalDiscounts,
      additionalDiscount,
      totalAmount: calculatedTotal,
      paymentMethod: transaction.paymentMethod,
      paymentStatus: transaction.paymentStatus,
      notes: transaction.notes,
      currency: transaction.currency || 'SGD',
      dueDate: transaction.dueDate || undefined, // undefined will show "Upon Receipt" in PDF
      paidDate: transaction.paidDate,
      paidAmount: transaction.paidAmount,
      status: transaction.paymentStatus
    };

    // Generate PDF with proper filename format: TXN-XX_XX_XXXX-XXXX-LeafToLife.pdf
    const invoiceFileName = `${invoiceNumber}-LeafToLife.pdf`;
    const invoiceFilePath = path.join(invoicesDir, invoiceFileName);
    const relativeInvoicePath = `invoices/${invoiceFileName}`;

    console.log('[Invoice] Generating PDF at:', invoiceFilePath);

    const generator = new InvoiceGenerator();
    await generator.generateInvoice(invoiceData, invoiceFilePath);

    // Upload to Azure Blob Storage (or keep local if not configured)
    await blobStorageService.uploadFile(invoiceFilePath, invoiceFileName);

    // Update transaction with invoice info and correct total if needed (use findByIdAndUpdate to avoid full document validation)
    const updateData: Record<string, unknown> = {
      invoiceGenerated: true,
      invoiceNumber,
      invoicePath: relativeInvoicePath,
      lastModifiedBy: req.user?.id || 'system'
    };
    // Also correct totalAmount if it differs from calculated (fixes old transactions with incorrect totals)
    if (transaction.totalAmount !== calculatedTotal) {
      console.log('[Invoice] Correcting stored totalAmount from', transaction.totalAmount, 'to', calculatedTotal);
      updateData.totalAmount = calculatedTotal;
    }
    await Transaction.findByIdAndUpdate(id, updateData);

    console.log('[Invoice] Invoice generated successfully:', invoiceNumber);

    // Determine if email will be attempted
    const willAttemptEmail = !!transaction.customerEmail && emailService.isEnabled();

    // Log email status
    if (!willAttemptEmail) {
      if (transaction.customerEmail && !emailService.isEnabled()) {
        console.warn('[Invoice] Email service not configured. Skipping automatic email send.');
      } else if (!transaction.customerEmail) {
        console.warn('[Invoice] No customer email provided. Skipping automatic email send.');
      }
    }

    // Return response IMMEDIATELY after PDF is generated (fire-and-forget pattern)
    res.status(200).json({
      success: true,
      message: 'Invoice generated successfully',
      invoiceNumber,
      invoicePath: relativeInvoicePath,
      downloadUrl: `/api/invoices/${invoiceFileName}`,
      emailSent: false,
      emailPending: willAttemptEmail
    });

    // Fire-and-forget: Send email in background AFTER response
    if (willAttemptEmail) {
      (async () => {
        try {
          console.log('[Invoice] Background: sending invoice email to:', transaction.customerEmail);

          const emailSent = await emailService.sendInvoiceEmail(
            transaction.customerEmail!,
            transaction.customerName,
            invoiceNumber,
            invoiceFilePath,
            calculatedTotal,
            transaction.transactionDate,
            transaction.paymentStatus || 'pending'
          );

          if (emailSent) {
            await Transaction.findByIdAndUpdate(id, {
              invoiceEmailSent: true,
              invoiceEmailSentAt: new Date(),
              invoiceEmailRecipient: transaction.customerEmail!
            });
            console.log('[Invoice] Background: email sent successfully to:', transaction.customerEmail);
          }
        } catch (error) {
          console.error('[Invoice] Background: failed to send email:', error);
          // Don't throw - this is fire-and-forget
        }
      })();
    }
  } catch (error) {
    console.error('[Invoice] Error generating invoice:', error);
    res.status(500).json({ error: 'Failed to generate invoice' });
  }
};

// POST /api/transactions/:id/send-invoice-email - Send or resend invoice email
export const sendInvoiceEmail = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    console.log('[Email] Sending invoice email for transaction:', id);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid transaction ID' });
      return;
    }

    // Fetch transaction
    const transaction = await Transaction.findById(id);

    if (!transaction) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }

    // Check if customer email exists
    if (!transaction.customerEmail) {
      res.status(400).json({ error: 'Customer email not found in transaction' });
      return;
    }

    // Check if email service is enabled
    if (!emailService.isEnabled()) {
      res.status(503).json({
        error: 'Email service not configured',
        message: 'Please configure email settings in environment variables'
      });
      return;
    }

    // ALWAYS regenerate the invoice to keep it fresh
    console.log('[Email] Regenerating invoice before sending email');

    // Delete existing invoice if it exists
    if (transaction.invoiceGenerated && transaction.invoicePath) {
      // Use process.cwd() for consistent path resolution
      const invoiceFilePath = path.join(process.cwd(), transaction.invoicePath);
      if (fs.existsSync(invoiceFilePath)) {
        console.log('[Email] Deleting existing invoice:', invoiceFilePath);
        fs.unlinkSync(invoiceFilePath);
      }
    }

    // Generate invoice number
    const invoiceNumber = transaction.transactionNumber;

    // Ensure invoices directory exists
    // Use process.cwd() for consistent path in both dev and production
    const invoicesDir = path.join(process.cwd(), 'invoices');
    if (!fs.existsSync(invoicesDir)) {
      fs.mkdirSync(invoicesDir, { recursive: true });
    }

    // Prepare invoice data
    const subtotal = transaction.items.reduce((sum, item) => sum + ((item.unitPrice ?? 0) * (item.quantity ?? 0)), 0);
    const totalDiscounts = transaction.items.reduce((sum, item) => sum + (item.discountAmount ?? 0), 0);

    // Calculate correct total from subtotal minus discounts
    const additionalDiscount = transaction.discountAmount ?? 0;
    const calculatedTotal = subtotal - totalDiscounts - additionalDiscount;

    const invoiceData = {
      invoiceNumber,
      transactionNumber: transaction.transactionNumber,
      transactionDate: transaction.transactionDate,
      customerName: transaction.customerName,
      customerEmail: transaction.customerEmail,
      customerPhone: transaction.customerPhone,
      items: transaction.items.map(item => ({
        name: item.name,
        quantity: item.quantity ?? 0,
        unitPrice: item.unitPrice ?? 0,
        totalPrice: (item.unitPrice ?? 0) * (item.quantity ?? 0) - (item.discountAmount ?? 0),
        discountAmount: item.discountAmount,
        itemType: item.itemType
      })),
      subtotal,
      discountAmount: totalDiscounts,
      additionalDiscount,
      totalAmount: calculatedTotal,
      paymentMethod: transaction.paymentMethod,
      paymentStatus: transaction.paymentStatus,
      notes: transaction.notes,
      currency: transaction.currency || 'SGD',
      dueDate: transaction.dueDate || undefined,
      paidDate: transaction.paidDate,
      paidAmount: transaction.paidAmount,
      status: transaction.paymentStatus
    };

    // Generate PDF
    const invoiceFileName = `${invoiceNumber}-LeafToLife.pdf`;
    const invoiceFilePath = path.join(invoicesDir, invoiceFileName);
    const relativeInvoicePath = `invoices/${invoiceFileName}`;

    console.log('[Email] Generating fresh PDF at:', invoiceFilePath);

    const generator = new InvoiceGenerator();
    await generator.generateInvoice(invoiceData, invoiceFilePath);

    // Upload to Azure Blob Storage (or keep local if not configured)
    await blobStorageService.uploadFile(invoiceFilePath, invoiceFileName);

    // Send email with invoice attachment
    console.log('[Email] Sending email to:', transaction.customerEmail);

    const emailSent = await emailService.sendInvoiceEmail(
      transaction.customerEmail,
      transaction.customerName,
      invoiceNumber,
      invoiceFilePath,
      calculatedTotal, // Use calculated total instead of stored value
      transaction.transactionDate,
      transaction.paymentStatus || 'pending'
    );

    if (emailSent) {
      // Update transaction with email sent info (use findByIdAndUpdate to avoid full document validation)
      const emailSentAt = new Date();
      const emailUpdateData: Record<string, unknown> = {
        invoiceGenerated: true,
        invoiceNumber,
        invoicePath: relativeInvoicePath,
        invoiceEmailSent: true,
        invoiceEmailSentAt: emailSentAt,
        invoiceEmailRecipient: transaction.customerEmail,
        lastModifiedBy: req.user?.id || 'system'
      };
      // Also correct totalAmount if it differs from calculated (fixes old transactions with incorrect totals)
      if (transaction.totalAmount !== calculatedTotal) {
        console.log('[Email] Correcting stored totalAmount from', transaction.totalAmount, 'to', calculatedTotal);
        emailUpdateData.totalAmount = calculatedTotal;
      }
      await Transaction.findByIdAndUpdate(id, emailUpdateData);

      console.log('[Email] Invoice email sent successfully to:', transaction.customerEmail);

      res.status(200).json({
        success: true,
        message: 'Invoice email sent successfully',
        emailSent: true,
        recipient: transaction.customerEmail,
        sentAt: emailSentAt
      });
    } else {
      // Email service returned false (not configured)
      res.status(503).json({
        error: 'Email service not configured',
        message: 'Email sending is disabled. Please configure email settings.'
      });
    }
  } catch (error) {
    console.error('[Email] Error sending invoice email:', error);
    res.status(500).json({
      error: 'Failed to send invoice email',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// POST /api/transactions/drafts/autosave - Save transaction as draft
export const saveDraft = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { draftId, draftName, formData } = req.body;

    if (!req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Convert form data to transaction format
    // Don't set transactionNumber - let the pre-save middleware generate a proper TXN number
    const transactionData = {
      customerName: formData.customerName || 'Draft Customer',
      customerId: formData.customerId,
      customerEmail: formData.customerEmail,
      customerPhone: formData.customerPhone,
      items: formData.items || [],
      subtotal: formData.subtotal || 0,
      discountAmount: formData.discount || 0,
      totalAmount: formData.total || formData.subtotal || 0,
      paymentMethod: formData.paymentMethod || 'cash',
      paymentStatus: formData.paymentStatus || 'pending',
      status: formData.status || 'draft',
      notes: `Draft: ${draftName || 'Auto-saved draft'}`,
      transactionDate: new Date(),
      currency: 'SGD',
      createdBy: req.user.id,
      lastModifiedBy: req.user.id,
      draftId: draftId // Store the client-side draft ID for reference
    };

    // Use atomic findOneAndUpdate with upsert to prevent race conditions
    // This ensures only one draft is created even with concurrent requests
    const savedTransaction = await Transaction.findOneAndUpdate(
      { draftId, createdBy: req.user.id },
      {
        $set: {
          ...transactionData,
          updatedAt: new Date()
        },
        $setOnInsert: {
          createdAt: new Date()
        }
      },
      { upsert: true, new: true, runValidators: true }
    );

    // Generate transaction number for new drafts (pre-save hook doesn't run with findOneAndUpdate)
    if (!savedTransaction.transactionNumber) {
      const date = new Date();
      const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
      const counterId = `txn-${dateStr}`;
      const seq = await getNextSequence(counterId);
      savedTransaction.transactionNumber = `TXN-${dateStr}-${String(seq).padStart(4, '0')}`;
      await savedTransaction.save();
    }

    res.status(200).json({
      success: true,
      draftId: savedTransaction.draftId,
      transactionId: savedTransaction._id,
      message: 'Draft saved successfully'
    });
  } catch (error) {
    console.error('Error saving draft:', error);
    res.status(500).json({
      error: 'Failed to save draft',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// GET /api/transactions/drafts - Get user's drafts
export const getDrafts = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const drafts = await Transaction.find({
      createdBy: req.user.id,
      status: 'draft'
    })
      .sort({ updatedAt: -1 })
      .lean();

    res.status(200).json(drafts);
  } catch (error) {
    console.error('Error fetching drafts:', error);
    res.status(500).json({
      error: 'Failed to fetch drafts',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// DELETE /api/transactions/drafts/:draftId - Delete a specific draft
export const deleteDraft = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { draftId } = req.params;

    if (!req.user?.id) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const result = await Transaction.deleteOne({
      draftId,
      createdBy: req.user.id,
      status: 'draft'
    });

    if (result.deletedCount === 0) {
      res.status(404).json({ error: 'Draft not found' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Draft deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting draft:', error);
    res.status(500).json({
      error: 'Failed to delete draft',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};