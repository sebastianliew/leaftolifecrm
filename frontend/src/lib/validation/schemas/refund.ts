import { z } from 'zod';

// Enum schemas
export const refundTypeSchema = z.enum(['full', 'partial']);

export const refundReasonSchema = z.enum([
  'customer_request',
  'product_issue',
  'pricing_error',
  'expired_product',
  'damaged_goods',
  'wrong_item',
  'other'
]);

export const refundStatusSchema = z.enum([
  'pending',
  'approved',
  'processing',
  'completed',
  'rejected',
  'cancelled'
]);

export const refundMethodSchema = z.enum([
  'original_payment',
  'cash',
  'store_credit',
  'check',
  'bank_transfer'
]);

export const restockStatusSchema = z.enum([
  'pending',
  'restocked',
  'damaged',
  'expired',
  'not_applicable'
]);

// Refund item schema
export const refundItemSchema = z.object({
  originalItemId: z.string().min(1, 'Original item ID is required'),
  quantityReturned: z.number().positive('Quantity must be positive'),
  amountRefunded: z.number().min(0, 'Amount cannot be negative'),
  restockStatus: restockStatusSchema.optional().default('pending'),
  restockNotes: z.string().optional()
});

// Create refund request schema
export const createRefundSchema = z.object({
  body: z.object({
    transactionId: z.string().min(1, 'Transaction ID is required'),
    refundType: refundTypeSchema,
    refundReason: refundReasonSchema,
    refundReasonDetails: z.string().optional(),
    refundMethod: refundMethodSchema.optional().default('original_payment'),
    refundItems: z.array(refundItemSchema).min(1, 'At least one item must be refunded'),
    notes: z.string().optional()
  })
});

// Update refund request schema
export const updateRefundSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Refund ID is required')
  }),
  body: z.object({
    status: refundStatusSchema.optional(),
    refundMethod: refundMethodSchema.optional(),
    notes: z.string().optional(),
    internalNotes: z.string().optional(),
    restockStatus: restockStatusSchema.optional(),
    inventoryNotes: z.string().optional()
  })
});

// Approve refund request schema
export const approveRefundSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Refund ID is required')
  }),
  body: z.object({
    approvalNotes: z.string().optional()
  })
});

// Reject refund request schema
export const rejectRefundSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Refund ID is required')
  }),
  body: z.object({
    rejectionReason: z.string().min(1, 'Rejection reason is required')
  })
});

// Complete refund request schema
export const completeRefundSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Refund ID is required')
  }),
  body: z.object({
    paymentReference: z.string().optional(),
    storeCreditIssued: z.boolean().optional(),
    storeCreditAmount: z.number().positive().optional(),
    storeCreditReference: z.string().optional()
  }).refine(
    (data) => {
      // If store credit is issued, amount must be provided
      if (data.storeCreditIssued && !data.storeCreditAmount) {
        return false;
      }
      return true;
    },
    {
      message: 'Store credit amount is required when store credit is issued',
      path: ['storeCreditAmount']
    }
  )
});

// Cancel refund request schema
export const cancelRefundSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Refund ID is required')
  }),
  body: z.object({
    reason: z.string().min(1, 'Cancellation reason is required')
  })
});

// Get refunds query schema
export const getRefundsSchema = z.object({
  query: z.object({
    status: refundStatusSchema.optional(),
    customerId: z.string().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    refundReason: refundReasonSchema.optional(),
    minAmount: z.coerce.number().positive().optional(),
    maxAmount: z.coerce.number().positive().optional(),
    transactionId: z.string().optional(),
    page: z.coerce.number().positive().optional().default(1),
    limit: z.coerce.number().positive().max(100).optional().default(20),
    sort: z.enum(['createdAt', '-createdAt', 'refundAmount', '-refundAmount']).optional().default('-createdAt')
  })
});

// Get single refund schema
export const getRefundSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'Refund ID is required')
  })
});

// Get transaction refunds schema
export const getTransactionRefundsSchema = z.object({
  params: z.object({
    transactionId: z.string().min(1, 'Transaction ID is required')
  })
});

// Check refund eligibility schema
export const checkRefundEligibilitySchema = z.object({
  params: z.object({
    transactionId: z.string().min(1, 'Transaction ID is required')
  })
});

// Quick refund schema (for creating refund from transaction page)
export const quickRefundSchema = z.object({
  params: z.object({
    transactionId: z.string().min(1, 'Transaction ID is required')
  }),
  body: z.object({
    refundType: refundTypeSchema,
    refundReason: refundReasonSchema,
    refundReasonDetails: z.string().optional(),
    refundMethod: refundMethodSchema.optional().default('original_payment'),
    refundAllItems: z.boolean().optional().default(false),
    refundItems: z.array(refundItemSchema).optional(),
    notes: z.string().optional()
  }).refine(
    (data) => {
      // Either refundAllItems must be true OR refundItems must be provided
      if (!data.refundAllItems && (!data.refundItems || data.refundItems.length === 0)) {
        return false;
      }
      return true;
    },
    {
      message: 'Either refundAllItems must be true or specific refund items must be provided',
      path: ['refundItems']
    }
  )
});

// Export type inference helpers
export type CreateRefundInput = z.infer<typeof createRefundSchema>['body'];
export type UpdateRefundInput = z.infer<typeof updateRefundSchema>['body'];
export type ApproveRefundInput = z.infer<typeof approveRefundSchema>['body'];
export type RejectRefundInput = z.infer<typeof rejectRefundSchema>['body'];
export type CompleteRefundInput = z.infer<typeof completeRefundSchema>['body'];
export type CancelRefundInput = z.infer<typeof cancelRefundSchema>['body'];
export type GetRefundsQuery = z.infer<typeof getRefundsSchema>['query'];
export type QuickRefundInput = z.infer<typeof quickRefundSchema>['body'];