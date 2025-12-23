import { Request, Response } from 'express';
import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';
import { Transaction } from '../models/Transaction.js';
import { InvoiceGenerator } from '../services/invoiceGenerator.js';
import { emailService } from '../services/EmailService.js';
import { blobStorageService } from '../services/BlobStorageService.js';
import { PermissionService } from '../lib/permissions/PermissionService.js';
import type { FeaturePermissions } from '../lib/permissions/types.js';

const permissionService = PermissionService.getInstance();

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
      limit = '20' 
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
    }

    const filter: TransactionFilter = {};
    if (search) {
      filter.$or = [
        { transactionNumber: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
        { customerEmail: { $regex: search, $options: 'i' } }
      ];
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
export const createTransaction = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const transactionData = req.body;

    // Basic validation
    if (!transactionData.customerName || !transactionData.items || transactionData.items.length === 0) {
      res.status(400).json({ error: 'Customer name and items are required' });
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

    // Create transaction
    const transaction = new Transaction({
      ...transactionData,
      createdBy: req.user?.id || 'system'
    });

    const savedTransaction = await transaction.save();

    // Return response immediately - don't block on invoice generation
    res.status(201).json({
      ...savedTransaction.toObject(),
      _invoiceGenerated: false,
      _emailSent: false,
      _invoiceGenerating: true
    });

    // Auto-generate invoice and send email asynchronously (non-blocking)
    // This runs AFTER the response is sent to the client
    setImmediate(async () => {
      try {
        console.log('[Transaction] Auto-generating invoice for new transaction (async):', savedTransaction._id);

        // Generate invoice number
        const invoiceNumber = savedTransaction.transactionNumber;

        // Ensure invoices directory exists
        const invoicesDir = path.join(process.cwd(), 'invoices');
        if (!fs.existsSync(invoicesDir)) {
          fs.mkdirSync(invoicesDir, { recursive: true });
        }

        // Prepare invoice data
        const subtotal = savedTransaction.items.reduce((sum, item) => sum + ((item.unitPrice ?? 0) * (item.quantity ?? 0)), 0);
        const totalDiscounts = savedTransaction.items.reduce((sum, item) => sum + (item.discountAmount ?? 0), 0);

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
            itemType: item.itemType
          })),
          subtotal,
          discountAmount: totalDiscounts,
          additionalDiscount: savedTransaction.discountAmount ?? 0,
          totalAmount: savedTransaction.totalAmount,
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

        // Upload to Azure Blob Storage (or keep local if not configured)
        await blobStorageService.uploadFile(invoiceFilePath, invoiceFileName);

        // Update transaction with invoice info
        savedTransaction.invoiceGenerated = true;
        savedTransaction.invoiceNumber = invoiceNumber;
        savedTransaction.invoicePath = relativeInvoicePath;
        await savedTransaction.save();

        console.log('[Transaction] Invoice generated successfully (async)');

        // Auto-send email if customer email exists and email service is configured
        if (savedTransaction.customerEmail && emailService.isEnabled()) {
          try {
            console.log('[Transaction] Sending invoice email to:', savedTransaction.customerEmail);

            const emailSent = await emailService.sendInvoiceEmail(
              savedTransaction.customerEmail,
              savedTransaction.customerName,
              invoiceNumber,
              invoiceFilePath,
              savedTransaction.totalAmount,
              savedTransaction.transactionDate,
              savedTransaction.paymentStatus || 'pending'
            );

            if (emailSent) {
              savedTransaction.invoiceEmailSent = true;
              savedTransaction.invoiceEmailSentAt = new Date();
              savedTransaction.invoiceEmailRecipient = savedTransaction.customerEmail;
              await savedTransaction.save();
              console.log('[Transaction] Invoice email sent successfully (async)');
            }
          } catch (emailError) {
            console.error('[Transaction] Failed to send invoice email (async):', emailError);
          }
        }
      } catch (error) {
        console.error('[Transaction] Error during async invoice generation:', error);
      }
    });
  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(500).json({ error: 'Failed to create transaction' });
  }
};

// PUT /api/transactions/:id - Update transaction
export const updateTransaction = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid transaction ID' });
      return;
    }

    // Since we no longer use DRAFT numbers, we can directly update the transaction

    const updatedTransaction = await Transaction.findByIdAndUpdate(
      id,
      { ...updateData, lastModifiedBy: req.user?.id || 'system' },
      { new: true }
    );

    if (!updatedTransaction) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
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
      additionalDiscount: transaction.discountAmount ?? 0,
      totalAmount: transaction.totalAmount,
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

    // Update transaction with invoice info
    transaction.invoiceGenerated = true;
    transaction.invoiceNumber = invoiceNumber;
    transaction.invoicePath = relativeInvoicePath;
    transaction.lastModifiedBy = req.user?.id || 'system';
    await transaction.save();

    console.log('[Invoice] Invoice generated successfully:', invoiceNumber);

    // Automatically send invoice email if customer email exists and email service is configured
    let emailSent = false;
    let emailError = null;

    if (transaction.customerEmail && emailService.isEnabled()) {
      try {
        console.log('[Invoice] Automatically sending invoice email to:', transaction.customerEmail);

        emailSent = await emailService.sendInvoiceEmail(
          transaction.customerEmail,
          transaction.customerName,
          invoiceNumber,
          invoiceFilePath,
          transaction.totalAmount,
          transaction.transactionDate,
          transaction.paymentStatus || 'pending'
        );

        if (emailSent) {
          // Update transaction with email sent info
          transaction.invoiceEmailSent = true;
          transaction.invoiceEmailSentAt = new Date();
          transaction.invoiceEmailRecipient = transaction.customerEmail;
          await transaction.save();

          console.log('[Invoice] Email sent successfully to:', transaction.customerEmail);
        }
      } catch (error) {
        console.error('[Invoice] Failed to send email automatically:', error);
        emailError = error instanceof Error ? error.message : 'Unknown error';
        // Don't fail the invoice generation if email fails
      }
    } else if (transaction.customerEmail && !emailService.isEnabled()) {
      console.warn('[Invoice] Email service not configured. Skipping automatic email send.');
    } else {
      console.warn('[Invoice] No customer email provided. Skipping automatic email send.');
    }

    res.status(200).json({
      success: true,
      message: 'Invoice generated successfully',
      invoiceNumber,
      invoicePath: relativeInvoicePath,
      downloadUrl: `/api/invoices/${invoiceFileName}`,
      emailSent,
      emailError: emailError || undefined
    });
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
      additionalDiscount: transaction.discountAmount ?? 0,
      totalAmount: transaction.totalAmount,
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

    // Update transaction with invoice info
    transaction.invoiceGenerated = true;
    transaction.invoiceNumber = invoiceNumber;
    transaction.invoicePath = relativeInvoicePath;

    // Send email with invoice attachment
    console.log('[Email] Sending email to:', transaction.customerEmail);

    const emailSent = await emailService.sendInvoiceEmail(
      transaction.customerEmail,
      transaction.customerName,
      invoiceNumber,
      invoiceFilePath,
      transaction.totalAmount,
      transaction.transactionDate,
      transaction.paymentStatus || 'pending'
    );

    if (emailSent) {
      // Update transaction with email sent info
      transaction.invoiceEmailSent = true;
      transaction.invoiceEmailSentAt = new Date();
      transaction.invoiceEmailRecipient = transaction.customerEmail;
      transaction.lastModifiedBy = req.user?.id || 'system';
      await transaction.save();

      console.log('[Email] Invoice email sent successfully to:', transaction.customerEmail);

      res.status(200).json({
        success: true,
        message: 'Invoice email sent successfully',
        emailSent: true,
        recipient: transaction.customerEmail,
        sentAt: transaction.invoiceEmailSentAt
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

    // Check if draft already exists (for updates)
    let transaction = await Transaction.findOne({ draftId, createdBy: req.user.id });

    if (transaction) {
      // Update existing draft
      Object.assign(transaction, transactionData);
      transaction.updatedAt = new Date();
    } else {
      // Create new draft
      transaction = new Transaction(transactionData);
    }

    const savedTransaction = await transaction.save();

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