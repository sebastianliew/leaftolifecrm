import type { Product } from "./inventory"
import type { ContainerType } from "./container"

export interface Transaction {
  _id: string
  id?: string // Optional - for backward compatibility
  transactionNumber: string
  type: TransactionType
  status: TransactionStatus

  // Customer Information
  customerId?: string
  customerName: string
  customerEmail?: string
  customerPhone?: string
  customerAddress?: Address

  // Transaction Details
  items: TransactionItem[]
  subtotal: number
  discountAmount: number
  totalAmount: number
  currency: string

  // Payment Information
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
  paymentReference?: string
  paidAmount: number
  changeAmount: number

  // Dates
  transactionDate: string
  dueDate?: string
  paidDate?: string

  // Additional Information
  notes?: string
  internalNotes?: string
  terms?: string

  // Invoice Information
  invoiceGenerated: boolean
  invoiceStatus?: 'none' | 'pending' | 'generating' | 'completed' | 'failed'
  invoiceError?: string
  invoicePath?: string
  invoiceNumber?: string
  
  // Invoice Email Information
  invoiceEmailSent?: boolean
  invoiceEmailSentAt?: string
  invoiceEmailRecipient?: string

  // System fields
  createdAt: string
  updatedAt: string
  createdBy: string
  lastModifiedBy?: string

  // Refund tracking fields
  refundStatus?: 'none' | 'partial' | 'full'
  totalRefunded?: number
  refundHistory?: string[] // Array of refund IDs
  refundCount?: number
  lastRefundDate?: string
  refundableAmount?: number

  // Anomaly scanning tracking
  lastScannedForAnomalies?: string
  anomalyStatus?: {
    hasAnomalies: boolean
    count: number
    severity?: 'critical' | 'high' | 'medium' | 'low'
    types?: string[]
    lastChecked: string
  }
}

export interface TransactionItem {
  id?: string // Optional - only used in UI for React keys
  productId: string
  product?: Product // Optional - only used in UI for display
  name: string
  description?: string
  brand?: string // Brand name for display
  quantity: number
  unitPrice: number
  totalPrice: number
  discountAmount?: number
  isService?: boolean
  saleType: 'quantity' | 'volume'
  unitOfMeasurementId: string
  baseUnit: string
  convertedQuantity: number
  sku?: string // Product SKU for tracking

  // Source tracking for reuse functionality
  sourceType?: 'new' | 'prescription_reuse' | 'blend_reuse' | 'previous_transaction'
  sourceId?: string // Prescription ID, Blend Template ID, or Transaction ID
  sourceDate?: Date
  
  // Prescription linking
  prescriptionItemId?: string // Links to specific remedy in prescription
  prescriptionVersion?: number
  
  // Usage tracking and modifications
  usageNote?: string // "Repeat from prescription 2024-01-15" 
  isModified?: boolean // If dosage/instructions were changed from original
  modifications?: Array<{
    field: string
    originalValue: string
    newValue: string
    reason?: string
  }>

  // Enhanced container fields for individual tracking
  selectedContainers?: Array<{
    containerId: string
    containerCode: string
    quantityToConsume: number
    batchNumber?: string
    expiryDate?: Date
  }>

  // Legacy container fields (keeping for backward compatibility)
  containerStatus?: 'full' | 'partial' | 'empty'
  containerId?: string
  containerQuantity?: number
  containerVolume?: number
  containerType?: string | ContainerType | { id: string; _id?: string; name?: string }
  containerCapacity?: number

  // Blend and Bundle support
  itemType?: 'product' | 'fixed_blend' | 'custom_blend' | 'bundle' | 'miscellaneous' | 'consultation' | 'service'
  
  // For fixed blends
  blendTemplateId?: string
  
  // For bundles
  bundleId?: string
  bundleData?: {
    bundleId: string
    bundleName: string
    bundleProducts: Array<{
      productId?: string // Optional - only for 'product' type, not 'fixed_blend'
      name: string
      quantity: number
      productType: 'product' | 'fixed_blend'
      blendTemplateId?: string // Required for 'fixed_blend' type
      individualPrice: number
      selectedContainers?: Array<{
        containerId: string
        containerCode: string
        quantityToConsume: number
        batchNumber?: string
        expiryDate?: Date
      }>
    }>
    individualTotalPrice: number
    savings: number
    savingsPercentage: number
  }
  
  // For custom blends (on-the-fly mixing)
  customBlendData?: {
    name: string
    ingredients: Array<{
      productId: string
      name: string
      quantity: number
      unitOfMeasurementId: string
      unitName: string
      costPerUnit: number
      availableStock?: number
      notes?: string
      selectedContainers?: Array<{
        containerId: string
        containerCode: string
        quantityToConsume: number
        batchNumber?: string
        expiryDate?: Date
      }>
    }>
    totalIngredientCost: number
    preparationNotes?: string
    mixedBy: string
    mixedAt: Date
    marginPercent?: number
    containerType?: string | ContainerType | { id: string; _id?: string; name?: string } | null
  }

  // For miscellaneous items
  miscellaneousCategory?: 'supply' | 'service' | 'fee' | 'credit' | 'other'
  isTaxable?: boolean
}

export interface Address {
  street: string
  city: string
  state: string
  postalCode: string
}

export interface Customer {
  id: string
  name: string
  email?: string
  phone?: string
  address?: Address
  customerType: CustomerType
  creditLimit?: number
  paymentTerms?: string
  notes?: string
  totalPurchases: number
  lastPurchaseDate?: string
  createdAt: string
  updatedAt: string
}

export interface InvoiceTemplate {
  id: string
  name: string
  isDefault: boolean
  companyInfo: CompanyInfo
  template: string
  createdAt: string
}

export interface CompanyInfo {
  name: string
  address: Address
  phone?: string
  email?: string
  website?: string
  taxId?: string
  logo?: string
}

export type TransactionType = "DRAFT" | "COMPLETED"
export type TransactionStatus = "pending" | "completed" | "cancelled" | "refunded" | "partially_refunded" | "draft"
export type PaymentMethod = "cash" | "card" | "bank_transfer" | "offset_from_credit" | "paynow" | "nets" | "web_store" | "misc"
export type PaymentStatus = "pending" | "paid" | "partial" | "overdue" | "failed"
export type CustomerType = "individual" | "business" | "government" | "non_profit"

export interface TransactionFormData
  extends Omit<Transaction, "id" | "createdAt" | "updatedAt" | "_id"> {
  _id?: string;
}

export interface TransactionSummary {
  totalTransactions: number
  totalRevenue: number
  averageTransactionValue: number
  topSellingProducts: Array<{
    productId: string
    productName: string
    quantitySold: number
    revenue: number
  }>
  recentTransactions: Transaction[]
}

export interface InvoiceData {
  transaction: Transaction
  companyInfo: CompanyInfo
  template: InvoiceTemplate
}
