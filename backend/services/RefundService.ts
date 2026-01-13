import mongoose from 'mongoose';
import { Refund, IRefund } from '../models/Refund.js';
import { Transaction } from '../models/Transaction.js';
import { Product } from '../models/Product.js';
import { createAuditLog } from '../models/AuditLog.js';

interface RefundFilters {
  status?: string;
  customerId?: string;
  refundReason?: string;
  startDate?: Date;
  endDate?: Date;
}

interface RefundEligibility {
  eligible: boolean;
  reason?: string;
  maxRefundableAmount: number;
  refundableItems: Array<{
    productId: string;
    productName: string;
    maxRefundableQuantity: number;
    unitPrice: number;
  }>;
}

interface CreateRefundData {
  items: Array<{
    productId: string;
    refundQuantity: number;
    reason?: string;
  }>;
  refundReason: string;
  refundMethod: string;
  notes?: string;
  createdBy: string;
}

export class RefundService {
  // Get all refunds with optional filters
  static async getRefunds(filters: RefundFilters = {}): Promise<IRefund[]> {
    try {
      interface RefundQuery {
        status?: string;
        customerId?: string;
        refundReason?: string;
        requestDate?: {
          $gte?: Date;
          $lte?: Date;
        };
      }
      
      const query: RefundQuery = {};
      
      if (filters.status) {
        query.status = filters.status;
      }
      
      if (filters.customerId) {
        query.customerId = filters.customerId;
      }
      
      if (filters.refundReason) {
        query.refundReason = filters.refundReason;
      }
      
      if (filters.startDate || filters.endDate) {
        query.requestDate = {};
        if (filters.startDate) query.requestDate.$gte = filters.startDate;
        if (filters.endDate) query.requestDate.$lte = filters.endDate;
      }
      
      return await Refund.find(query)
        .sort({ requestDate: -1 })
        .populate('transactionId', 'transactionNumber customerName totalAmount');
    } catch (error) {
      console.error('Error fetching refunds:', error);
      throw new Error('Failed to fetch refunds');
    }
  }

  // Get refund by ID
  static async getRefundById(refundId: string): Promise<IRefund | null> {
    try {
      return await Refund.findById(refundId)
        .populate('transactionId', 'transactionNumber customerName totalAmount items');
    } catch (error) {
      console.error('Error fetching refund by ID:', error);
      throw new Error('Failed to fetch refund');
    }
  }

  // Create new refund - uses MongoDB session for atomic operations
  static async createRefund(transactionId: string, refundData: CreateRefundData): Promise<IRefund> {
    const session = await mongoose.startSession();
    const startTime = Date.now();

    try {
      session.startTransaction();

      // Get the original transaction
      const transaction = await Transaction.findById(transactionId).session(session);
      if (!transaction) {
        throw new Error('Transaction not found');
      }

      // Check if transaction can be refunded
      if (transaction.status === 'cancelled' || transaction.status === 'refunded') {
        throw new Error('Transaction cannot be refunded');
      }

      // DUPLICATE PREVENTION: Check for recent refunds with the SAME ITEMS (within 5 seconds)
      // This prevents duplicate refunds from rapid clicks or retried requests
      // but allows legitimate sequential partial refunds with different items
      const requestedProductIds = refundData.items.map(item => item.productId).sort();

      const recentRefunds = await Refund.find({
        transactionId,
        createdAt: { $gte: new Date(Date.now() - 5000) }, // Within last 5 seconds
        status: { $in: ['pending', 'approved', 'completed'] } // Only check non-rejected refunds
      }).session(session);

      // Check if any recent refund has the same items
      const isDuplicateRefund = recentRefunds.some(existingRefund => {
        const existingProductIds = existingRefund.items
          .map((item: { productId: string }) => item.productId)
          .sort();
        // Check if the product IDs overlap (same items being refunded twice)
        return requestedProductIds.some(id => existingProductIds.includes(id));
      });

      if (isDuplicateRefund) {
        console.log(`[RefundService] DUPLICATE PREVENTED: Recent refund for same items found for transaction ${transactionId}`);
        throw new Error('A refund request for these items was recently submitted. Please wait and try again.');
      }

      // Calculate refund amounts and validate items
      let totalRefundAmount = 0;
      const refundItems = [];

      for (const item of refundData.items) {
        const originalItem = transaction.items.find(
          (txnItem) => txnItem.productId === item.productId
        );

        if (!originalItem) {
          throw new Error(`Product ${item.productId} not found in transaction`);
        }

        if (item.refundQuantity > originalItem.quantity) {
          throw new Error(`Refund quantity exceeds original quantity for ${originalItem.name}`);
        }

        const refundAmount = originalItem.unitPrice * item.refundQuantity;
        totalRefundAmount += refundAmount;

        refundItems.push({
          productId: item.productId,
          productName: originalItem.name,
          originalQuantity: originalItem.quantity,
          refundQuantity: item.refundQuantity,
          unitPrice: originalItem.unitPrice,
          refundAmount,
          reason: item.reason
        });
      }

      // Determine refund type
      const refundType = totalRefundAmount >= transaction.totalAmount ? 'full' : 'partial';

      // Create refund record
      const refund = new Refund({
        transactionId: transaction._id,
        transactionNumber: transaction.transactionNumber,
        customerId: transaction.customerId,
        customerName: transaction.customerName,
        customerEmail: transaction.customerEmail,
        customerPhone: transaction.customerPhone,
        items: refundItems,
        originalAmount: transaction.totalAmount,
        refundAmount: totalRefundAmount,
        refundMethod: refundData.refundMethod,
        refundReason: refundData.refundReason,
        refundType,
        notes: refundData.notes,
        createdBy: refundData.createdBy,
        status: 'pending'
      });

      await refund.save({ session });

      // Update transaction refund tracking
      transaction.refundHistory = transaction.refundHistory || [];
      transaction.refundHistory.push(refund._id.toString());
      transaction.refundCount = (transaction.refundCount || 0) + 1;
      transaction.totalRefunded = (transaction.totalRefunded || 0) + totalRefundAmount;
      transaction.lastRefundDate = new Date();

      // Update refund status
      if (refundType === 'full') {
        transaction.refundStatus = 'full';
        transaction.status = 'refunded';
      } else {
        transaction.refundStatus = 'partial';
        transaction.status = 'partially_refunded';
      }

      await transaction.save({ session });

      // Commit the transaction
      await session.commitTransaction();

      // Create audit log (fire-and-forget)
      createAuditLog({
        entityType: 'refund',
        entityId: refund._id,
        action: 'create',
        status: 'success',
        userId: refundData.createdBy,
        metadata: {
          transactionNumber: transaction.transactionNumber,
          refundAmount: totalRefundAmount,
          refundType
        },
        duration: Date.now() - startTime
      });

      return refund;
    } catch (error) {
      // Abort transaction on any error
      await session.abortTransaction();

      // Log the failure
      createAuditLog({
        entityType: 'refund',
        entityId: transactionId,
        action: 'create',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: refundData.createdBy,
        duration: Date.now() - startTime
      });

      console.error('Error creating refund:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  // Approve refund
  static async approveRefund(refundId: string, userId: string, approvalNotes?: string): Promise<IRefund> {
    try {
      const refund = await Refund.findById(refundId);
      if (!refund) {
        throw new Error('Refund not found');
      }

      if (refund.status !== 'pending') {
        throw new Error('Refund is not in pending status');
      }

      refund.status = 'approved';
      refund.approvedBy = userId;
      refund.approvedAt = new Date();
      refund.approvalNotes = approvalNotes;
      refund.lastModifiedBy = userId;

      await refund.save();
      return refund;
    } catch (error) {
      console.error('Error approving refund:', error);
      throw error;
    }
  }

  // Reject refund
  static async rejectRefund(refundId: string, userId: string, rejectionReason: string): Promise<IRefund> {
    try {
      const refund = await Refund.findById(refundId);
      if (!refund) {
        throw new Error('Refund not found');
      }

      if (refund.status !== 'pending') {
        throw new Error('Refund is not in pending status');
      }

      refund.status = 'rejected';
      refund.rejectedBy = userId;
      refund.rejectedAt = new Date();
      refund.rejectionReason = rejectionReason;
      refund.lastModifiedBy = userId;

      await refund.save();

      // Update transaction refund status
      const transaction = await Transaction.findById(refund.transactionId);
      if (transaction) {
        // Remove this refund from history and recalculate
        transaction.refundHistory = transaction.refundHistory?.filter(
          id => id !== refundId
        ) || [];
        transaction.refundCount = Math.max(0, (transaction.refundCount || 1) - 1);
        
        // If no other pending/approved refunds, reset refund status
        const otherRefunds = await Refund.find({
          transactionId: refund.transactionId,
          _id: { $ne: refundId },
          status: { $in: ['pending', 'approved', 'processing', 'completed'] }
        });
        
        if (otherRefunds.length === 0) {
          transaction.refundStatus = 'none';
          transaction.status = transaction.paymentStatus === 'paid' ? 'completed' : 'pending';
          transaction.totalRefunded = 0;
          transaction.lastRefundDate = undefined;
        }
        
        await transaction.save();
      }

      return refund;
    } catch (error) {
      console.error('Error rejecting refund:', error);
      throw error;
    }
  }

  // Process refund (handle inventory restoration)
  static async processRefund(refundId: string, userId: string): Promise<IRefund> {
    try {
      const refund = await Refund.findById(refundId);
      if (!refund) {
        throw new Error('Refund not found');
      }

      if (refund.status !== 'approved') {
        throw new Error('Refund must be approved before processing');
      }

      // Restore inventory for refunded items
      for (const item of refund.items) {
        const product = await Product.findById(item.productId);
        if (product) {
          product.quantity = (product.quantity || 0) + item.refundQuantity;
          await product.save();
        }
      }

      refund.status = 'processing';
      refund.processedBy = userId;
      refund.processedAt = new Date();
      refund.lastModifiedBy = userId;

      await refund.save();
      return refund;
    } catch (error) {
      console.error('Error processing refund:', error);
      throw error;
    }
  }

  // Complete refund (finalize payment)
  static async completeRefund(
    refundId: string, 
    userId: string, 
    paymentDetails?: {
      method: string;
      reference: string;
      amount: number;
      processedAt?: Date;
    }
  ): Promise<IRefund> {
    try {
      const refund = await Refund.findById(refundId);
      if (!refund) {
        throw new Error('Refund not found');
      }

      if (refund.status !== 'processing') {
        throw new Error('Refund must be in processing status');
      }

      refund.status = 'completed';
      refund.completedBy = userId;
      refund.completedAt = new Date();
      refund.lastModifiedBy = userId;

      if (paymentDetails) {
        refund.paymentDetails = {
          method: paymentDetails.method || refund.refundMethod,
          reference: paymentDetails.reference,
          amount: paymentDetails.amount || refund.refundAmount,
          processedAt: new Date()
        };
      }

      await refund.save();
      return refund;
    } catch (error) {
      console.error('Error completing refund:', error);
      throw error;
    }
  }

  // Cancel refund
  static async cancelRefund(refundId: string, userId: string, reason: string): Promise<IRefund> {
    try {
      const refund = await Refund.findById(refundId);
      if (!refund) {
        throw new Error('Refund not found');
      }

      if (refund.status === 'completed') {
        throw new Error('Cannot cancel completed refund');
      }

      refund.status = 'cancelled';
      refund.rejectionReason = reason;
      refund.lastModifiedBy = userId;

      await refund.save();
      return refund;
    } catch (error) {
      console.error('Error cancelling refund:', error);
      throw error;
    }
  }

  // Get refunds for a specific transaction
  static async getTransactionRefunds(transactionId: string): Promise<IRefund[]> {
    try {
      return await Refund.find({ transactionId })
        .sort({ requestDate: -1 });
    } catch (error) {
      console.error('Error fetching transaction refunds:', error);
      throw new Error('Failed to fetch transaction refunds');
    }
  }

  // Calculate refund eligibility for a transaction
  static async calculateRefundEligibility(transactionId: string): Promise<RefundEligibility> {
    try {
      const transaction = await Transaction.findById(transactionId);
      if (!transaction) {
        throw new Error('Transaction not found');
      }

      // Check basic eligibility
      if (transaction.status === 'cancelled') {
        return {
          eligible: false,
          reason: 'Transaction is cancelled',
          maxRefundableAmount: 0,
          refundableItems: []
        };
      }

      if (transaction.status === 'refunded') {
        return {
          eligible: false,
          reason: 'Transaction is already fully refunded',
          maxRefundableAmount: 0,
          refundableItems: []
        };
      }

      // Get existing refunds for this transaction
      const existingRefunds = await Refund.find({
        transactionId,
        status: { $in: ['pending', 'approved', 'processing', 'completed'] }
      });

      // Calculate already refunded quantities and amounts
      const refundedQuantities: { [productId: string]: number } = {};
      let totalRefunded = 0;

      existingRefunds.forEach(refund => {
        refund.items.forEach(item => {
          refundedQuantities[item.productId] = (refundedQuantities[item.productId] || 0) + item.refundQuantity;
        });
        totalRefunded += refund.refundAmount;
      });

      // Calculate refundable items
      const refundableItems = transaction.items
        .map(item => {
          const alreadyRefunded = refundedQuantities[item.productId] || 0;
          const maxRefundableQuantity = item.quantity - alreadyRefunded;

          return {
            productId: item.productId,
            productName: item.name,
            maxRefundableQuantity,
            unitPrice: item.unitPrice
          };
        })
        .filter(item => item.maxRefundableQuantity > 0);

      const maxRefundableAmount = transaction.totalAmount - totalRefunded;

      return {
        eligible: refundableItems.length > 0 && maxRefundableAmount > 0,
        maxRefundableAmount,
        refundableItems
      };
    } catch (error) {
      console.error('Error calculating refund eligibility:', error);
      throw new Error('Failed to calculate refund eligibility');
    }
  }
}