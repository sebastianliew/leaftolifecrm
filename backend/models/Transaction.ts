import mongoose, { Document, Schema } from 'mongoose';

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
    totalPrice: number;
    discountAmount?: number;
    isService?: boolean;
    saleType: 'quantity' | 'volume';
    unitOfMeasurementId: string;
    baseUnit: string;
    convertedQuantity: number;
    sku?: string;
    itemType?: 'product' | 'fixed_blend' | 'custom_blend' | 'bundle' | 'miscellaneous' | 'consultation' | 'service';
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
  invoiceGenerated: boolean;
  invoicePath?: string;
  invoiceNumber?: string;
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

const TransactionItemSchema = new Schema({
  productId: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String },
  brand: { type: String },
  quantity: { type: Number, required: true },
  unitPrice: { type: Number, required: true },
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
  }
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
  invoiceGenerated: { type: Boolean, default: false },
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

// Indexes for better performance
// Note: transactionNumber index is already created by unique: true option
TransactionSchema.index({ customerName: 1 });
TransactionSchema.index({ transactionDate: -1 });
TransactionSchema.index({ status: 1 });
TransactionSchema.index({ paymentStatus: 1 });
TransactionSchema.index({ createdBy: 1 });

// Pre-save middleware to generate transaction number
TransactionSchema.pre('save', async function(next) {
  if (this.isNew && (!this.transactionNumber || this.transactionNumber.trim() === '')) {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    // Count only transactions with TXN numbers (excluding any legacy DRAFT numbers)
    const count = await mongoose.model('Transaction').countDocuments({
      transactionDate: {
        $gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
        $lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
      },
      transactionNumber: { $regex: '^TXN-' }
    });
    this.transactionNumber = `TXN-${dateStr}-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

export const Transaction = mongoose.model<ITransaction>('Transaction', TransactionSchema);