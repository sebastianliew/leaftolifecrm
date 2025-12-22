import { z } from 'zod'

// Import directly to avoid circular dependency
const patterns = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^[\d\s\-+()]+$/,
  mongoId: /^[0-9a-fA-F]{24}$/
}

const commonSchemas = {
  email: z.string().email('Invalid email format').trim(),
  phone: z.string().regex(patterns.phone, 'Invalid phone number format').trim(),
  mongoId: z.string().regex(patterns.mongoId, 'Invalid MongoDB ID format'),
  nonNegativeNumber: z.number().nonnegative('Must be zero or positive').finite('Must be a finite number'),
  positiveNumber: z.number().positive('Must be a positive number').finite('Must be a finite number'),
  currency: z.number().nonnegative('Amount cannot be negative').multipleOf(0.01, 'Amount must have at most 2 decimal places').finite('Must be a valid amount'),
}

const addressSchema = z.object({
  street: z.string().min(1, 'Street address is required').trim(),
  city: z.string().min(1, 'City is required').trim(),
  state: z.string().min(2, 'State is required').max(2, 'Use 2-letter state code'),
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code format'),
  country: z.string().default('US')
})

const timestampSchema = z.object({
  createdAt: z.date().or(z.string().datetime()),
  updatedAt: z.date().or(z.string().datetime())
})

const baseEntitySchema = z.object({
  _id: commonSchemas.mongoId.optional(),
  ...timestampSchema.shape
})

// Transaction item schema
export const transactionItemSchema = z.object({
  id: z.string(),
  productId: commonSchemas.mongoId.or(z.literal('')),
  name: z.string().min(1, 'Item name is required'),
  sku: z.string(),
  unitType: z.enum(['unit', 'volume']).optional(),
  quantity: commonSchemas.positiveNumber.int().default(1),
  volume: commonSchemas.positiveNumber.optional(),
  price: commonSchemas.currency,
  subtotal: commonSchemas.currency,
  itemType: z.string().optional(),
  
  // For blends
  blendType: z.enum(['fixed', 'custom']).optional(),
  fixedBlendId: commonSchemas.mongoId.optional(),
  customBlend: z.object({
    name: z.string(),
    components: z.array(z.object({
      productId: commonSchemas.mongoId,
      name: z.string(),
      weight: commonSchemas.positiveNumber,
      pricePerGram: commonSchemas.currency
    })),
    totalWeight: commonSchemas.positiveNumber,
    totalPrice: commonSchemas.currency,
    pricePerGram: commonSchemas.currency
  }).optional(),
  
  // Custom blend data (new format)
  customBlendData: z.object({
    name: z.string(),
    ingredients: z.array(z.object({
      productId: z.string(),
      name: z.string(),
      quantity: z.number(),
      unitOfMeasurementId: z.string(),
      unitName: z.string(),
      costPerUnit: z.number(),
      currentStock: z.number().optional(),
      notes: z.string().optional(),
      selectedContainers: z.array(z.object({
        containerId: z.string(),
        containerCode: z.string(),
        quantityToConsume: z.number(),
        batchNumber: z.string().optional(),
        expiryDate: z.string().or(z.date()).optional()
      })).optional()
    })),
    totalIngredientCost: z.number(),
    preparationNotes: z.string().optional(),
    mixedBy: z.string(),
    mixedAt: z.string().or(z.date()),
    marginPercent: z.number().optional(),
    containerType: z.object({
      id: z.string(),
      name: z.string(),
      capacity: z.number().optional()
    }).optional()
  }).optional(),
  
  // For bundles
  bundleId: commonSchemas.mongoId.optional(),
  bundleName: z.string().optional(),
  bundleItems: z.array(z.object({
    productId: commonSchemas.mongoId,
    quantity: commonSchemas.positiveNumber.int()
  })).optional(),
  bundleData: z.object({
    originalPrice: z.number().optional(),
    discountAmount: z.number().optional(),
    metadata: z.record(z.unknown()).optional()
  }).optional(),
  
  // Required fields for transaction validation
  unitOfMeasurementId: z.string().min(1, "Unit of measurement is required"),
  baseUnit: z.string().default('unit'),
  saleType: z.enum(['quantity', 'volume']).default('quantity'),
  totalPrice: commonSchemas.currency,
  discountAmount: commonSchemas.nonNegativeNumber.default(0),
  isService: z.boolean().default(false),
  convertedQuantity: z.number().nonnegative().default(0)
})

// Base transaction schema without refinement
export const baseTransactionSchema = baseEntitySchema.extend({
  transactionNumber: z.string()
    .regex(/^(TXN-\d{14}|DRAFT-.+)$/, 'Invalid transaction number format')
    .optional(),
    
  type: z.enum(['DRAFT', 'COMPLETED']),
  status: z.enum(['pending', 'completed', 'cancelled', 'refunded', 'draft']),
  
  // Draft-specific fields
  isDraft: z.boolean().optional().default(false),
  draftId: z.string().optional(),
  draftName: z.string().trim().optional(),
  autoSaveTimestamp: z.string().datetime().transform(str => new Date(str)).or(z.date()).optional(),
  draftExpiresAt: z.string().datetime().or(z.date()).optional(),
  
  // Customer information
  customerId: commonSchemas.mongoId.optional(),
  customerName: z.string().min(1, 'Customer name is required').trim(),
  customerEmail: commonSchemas.email.optional(),
  customerPhone: commonSchemas.phone,
  customerAddress: addressSchema.optional(),
  medicalCard: z.string().trim().optional(),
  
  // Items
  items: z.array(transactionItemSchema)
    .min(1, 'At least one item is required'),
    
  // Financial details
  subtotal: commonSchemas.currency,
  discountAmount: commonSchemas.nonNegativeNumber.default(0),
  taxAmount: commonSchemas.nonNegativeNumber.default(0),
  totalAmount: commonSchemas.currency,
  currency: z.string().length(3).default('SGD'),
  
  // Payment details
  paymentMethod: z.enum(['cash', 'card', 'bank_transfer', 'offset_from_credit', 'paynow', 'nets', 'web_store', 'misc']),
  paymentStatus: z.enum(['pending', 'paid', 'partial', 'failed', 'refunded']),
  paidAmount: commonSchemas.nonNegativeNumber.default(0),
  changeAmount: commonSchemas.nonNegativeNumber.default(0),
  
  // Additional details
  transactionDate: z.string().datetime().or(z.date()),
  notes: z.string().max(500).trim().optional(),
  invoiceGenerated: z.boolean().default(false),
  invoiceNumber: z.string().optional(),
  
  // Tracking
  createdBy: z.string().min(1, 'Created by is required'),
  processedBy: z.string().optional(),
  cancelledBy: z.string().optional(),
  cancelReason: z.string().optional()
})

// Transaction schema with validation refinement
export const transactionSchema = baseTransactionSchema.refine(
  (data) => {
    // Validate payment amounts
    if (data.paymentStatus === 'paid' && data.paidAmount < data.totalAmount) {
      return false
    }
    return true
  },
  {
    message: 'Paid amount must be at least the total amount when payment status is paid',
    path: ['paidAmount']
  }
)

// Transaction create schema - uses base schema for omit support, then applies refinement
const baseCreateTransactionSchema = baseTransactionSchema.omit({ 
  _id: true, 
  createdAt: true, 
  updatedAt: true,
  processedBy: true,
  cancelledBy: true,
  cancelReason: true
})

export const createTransactionSchema = baseCreateTransactionSchema.refine(
  (data) => {
    // Validate payment amounts
    if (data.paymentStatus === 'paid' && data.paidAmount < data.totalAmount) {
      return false
    }
    return true
  },
  {
    message: 'Paid amount must be at least the total amount when payment status is paid',
    path: ['paidAmount']
  }
)

// Transaction update schema (limited fields)
export const updateTransactionSchema = z.object({
  status: z.enum(['pending', 'completed', 'cancelled', 'refunded', 'draft']).optional(),
  paymentStatus: z.enum(['pending', 'paid', 'partial', 'failed', 'refunded']).optional(),
  paidAmount: commonSchemas.nonNegativeNumber.optional(),
  notes: z.string().max(500).trim().optional(),
  invoiceGenerated: z.boolean().optional(),
  invoiceNumber: z.string().optional(),
  
  // Draft update fields
  isDraft: z.boolean().optional(),
  draftName: z.string().trim().optional(),
  autoSaveTimestamp: z.string().datetime().transform(str => new Date(str)).or(z.date()).optional()
})

// Transaction search schema
export const transactionSearchSchema = z.object({
  transactionNumber: z.string().optional(),
  customerName: z.string().trim().optional(),
  customerPhone: z.string().trim().optional(),
  status: z.enum(['pending', 'completed', 'cancelled', 'refunded', 'draft']).optional(),
  paymentStatus: z.enum(['pending', 'paid', 'partial', 'failed', 'refunded']).optional(),
  paymentMethod: z.enum(['cash', 'card', 'bank_transfer', 'offset_from_credit', 'paynow', 'nets', 'web_store', 'misc']).optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  minAmount: commonSchemas.nonNegativeNumber.optional(),
  maxAmount: commonSchemas.positiveNumber.optional(),
  isDraft: z.boolean().optional()
})

// Draft-specific item schema (more lenient)
export const draftItemSchema = z.object({
  id: z.string().optional(),
  productId: z.string().optional(), // Allow any string, not just MongoDB ID
  product: z.object({
    _id: z.string().optional(),
    name: z.string().optional(),
    sku: z.string().optional(),
    sellingPrice: z.number().optional(),
  }).optional(),
  name: z.string().min(1, 'Item name is required'),
  description: z.string().optional(),
  brand: z.string().optional(),
  quantity: z.number().positive().default(1),
  unitPrice: z.number().default(0),
  totalPrice: z.number().default(0),
  discountAmount: z.number().nonnegative().default(0),
  isService: z.boolean().default(false),
  saleType: z.enum(['quantity', 'volume', 'count'])
    .transform(val => val === 'count' ? 'quantity' : val)
    .default('quantity'),
  unitOfMeasurementId: z.string().min(1, "Unit of measurement is required"),
  baseUnit: z.string().default('unit'),
  convertedQuantity: z.number().nonnegative().default(0),
  sku: z.string().optional(), // Optional for drafts
  itemType: z.string().optional(), // For blend/bundle/product type
  
  // Custom blend data
  customBlendData: z.object({
    name: z.string().optional(),
    ingredients: z.array(z.object({
      productId: z.string(),
      name: z.string(),
      quantity: z.number(),
      unitOfMeasurementId: z.string(),
      unitName: z.string(),
      costPerUnit: z.number(),
      currentStock: z.number().optional(),
      notes: z.string().optional(),
      selectedContainers: z.array(z.object({
        containerId: z.string(),
        containerCode: z.string(),
        quantityToConsume: z.number(),
        batchNumber: z.string().optional(),
        expiryDate: z.string().or(z.date()).optional()
      })).optional()
    })).optional(),
    totalIngredientCost: z.number().optional(),
    preparationNotes: z.string().optional(),
    mixedBy: z.string().optional(),
    mixedAt: z.string().or(z.date()).optional(),
    marginPercent: z.number().optional(),
    containerType: z.object({
      id: z.string(),
      name: z.string(),
      capacity: z.number().optional()
    }).optional()
  }).optional(),
  
  // Miscellaneous item fields
  miscellaneousCategory: z.string().optional(),
  isTaxable: z.boolean().optional(),

  // Bundle data
  bundleData: z.object({
    originalPrice: z.number().optional(),
    discountAmount: z.number().optional(),
    metadata: z.record(z.unknown()).optional()
  }).optional() // For bundle items
})

// Draft-specific schemas
export const createDraftSchema = z.object({
  isDraft: z.literal(true),
  status: z.literal('draft'),
  type: z.enum(['DRAFT', 'COMPLETED']).default('DRAFT'),
  draftId: z.string().optional(),
  draftName: z.string().trim().optional(),
  customerName: z.string().trim().optional(),
  customerId: z.string().optional(), // CRITICAL FIX: Save patient/customer ID to restore discount when editing draft
  customerEmail: z.string().optional().or(z.literal('')),
  customerPhone: z.string().optional().or(z.literal('')),
  transactionDate: z.string().datetime().or(z.date()).optional(),
  items: z.array(draftItemSchema).default([]),
  subtotal: z.number().nonnegative().default(0),
  discountAmount: z.number().nonnegative().default(0),
  totalAmount: z.number().nonnegative().default(0),
  currency: z.string().default('SGD'),
  paymentMethod: z.enum(['cash', 'card', 'bank_transfer', 'offset_from_credit', 'paynow', 'nets', 'web_store', 'misc', '']).optional(), // Allow empty string
  paymentStatus: z.string().optional().default('pending'),
  paidAmount: z.number().nonnegative().default(0),
  changeAmount: z.number().nonnegative().default(0),
  invoiceGenerated: z.boolean().default(false),
  createdBy: z.string().min(1, 'Created by is required'),
  transactionNumber: z.string().optional()
})

export const updateDraftSchema = z.object({
  draftName: z.string().trim().optional(),
  customerName: z.string().trim().optional(),
  customerId: z.string().optional(), // CRITICAL FIX: Save patient/customer ID to restore discount when editing draft
  customerEmail: z.string().optional().or(z.literal('')),
  customerPhone: z.string().optional().or(z.literal('')),
  items: z.array(draftItemSchema).optional(),
  subtotal: z.number().nonnegative().optional(),
  discountAmount: z.number().nonnegative().optional(),
  totalAmount: z.number().nonnegative().optional(),
  paymentMethod: z.string().optional().or(z.literal('')),
  paymentStatus: z.enum(['pending', 'paid', 'partial', 'failed', 'overdue']).optional(),
  paidAmount: commonSchemas.nonNegativeNumber.optional(),
  changeAmount: commonSchemas.nonNegativeNumber.optional(),
  notes: z.string().max(500).trim().optional(),
  autoSaveTimestamp: z.string().datetime().transform(str => new Date(str)).or(z.date()).optional(),
  isDraft: z.boolean().optional()
})

// Type exports
export type BaseTransaction = z.infer<typeof baseTransactionSchema>
export type Transaction = z.infer<typeof transactionSchema>
export type TransactionItem = z.infer<typeof transactionItemSchema>
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>
export type TransactionSearchInput = z.infer<typeof transactionSearchSchema>
export type CreateDraftInput = z.infer<typeof createDraftSchema>
export type UpdateDraftInput = z.infer<typeof updateDraftSchema>