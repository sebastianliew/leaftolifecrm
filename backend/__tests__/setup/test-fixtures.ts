import mongoose from 'mongoose';

// Import models - these will be registered when imported
import { Product } from '../../models/Product.js';
import { Bundle } from '../../models/Bundle.js';
import { BlendTemplate } from '../../models/BlendTemplate.js';
import { InventoryMovement } from '../../models/inventory/InventoryMovement.js';

// Create a simple UnitOfMeasurement schema for tests
const UnitOfMeasurementSchema = new mongoose.Schema({
  name: { type: String, required: true },
  abbreviation: { type: String, required: true },
  type: { type: String, enum: ['volume', 'weight', 'count', 'length'], default: 'volume' },
  conversionRate: { type: Number, default: 1 },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Create a simple Category schema for tests
const CategorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Register test models if not already registered
export const UnitOfMeasurement = mongoose.models.UnitOfMeasurement ||
  mongoose.model('UnitOfMeasurement', UnitOfMeasurementSchema);

export const Category = mongoose.models.Category ||
  mongoose.model('Category', CategorySchema);

// Counter for unique identifiers
let counter = 0;
const getUniqueId = () => ++counter;

/**
 * Create a test unit of measurement
 */
export async function createTestUnit(overrides: Partial<{
  name: string;
  abbreviation: string;
  type: string;
  conversionRate: number;
  isActive: boolean;
}> = {}) {
  const id = getUniqueId();
  return await UnitOfMeasurement.create({
    name: overrides.name || `ml-${id}`,
    abbreviation: overrides.abbreviation || 'ml',
    type: overrides.type || 'volume',
    conversionRate: overrides.conversionRate || 1,
    isActive: overrides.isActive ?? true,
    ...overrides
  });
}

/**
 * Create a test category
 */
export async function createTestCategory(overrides: Partial<{
  name: string;
  description: string;
  isActive: boolean;
}> = {}) {
  const id = getUniqueId();
  return await Category.create({
    name: overrides.name || `Test Category ${id}`,
    description: overrides.description || 'Test category description',
    isActive: overrides.isActive ?? true,
    ...overrides
  });
}

/**
 * Create a test product
 */
export async function createTestProduct(overrides: Partial<{
  name: string;
  sku: string;
  category: mongoose.Types.ObjectId;
  unitOfMeasurement: mongoose.Types.ObjectId;
  quantity: number;
  currentStock: number;
  availableStock: number;
  reservedStock: number;
  containerCapacity: number;
  containers: {
    full: number;
    partial: Array<{
      id: string;
      remaining: number;
      capacity: number;
      status: 'full' | 'partial' | 'empty' | 'oversold';
      saleHistory?: Array<{
        transactionRef: string;
        quantitySold: number;
        soldAt: Date;
        soldBy?: string;
      }>;
    }>;
  };
  reorderPoint: number;
  sellingPrice: number;
  costPrice: number;
  isActive: boolean;
  status: string;
}> = {}) {
  const id = getUniqueId();

  // Create dependencies if not provided
  const unit = overrides.unitOfMeasurement || (await createTestUnit())._id;
  const category = overrides.category || (await createTestCategory())._id;

  const productData = {
    name: overrides.name || `Test Product ${id}`,
    sku: overrides.sku || `SKU-${Date.now()}-${id}`,
    category,
    unitOfMeasurement: unit,
    quantity: overrides.quantity ?? 100,
    currentStock: overrides.currentStock ?? 100,
    availableStock: overrides.availableStock ?? 100,
    reservedStock: overrides.reservedStock ?? 0,
    containerCapacity: overrides.containerCapacity ?? 0,
    containers: overrides.containers || { full: 0, partial: [] },
    reorderPoint: overrides.reorderPoint ?? 10,
    sellingPrice: overrides.sellingPrice ?? 25.00,
    costPrice: overrides.costPrice ?? 10.00,
    isActive: overrides.isActive ?? true,
    status: overrides.status || 'active'
  };

  return await Product.create(productData);
}

/**
 * Create a test product with container tracking
 */
export async function createTestProductWithContainers(overrides: {
  name?: string;
  containerCapacity: number;
  fullContainers: number;
  partialContainers?: Array<{
    id?: string;
    remaining: number;
    capacity?: number;
    status?: 'full' | 'partial' | 'empty' | 'oversold';
  }>;
} & Partial<{
  unitOfMeasurement: mongoose.Types.ObjectId;
  category: mongoose.Types.ObjectId;
  sellingPrice: number;
  costPrice: number;
}>) {
  const id = getUniqueId();
  const containerCapacity = overrides.containerCapacity;

  // Build partial containers array
  const partial = (overrides.partialContainers || []).map((p, idx) => ({
    id: p.id || `BOTTLE_${Date.now()}_${idx}`,
    remaining: p.remaining,
    capacity: p.capacity ?? containerCapacity,
    status: p.status || 'partial' as const,
    saleHistory: []
  }));

  // Calculate current stock from containers
  const fullStock = overrides.fullContainers * containerCapacity;
  const partialStock = partial.reduce((sum, p) => sum + Math.max(0, p.remaining), 0);
  const currentStock = fullStock + partialStock;

  return await createTestProduct({
    name: overrides.name || `Test Bottled Product ${id}`,
    containerCapacity,
    containers: {
      full: overrides.fullContainers,
      partial
    },
    currentStock,
    availableStock: currentStock,
    quantity: currentStock,
    unitOfMeasurement: overrides.unitOfMeasurement,
    category: overrides.category,
    sellingPrice: overrides.sellingPrice,
    costPrice: overrides.costPrice
  });
}

/**
 * Create a test blend template
 */
export async function createTestBlendTemplate(ingredients: Array<{
  productId: mongoose.Types.ObjectId;
  name: string;
  quantity: number;
  unitOfMeasurementId: mongoose.Types.ObjectId;
  unitName: string;
  costPerUnit?: number;
}>, overrides: Partial<{
  name: string;
  batchSize: number;
  sellingPrice: number;
  isActive: boolean;
  usageCount: number;
  unitOfMeasurementId: mongoose.Types.ObjectId;
  unitName: string;
}> = {}) {
  const id = getUniqueId();
  const unit = overrides.unitOfMeasurementId || (await createTestUnit())._id;

  return await BlendTemplate.create({
    name: overrides.name || `Test Blend ${id}`,
    batchSize: overrides.batchSize ?? 1,
    unitOfMeasurementId: unit,
    unitName: overrides.unitName || 'ml',
    ingredients,
    sellingPrice: overrides.sellingPrice ?? 35.00,
    isActive: overrides.isActive ?? true,
    usageCount: overrides.usageCount ?? 0,
    createdBy: 'test-user'
  });
}

/**
 * Create a test bundle
 */
export async function createTestBundle(products: Array<{
  productId: mongoose.Types.ObjectId;
  name: string;
  quantity: number;
  productType: 'product' | 'fixed_blend';
  blendTemplateId?: mongoose.Types.ObjectId;
  unitOfMeasurementId?: mongoose.Types.ObjectId;
  unitName?: string;
  individualPrice: number;
  totalPrice?: number;
}>, overrides: Partial<{
  name: string;
  sku: string;
  bundlePrice: number;
  isActive: boolean;
  status: string;
  availableQuantity: number;
  maxQuantity: number;
}> = {}) {
  const id = getUniqueId();

  // Calculate total price for each product
  const bundleProducts = products.map(p => ({
    ...p,
    totalPrice: p.totalPrice ?? p.quantity * p.individualPrice
  }));

  const individualTotalPrice = bundleProducts.reduce((sum, p) => sum + p.totalPrice, 0);
  const bundlePrice = overrides.bundlePrice ?? individualTotalPrice * 0.8; // 20% discount by default

  return await Bundle.create({
    name: overrides.name || `Test Bundle ${id}`,
    sku: overrides.sku || `BDL-${Date.now()}-${id}`,
    bundleProducts,
    bundlePrice,
    individualTotalPrice,
    savings: individualTotalPrice - bundlePrice,
    savingsPercentage: Math.round(((individualTotalPrice - bundlePrice) / individualTotalPrice) * 100),
    isActive: overrides.isActive ?? true,
    status: overrides.status || 'active',
    availableQuantity: overrides.availableQuantity ?? 100,
    maxQuantity: overrides.maxQuantity ?? 1000,
    createdBy: new mongoose.Types.ObjectId()
  });
}

/**
 * Create a test transaction item
 */
export function createTestTransactionItem(overrides: Partial<{
  productId: string;
  name: string;
  quantity: number;
  unitOfMeasurementId: string;
  baseUnit: string;
  convertedQuantity: number;
  itemType: 'product' | 'fixed_blend' | 'custom_blend' | 'bundle' | 'miscellaneous' | 'service' | 'consultation';
  saleType: 'quantity' | 'volume';
  containerId: string;
  unitPrice: number;
  totalPrice: number;
}>) {
  return {
    productId: overrides.productId || new mongoose.Types.ObjectId().toString(),
    name: overrides.name || 'Test Item',
    quantity: overrides.quantity ?? 1,
    unitOfMeasurementId: overrides.unitOfMeasurementId || new mongoose.Types.ObjectId().toString(),
    baseUnit: overrides.baseUnit || 'unit',
    convertedQuantity: overrides.convertedQuantity ?? overrides.quantity ?? 1,
    itemType: overrides.itemType || 'product',
    saleType: overrides.saleType || 'quantity',
    containerId: overrides.containerId,
    unitPrice: overrides.unitPrice ?? 25,
    totalPrice: overrides.totalPrice ?? (overrides.unitPrice ?? 25) * (overrides.quantity ?? 1)
  };
}

/**
 * Create a mock transaction object
 */
export function createTestTransaction(items: ReturnType<typeof createTestTransactionItem>[], overrides: Partial<{
  transactionNumber: string;
  type: 'DRAFT' | 'COMPLETED';
  status: string;
  customerName: string;
  customerEmail: string;
  subtotal: number;
  totalAmount: number;
  discountAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  paidAmount: number;
  changeAmount: number;
  createdBy: string;
}> = {}) {
  const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
  const discountAmount = overrides.discountAmount ?? 0;
  const totalAmount = overrides.totalAmount ?? subtotal - discountAmount;

  return {
    transactionNumber: overrides.transactionNumber || `TXN-${Date.now()}-${getUniqueId()}`,
    type: overrides.type || 'COMPLETED',
    status: overrides.status || 'completed',
    customerName: overrides.customerName || 'Test Customer',
    customerEmail: overrides.customerEmail || 'test@example.com',
    items,
    subtotal: overrides.subtotal ?? subtotal,
    totalAmount,
    discountAmount,
    paymentMethod: overrides.paymentMethod || 'cash',
    paymentStatus: overrides.paymentStatus || 'paid',
    paidAmount: overrides.paidAmount ?? totalAmount,
    changeAmount: overrides.changeAmount ?? 0,
    transactionDate: new Date(),
    createdBy: overrides.createdBy || 'test-user'
  };
}

/**
 * Reset counter (useful for test isolation)
 */
export function resetCounter() {
  counter = 0;
}

// Re-export models for convenience
export { Product, Bundle, BlendTemplate, InventoryMovement };
