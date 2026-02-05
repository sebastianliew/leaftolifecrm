import mongoose, { Document, Schema } from 'mongoose';
import { getNextSequence } from './Counter.js';
import { normalizeTransactionForPayment } from '../utils/transactionUtils.js';

// Invoice status enum for proper state tracking
export type InvoiceStatus = 'none' | 'pending' | 'generating' | 'completed' | 'failed';

// Interface matching the frontend Transaction type
export interface ITransaction extends Document {
  transactionNumber: string;
  type: 'DRAFT' | 'COMPLETED';
  status: 'pending' | 'completed' | 'cancelled' | 'refunded' | 'partially_refunded' | 'draft';

  // Customer Information
  customerId?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
  };

  // Transaction Details
  items: Array<{
    productId: string;
    product?: Record<string, unknown>;
    name: string;
    description?: string;
    brand?: string;
    quantity: number;
    unitPrice: number;
    costPrice?: number; // Cost price captured at point of sale for accurate margin calculations
    totalPrice: number;
    discountAmount?: number;
    isService?: boolean;
    saleType: 'quantity' | 'volume';
    unitOfMeasurementId: string;
    baseUnit: string;
    convertedQuantity: number;
    sku?: string;
    itemType?: 'product' | 'fixed_blend' | 'custom_blend' | 'bundle' | 'miscellaneous' | 'consultation' | 'service';
    // Custom blend data for storing ingredients when itemType is 'custom_blend'
    customBlendData?: {
      name: string;
      ingredients: Array<{
        productId: string;
        name: string;
        quantity: number;
        unitOfMeasurementId: string;
        unitName: string;
        costPerUnit: number;
      }>;
      totalIngredientCost: number;
      preparationNotes?: string;
      mixedBy: string;
      mixedAt: Date;
      marginPercent?: number;
      containerType?: unknown; // Can be string ID, object with id, or full ContainerType object
    };
  }>;
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  currency: string;

  // Payment Information
  paymentMethod: 'cash' | 'card' | 'bank_transfer' | 'offset_from_credit' | 'paynow' | 'nets' | 'web_store' | 'misc';
  paymentStatus: 'pending' | 'paid' | 'partial' | 'overdue' | 'failed';
  paymentReference?: string;
  paidAmount: number;
  changeAmount: number;

  // Dates
  transactionDate: Date;
  dueDate?: Date;
  paidDate?: Date;

  // Additional Information
  notes?: string;
  internalNotes?: string;
  terms?: string;

  // Invoice Information
  invoiceGenerated: boolean; // Kept for backwards compatibility
  invoiceStatus: InvoiceStatus; // New status field for proper state tracking
  invoiceError?: string; // Error message if invoice generation failed
  invoicePath?: string;
  invoiceNumber?: string;
  invoiceFilename?: string; // Virtual: extracted from invoicePath for frontend convenience
  invoiceEmailSent?: boolean;
  invoiceEmailSentAt?: Date;
  invoiceEmailRecipient?: string;

  // System fields
  createdBy: string;
  lastModifiedBy?: string;
  createdAt: Date;
  updatedAt: Date;
  
  // Draft tracking
  draftId?: string;

  // Refund tracking fields
  refundStatus?: 'none' | 'partial' | 'full';
  totalRefunded?: number;
  refundHistory?: string[];
  refundCount?: number;
  lastRefundDate?: Date;
  refundableAmount?: number;
}

// Schema for custom blend ingredients
const CustomBlendIngredientSchema = new Schema({
  productId: { type: String, required: true },
  name: { type: String, required: true },
  quantity: { type: Number, required: true },
  unitOfMeasurementId: { type: String, required: true },
  unitName: { type: String, required: true },
  costPerUnit: { type: Number, default: 0 }
}, { _id: false });

// Schema for custom blend data
const CustomBlendDataSchema = new Schema({
  name: { type: String, required: true },
  ingredients: [CustomBlendIngredientSchema],
  totalIngredientCost: { type: Number, required: true },
  preparationNotes: { type: String },
  mixedBy: { type: String, required: true },
  mixedAt: { type: Date, required: true },
  marginPercent: { type: Number },
  containerType: { type: Schema.Types.Mixed } // Can be string ID, object with id, or full ContainerType object
}, { _id: false });

const TransactionItemSchema = new Schema({
  productId: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String },
  brand: { type: String },
  quantity: { type: Number, required: true },
  unitPrice: { type: Number, required: true },
  costPrice: { type: Number }, // Cost price captured at point of sale
  totalPrice: { type: Number, required: true },
  discountAmount: { type: Number, default: 0 },
  isService: { type: Boolean, default: false },
  saleType: { type: String, enum: ['quantity', 'volume'], required: true },
  unitOfMeasurementId: { type: String, required: true },
  baseUnit: { type: String, required: true },
  convertedQuantity: { type: Number, required: true },
  sku: { type: String },
  itemType: {
    type: String,
    enum: ['product', 'fixed_blend', 'custom_blend', 'bundle', 'miscellaneous', 'consultation', 'service'],
    default: 'product'
  },
  // Custom blend data for storing ingredients and blend details
  customBlendData: { type: CustomBlendDataSchema }
});

const AddressSchema = new Schema({
  street: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  postalCode: { type: String, required: true }
}, { _id: false });

const TransactionSchema = new Schema<ITransaction>({
  transactionNumber: { type: String, unique: true },
  type: {
    type: String,
    enum: ['DRAFT', 'COMPLETED'],
    required: true,
    default: 'DRAFT'
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'cancelled', 'refunded', 'partially_refunded', 'draft'],
    required: true,
    default: 'pending'
  },

  // Customer Information
  customerId: { type: String },
  customerName: { type: String, required: true },
  customerEmail: { type: String },
  customerPhone: { type: String },
  customerAddress: { type: AddressSchema },

  // Transaction Details
  items: [TransactionItemSchema],
  subtotal: { type: Number, required: true },
  discountAmount: { type: Number, default: 0 },
  totalAmount: { type: Number, required: true },
  currency: { type: String, default: 'SGD' },

  // Payment Information
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'bank_transfer', 'offset_from_credit', 'paynow', 'nets', 'web_store', 'misc'],
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'partial', 'overdue', 'failed'],
    required: true,
    default: 'pending'
  },
  paymentReference: { type: String },
  paidAmount: { type: Number, default: 0 },
  changeAmount: { type: Number, default: 0 },

  // Dates
  transactionDate: { type: Date, required: true, default: Date.now },
  dueDate: { type: Date },
  paidDate: { type: Date },

  // Additional Information
  notes: { type: String },
  internalNotes: { type: String },
  terms: { type: String },

  // Invoice Information
  invoiceGenerated: { type: Boolean, default: false }, // Kept for backwards compatibility
  invoiceStatus: {
    type: String,
    enum: ['none', 'pending', 'generating', 'completed', 'failed'],
    default: 'none'
  },
  invoiceError: { type: String },
  invoicePath: { type: String },
  invoiceNumber: { type: String },
  invoiceEmailSent: { type: Boolean, default: false },
  invoiceEmailSentAt: { type: Date },
  invoiceEmailRecipient: { type: String },

  // System fields
  createdBy: { type: String, required: true },
  lastModifiedBy: { type: String },
  
  // Draft tracking
  draftId: { type: String },

  // Refund tracking fields
  refundStatus: { type: String, enum: ['none', 'partial', 'full'], default: 'none' },
  totalRefunded: { type: Number, default: 0 },
  refundHistory: [{ type: String }],
  refundCount: { type: Number, default: 0 },
  lastRefundDate: { type: Date },
  refundableAmount: { type: Number }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual field: invoiceFilename
// Extracts the filename from invoicePath so frontend doesn't need to recompute it.
// This eliminates the need for duplicate formatInvoiceFilename logic in the frontend
// when downloading server-generated PDFs.
TransactionSchema.virtual('invoiceFilename').get(function() {
  if (!this.invoicePath) return undefined;
  // invoicePath format: 'invoices/TXN-001_John_Smith_22012026.pdf'
  // Extract just the filename portion
  const parts = this.invoicePath.split('/');
  return parts[parts.length - 1];
});

// Indexes for better performance
// Note: transactionNumber index is already created by unique: true option
TransactionSchema.index({ customerName: 1 });
TransactionSchema.index({ transactionDate: -1 });
TransactionSchema.index({ status: 1 });
TransactionSchema.index({ paymentStatus: 1 });
TransactionSchema.index({ createdBy: 1 });

// Unique compound index to prevent duplicate drafts for the same user
// partialFilterExpression ensures only documents with draftId (string type) are indexed
// This prevents duplicate drafts while allowing regular transactions without draftId
TransactionSchema.index(
  { draftId: 1, createdBy: 1 },
  {
    unique: true,
    partialFilterExpression: { draftId: { $type: 'string' } }
  }
);

// Compound indexes for common query patterns (significant performance improvement)
TransactionSchema.index({ status: 1, transactionDate: -1 }); // Status filtering with date sort
TransactionSchema.index({ type: 1, status: 1, createdAt: -1 }); // Report queries
TransactionSchema.index({ createdAt: -1, status: 1, type: 1 }); // Sales trends, item sales

// Text index for search functionality (replaces slow regex searches)
TransactionSchema.index(
  { customerName: 'text', customerEmail: 'text', transactionNumber: 'text' },
  { name: 'transaction_search_text' }
);

// Pre-save middleware to generate transaction number using atomic counter
// This eliminates the race condition that could cause duplicate transaction numbers
TransactionSchema.pre('save', async function(next) {
  if (this.isNew && (!this.transactionNumber || this.transactionNumber.trim() === '')) {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    // Use atomic counter to get unique sequence number
    const counterId = `txn-${dateStr}`;
    const seq = await getNextSequence(counterId);
    this.transactionNumber = `TXN-${dateStr}-${String(seq).padStart(4, '0')}`;
  }
  next();
});

/**
 * ============================================================================
 * TRANSACTION NORMALIZATION ARCHITECTURE
 * ============================================================================
 *
 * Business Rule: Paid transactions cannot be drafts.
 * When paymentStatus === 'paid', the transaction must be COMPLETED, not DRAFT.
 *
 * IMPLEMENTATION STRATEGY:
 * Normalization is enforced through TWO complementary mechanisms:
 *
 * 1. PRE-SAVE MIDDLEWARE (below)
 *    - Triggers on: new Transaction().save(), existingDoc.save()
 *    - Coverage: All direct Mongoose document operations
 *    - Advantage: Automatic, cannot be bypassed when using .save()
 *
 * 2. CONTROLLER LOGIC (transactions.controller.ts)
 *    - Triggers on: Transaction.findByIdAndUpdate() calls
 *    - Why needed: findByIdAndUpdate() DOES NOT trigger pre-save middleware
 *    - Advantage: Controller has full context (existing doc + updates)
 *
 * WHY NOT USE pre-findOneAndUpdate MIDDLEWARE?
 * - pre-findOneAndUpdate only receives the update object, not existing values
 * - Cannot determine: "Is this a draft being completed?" without existing doc
 * - Controllers already fetch existing doc for business logic decisions
 * - Explicit controller calls are clearer and more maintainable
 *
 * See: transactionUtils.ts for the shared normalization function
 * ============================================================================
 */
TransactionSchema.pre('save', function(next) {
  normalizeTransactionForPayment(this);
  next();
});

export const Transaction = mongoose.model<ITransaction>('Transaction', TransactionSchema);
