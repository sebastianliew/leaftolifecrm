import { z } from 'zod'
import { commonSchemas, baseEntitySchema } from './index'

// Unified stock validation schema - allows negative stock for clinical workflow
export const stockValidationSchema = z.object({
  currentStock: z.number().int('Current stock must be a whole number'), // Allows negative
  availableStock: commonSchemas.nonNegativeNumber.int().optional(), // Always positive
  reservedStock: commonSchemas.nonNegativeNumber.int().default(0),
  reorderPoint: commonSchemas.nonNegativeNumber.int().default(10),
  totalQuantity: z.number().optional() // Can be negative for substances
})

// Stock movement validation schema
export const stockMovementSchema = z.object({
  productId: commonSchemas.mongoId,
  movementType: z.enum(['sale', 'return', 'adjustment', 'transfer', 'bundle_sale']),
  quantity: commonSchemas.positiveNumber,
  convertedQuantity: commonSchemas.positiveNumber.optional(),
  reason: z.string().min(1, 'Reason is required').trim(),
  reference: z.string().optional(),
  containerStatus: z.enum(['full', 'partial', 'empty']).optional()
})

// Product unit schema - allows negative stock for clinical workflow
export const productUnitSchema = z.object({
  isActive: z.boolean().default(false),
  price: commonSchemas.currency,
  currentStock: z.number().int('Stock must be a whole number'), // Allows negative
  minStock: commonSchemas.nonNegativeNumber.int().default(0),
  maxStock: commonSchemas.positiveNumber.int().optional()
})

// Product volume schema - allows negative stock for clinical workflow
export const productVolumeSchema = z.object({
  isActive: z.boolean().default(false),
  pricePerGram: commonSchemas.currency,
  currentStock: z.number(), // Allows negative for volume-based products
  minStock: commonSchemas.nonNegativeNumber.default(0),
  maxStock: commonSchemas.positiveNumber.optional(),
  unitOfMeasurement: commonSchemas.mongoId.optional()
})

// Product base schema (without refinement)
const productBaseSchema = baseEntitySchema.extend({
  name: z.string()
    .min(1, 'Product name is required')
    .max(200, 'Product name is too long')
    .trim(),
    
  sku: z.string()
    .min(1, 'SKU is required')
    .regex(/^[A-Z0-9-]+$/, 'SKU must contain only uppercase letters, numbers, and hyphens')
    .trim(),
    
  description: z.string()
    .max(1000, 'Description is too long')
    .trim()
    .optional(),
    
  category: z.string()
    .min(1, 'Category is required')
    .trim(),
    
  subcategory: z.string().trim().optional(),
  
  unit: productUnitSchema.optional(),
  volume: productVolumeSchema.optional(),
  
  brand: z.string().trim().optional(),
  supplier: z.string().trim().optional(),
  
  images: z.array(z.string().url()).default([]),
  
  tags: z.array(z.string().trim()).default([]),
  
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  
  metadata: z.record(z.string(), z.unknown()).optional()
})

// Product schema with refinement
export const productSchema = productBaseSchema.refine(
  (data) => data.unit?.isActive || data.volume?.isActive,
  'Product must have at least one active selling option (unit or volume)'
)

// Inventory adjustment schema - now uses unified stock validation
export const inventoryAdjustmentSchema = z.object({
  productId: commonSchemas.mongoId,
  adjustmentType: z.enum(['add', 'subtract', 'set']),
  currentStock: commonSchemas.positiveNumber,
  reason: z.string().min(1, 'Reason is required').trim(),
  notes: z.string().trim().optional()
}).merge(stockMovementSchema.pick({ quantity: true, convertedQuantity: true }))

// Restock schema - now uses unified stock validation  
export const restockSchema = z.object({
  productId: commonSchemas.mongoId,
  currentStock: commonSchemas.positiveNumber,
  cost: commonSchemas.currency.optional(),
  supplier: z.string().trim().optional(),
  invoiceNumber: z.string().trim().optional(),
  notes: z.string().trim().optional()
}).merge(stockMovementSchema.pick({ quantity: true, reason: true }))

// Product create/update schemas
export const createProductSchema = productBaseSchema.omit({ 
  _id: true, 
  createdAt: true, 
  updatedAt: true 
}).refine(
  (data) => data.unit?.isActive || data.volume?.isActive,
  'Product must have at least one active selling option (unit or volume)'
)

export const updateProductSchema = productBaseSchema.omit({ 
  _id: true, 
  createdAt: true, 
  updatedAt: true 
}).partial().refine(
  (data) => {
    // For updates, only check if at least one option is active when unit or volume is provided
    if (data.unit !== undefined || data.volume !== undefined) {
      return data.unit?.isActive || data.volume?.isActive
    }
    return true
  },
  'Product must have at least one active selling option (unit or volume)'
)

// Product search schema
export const productSearchSchema = z.object({
  name: z.string().trim().optional(),
  sku: z.string().trim().optional(),
  category: z.string().trim().optional(),
  minPrice: commonSchemas.nonNegativeNumber.optional(),
  maxPrice: commonSchemas.positiveNumber.optional(),
  inStock: z.boolean().optional(),
  isActive: z.boolean().optional()
})

// Type exports
export type Product = z.infer<typeof productSchema>
export type CreateProductInput = z.infer<typeof createProductSchema>
export type UpdateProductInput = z.infer<typeof updateProductSchema>
export type ProductSearchInput = z.infer<typeof productSearchSchema>
export type InventoryAdjustmentInput = z.infer<typeof inventoryAdjustmentSchema>
export type RestockInput = z.infer<typeof restockSchema>
export type StockValidation = z.infer<typeof stockValidationSchema>
export type StockMovement = z.infer<typeof stockMovementSchema>