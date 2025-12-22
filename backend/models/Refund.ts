import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IRefund extends Document {
  _id: string;
  refundNumber: string;
  transactionId: string;
  transactionNumber: string;
  
  // Customer Information
  customerId?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  
  // Refund Details
  items: Array<{
    productId: string;
    productName: string;
    originalQuantity: number;
    refundQuantity: number;
    unitPrice: number;
    refundAmount: number;
    reason?: string;
  }>;
  
  // Financial Information
  originalAmount: number;
  refundAmount: number;
  refundMethod: 'cash' | 'card' | 'bank_transfer' | 'store_credit' | 'offset_to_credit';
  
  // Status and Workflow
  status: 'pending' | 'approved' | 'rejected' | 'processing' | 'completed' | 'cancelled';
  refundReason: 'defective_product' | 'wrong_item' | 'customer_request' | 'billing_error' | 'duplicate_charge' | 'other';
  refundType: 'full' | 'partial';
  
  // Approval Information
  approvedBy?: string;
  approvedAt?: Date;
  approvalNotes?: string;
  rejectedBy?: string;
  rejectedAt?: Date;
  rejectionReason?: string;
  
  // Processing Information
  processedBy?: string;
  processedAt?: Date;
  processingNotes?: string;
  
  // Completion Information
  completedBy?: string;
  completedAt?: Date;
  paymentDetails?: {
    method: string;
    reference: string;
    amount: number;
    processedAt: Date;
  };
  
  // Additional Information
  notes?: string;
  internalNotes?: string;
  attachments?: string[];
  
  // System fields
  createdBy: string;
  lastModifiedBy?: string;
  
  // Dates
  requestDate: Date;
  expectedCompletionDate?: Date;
}

// Static methods interface
export interface IRefundModel extends Model<IRefund> {
  getRefundStatistics(startDate?: Date, endDate?: Date): Promise<{
    totalRefunds: number;
    totalAmount: number;
    averageRefundAmount: number;
    refundsByStatus: Record<string, number>;
    refundsByReason: Record<string, number>;
    refundsByMethod: Record<string, number>;
    trends: Array<{ date: string; count: number; amount: number }>;
  }>;
}

const RefundItemSchema = new Schema({
  productId: { type: String, required: true },
  productName: { type: String, required: true },
  originalQuantity: { type: Number, required: true },
  refundQuantity: { type: Number, required: true },
  unitPrice: { type: Number, required: true },
  refundAmount: { type: Number, required: true },
  reason: { type: String }
}, { _id: false });

const PaymentDetailsSchema = new Schema({
  method: { type: String, required: true },
  reference: { type: String, required: true },
  amount: { type: Number, required: true },
  processedAt: { type: Date, required: true }
}, { _id: false });

const RefundSchema = new Schema<IRefund>({
  refundNumber: { type: String, required: true, unique: true },
  transactionId: { type: String, required: true },
  transactionNumber: { type: String, required: true },
  
  // Customer Information
  customerId: { type: String },
  customerName: { type: String, required: true },
  customerEmail: { type: String },
  customerPhone: { type: String },
  
  // Refund Details
  items: [RefundItemSchema],
  
  // Financial Information
  originalAmount: { type: Number, required: true },
  refundAmount: { type: Number, required: true },
  refundMethod: {
    type: String,
    enum: ['cash', 'card', 'bank_transfer', 'store_credit', 'offset_to_credit'],
    required: true
  },
  
  // Status and Workflow
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'processing', 'completed', 'cancelled'],
    required: true,
    default: 'pending'
  },
  refundReason: {
    type: String,
    enum: ['defective_product', 'wrong_item', 'customer_request', 'billing_error', 'duplicate_charge', 'other'],
    required: true
  },
  refundType: {
    type: String,
    enum: ['full', 'partial'],
    required: true
  },
  
  // Approval Information
  approvedBy: { type: String },
  approvedAt: { type: Date },
  approvalNotes: { type: String },
  rejectedBy: { type: String },
  rejectedAt: { type: Date },
  rejectionReason: { type: String },
  
  // Processing Information
  processedBy: { type: String },
  processedAt: { type: Date },
  processingNotes: { type: String },
  
  // Completion Information
  completedBy: { type: String },
  completedAt: { type: Date },
  paymentDetails: { type: PaymentDetailsSchema },
  
  // Additional Information
  notes: { type: String },
  internalNotes: { type: String },
  attachments: [{ type: String }],
  
  // System fields
  createdBy: { type: String, required: true },
  lastModifiedBy: { type: String },
  
  // Dates
  requestDate: { type: Date, required: true, default: Date.now },
  expectedCompletionDate: { type: Date }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
// Note: refundNumber index is already created by unique: true option
RefundSchema.index({ transactionId: 1 });
RefundSchema.index({ status: 1 });
RefundSchema.index({ requestDate: -1 });
RefundSchema.index({ customerName: 1 });
RefundSchema.index({ createdBy: 1 });

// Pre-save middleware to generate refund number
RefundSchema.pre('save', async function(next) {
  if (this.isNew && !this.refundNumber) {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const count = await mongoose.model('Refund').countDocuments({
      requestDate: {
        $gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
        $lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
      }
    });
    this.refundNumber = `REF-${dateStr}-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

// Static method for refund statistics
RefundSchema.statics.getRefundStatistics = async function(startDate?: Date, endDate?: Date) {
  const matchStage: Record<string, unknown> = {};
  
  if (startDate || endDate) {
    matchStage.requestDate = {} as Record<string, Date>;
    if (startDate) (matchStage.requestDate as Record<string, Date>).$gte = startDate;
    if (endDate) (matchStage.requestDate as Record<string, Date>).$lte = endDate;
  }
  
  const stats = await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalRefunds: { $sum: 1 },
        totalAmount: { $sum: '$refundAmount' },
        pendingRefunds: {
          $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
        },
        approvedRefunds: {
          $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] }
        },
        completedRefunds: {
          $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
        },
        rejectedRefunds: {
          $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] }
        },
        averageRefundAmount: { $avg: '$refundAmount' }
      }
    }
  ]);
  
  return stats[0] || {
    totalRefunds: 0,
    totalAmount: 0,
    pendingRefunds: 0,
    approvedRefunds: 0,
    completedRefunds: 0,
    rejectedRefunds: 0,
    averageRefundAmount: 0
  };
};

export const Refund = mongoose.model<IRefund, IRefundModel>('Refund', RefundSchema);