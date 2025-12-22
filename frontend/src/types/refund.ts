// Refund Types

export type RefundType = 'full' | 'partial' | 'item_based';

export type RefundReason = 
  | 'customer_request' 
  | 'product_issue' 
  | 'pricing_error' 
  | 'expired_product' 
  | 'damaged_goods' 
  | 'wrong_item' 
  | 'other';

export type RefundStatus = 
  | 'pending' 
  | 'approved' 
  | 'processing' 
  | 'completed' 
  | 'rejected' 
  | 'cancelled';

export type RefundMethod = 
  | 'original_payment' 
  | 'cash' 
  | 'store_credit' 
  | 'check' 
  | 'bank_transfer';

export type RestockStatus = 
  | 'pending' 
  | 'restocked' 
  | 'damaged' 
  | 'expired' 
  | 'not_applicable';

// Refund item interface
export interface RefundItem {
  originalItemId: string;
  productId: string;
  productName: string;
  quantityReturned: number;
  originalQuantity: number;
  amountRefunded: number;
  originalAmount: number;
  restockStatus: RestockStatus;
  restockNotes?: string;
  itemType?: 'product' | 'fixed_blend' | 'custom_blend' | 'bundle';
  saleType?: 'quantity' | 'volume';
  unitOfMeasurementId?: string;
  baseUnit?: string;
  containerInfo?: {
    containerId?: string;
    containerCode?: string;
    quantityReturned?: number;
  };
}

// Main refund interface
export interface Refund {
  _id: string;
  refundNumber: string;
  originalTransactionId: string;
  originalTransactionNumber: string;
  refundType: RefundType;
  refundReason: RefundReason;
  refundReasonDetails?: string;
  originalAmount: number;
  refundAmount: number;
  refundMethod: RefundMethod;
  paymentReference?: string;
  refundItems: RefundItem[];
  status: RefundStatus;
  approvedBy?: string;
  approvalDate?: Date;
  rejectionReason?: string;
  customerId: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  processedBy?: string;
  processedAt?: Date;
  completedAt?: Date;
  storeCreditIssued?: boolean;
  storeCreditAmount?: number;
  storeCreditReference?: string;
  inventoryRestocked?: boolean;
  inventoryRestockDate?: Date;
  inventoryNotes?: string;
  notes?: string;
  internalNotes?: string;
  attachments?: string[];
  createdBy: string;
  lastModifiedBy?: string;
  createdAt: Date;
  updatedAt: Date;
  
  // Virtual fields
  totalItemsReturned?: number;
  refundPercentage?: number;
  processingDuration?: number;
}

// API request types
export interface CreateRefundRequest {
  transactionId: string;
  refundType: RefundType;
  refundReason: RefundReason;
  refundReasonDetails?: string;
  refundMethod?: RefundMethod;
  refundItems: Array<{
    originalItemId: string;
    quantityReturned: number;
    amountRefunded: number;
    restockStatus?: RestockStatus;
    restockNotes?: string;
  }>;
  notes?: string;
}

export interface UpdateRefundRequest {
  status?: RefundStatus;
  refundMethod?: RefundMethod;
  notes?: string;
  internalNotes?: string;
  restockStatus?: RestockStatus;
  inventoryNotes?: string;
}

export interface ApproveRefundRequest {
  approvalNotes?: string;
}

export interface RejectRefundRequest {
  rejectionReason: string;
}

export interface CompleteRefundRequest {
  paymentReference?: string;
  storeCreditIssued?: boolean;
  storeCreditAmount?: number;
  storeCreditReference?: string;
}

export interface CancelRefundRequest {
  reason: string;
}

// Response types
export interface RefundEligibilityResponse {
  canRefund: boolean;
  reason?: string;
  refundableAmount: number;
  refundableItems: Array<{
    itemId: string;
    productName: string;
    originalQuantity: number;
    refundableQuantity: number;
    originalAmount: number;
    refundableAmount: number;
  }>;
}

export interface RefundListResponse {
  refunds: Refund[];
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface RefundStatisticsResponse {
  totalRefunds: number;
  totalAmount: number;
  averageAmount: number;
  statusBreakdown: Record<RefundStatus, { count: number; amount: number }>;
  reasonBreakdown: Record<RefundReason, { count: number; amount: number }>;
}

// Filter types
export interface RefundFilters {
  status?: RefundStatus;
  customerId?: string;
  startDate?: string;
  endDate?: string;
  refundReason?: RefundReason;
  minAmount?: number;
  maxAmount?: number;
  transactionId?: string;
  searchTerm?: string;
}