import mongoose, { Document, Schema } from 'mongoose';
import * as StockService from '../services/inventory/ProductStockService.js';
import { populateReferences } from '../services/inventory/ProductReferenceService.js';

// ── Interface ──

export interface IProduct extends Document {
  name: string;
  description?: string;
  category: Schema.Types.ObjectId;
  sku: string;
  brand?: Schema.Types.ObjectId;
  unitOfMeasurement: Schema.Types.ObjectId;
  quantity: number;
  reorderPoint: number;
  currentStock: number;
  totalQuantity: number;
  availableStock: number;
  reservedStock: number;
  costPrice?: number;
  sellingPrice?: number;
  status: 'active' | 'inactive' | 'discontinued' | 'pending_approval';
  isActive: boolean;
  expiryDate?: Date;
  autoReorderEnabled: boolean;
  lastRestockDate?: Date;
  restockFrequency: number;
  averageRestockQuantity: number;
  restockCount: number;
  supplierId?: Schema.Types.ObjectId;
  supplierName?: string;
  categoryName?: string;
  brandName?: string;
  unitName?: string;
  bundleInfo?: string;
  bundlePrice?: number;
  hasBundle?: boolean;
  legacyId?: string;
  migrationData?: {
    source?: string;
    importedAt?: Date;
    originalData?: Record<string, unknown>;
  };
  discountFlags?: {
    discountableForAll?: boolean;
    discountableForMembers?: boolean;
    discountableInBlends?: boolean;
  };
  unitConversions?: {
    targetUnit?: Schema.Types.ObjectId;
    conversionFactor?: number;
    notes?: string;
  };
  baseUnitSize?: number;
  isDeleted?: boolean;
  deletedAt?: Date;
  deletedBy?: string;
  deleteReason?: string;
  createdAt: Date;
  updatedAt: Date;

  // Instance methods
  updateRestockAnalytics(quantity: number): Promise<void>;
  needsRestock(threshold?: number): boolean;
  getSuggestedRestockQuantity(): number;
  isAutoReorderDue(): boolean;
  getBackorderQuantity(): number;
  isOversold(): boolean;
  getAvailableStock(): number;
  needsUrgentRestock(): boolean;
  populateReferences(): Promise<IProduct>;
  convertUnit(fromValue: number, fromUnit: string, toUnit: string): number;
  addUnitConversion(fromUnit: string, toUnit: string, factor: number): Promise<void>;
  generateSKU(): Promise<string>;
}

// ── Schema ──

const productSchema = new mongoose.Schema<IProduct>({
  name: { type: String, required: true },
  description: String,
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  sku: { type: String, required: true },
  brand: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand' },
  unitOfMeasurement: { type: mongoose.Schema.Types.ObjectId, ref: 'UnitOfMeasurement', required: true },
  quantity: { type: Number, required: true, default: 0 },
  reorderPoint: { type: Number, required: true, default: 10 },
  currentStock: { type: Number, required: true, default: 0 },
  totalQuantity: { type: Number, default: 0 },
  availableStock: { type: Number, default: 0 },
  reservedStock: { type: Number, default: 0 },
  costPrice: Number,
  sellingPrice: Number,
  status: { type: String, enum: ['active', 'inactive', 'discontinued', 'pending_approval'], default: 'active' },
  isActive: { type: Boolean, default: true },
  expiryDate: { type: Date },
  autoReorderEnabled: { type: Boolean, default: false },
  lastRestockDate: { type: Date },
  restockFrequency: { type: Number, default: 30 },
  averageRestockQuantity: { type: Number, default: 0 },
  restockCount: { type: Number, default: 0 },
  categoryName: String,
  brandName: String,
  unitName: String,
  bundleInfo: String,
  bundlePrice: Number,
  hasBundle: { type: Boolean, default: false },
  legacyId: { type: String, index: true },
  migrationData: {
    source: String,
    importedAt: Date,
    originalData: mongoose.Schema.Types.Mixed
  },
  discountFlags: {
    discountableForAll: { type: Boolean, default: true },
    discountableForMembers: { type: Boolean, default: true },
    discountableInBlends: { type: Boolean, default: false }
  },
  unitConversions: {
    type: Map,
    of: { to: String, factor: Number },
    default: new Map()
  },
  baseUnitSize: { type: Number, default: 1 },
  supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
  supplierName: String,
  isDeleted: { type: Boolean, default: false },
  deletedAt: Date,
  deletedBy: String,
  deleteReason: String
}, { timestamps: true });

// ── Indexes ──

productSchema.index({ status: 1 });
productSchema.index({ category: 1 });
productSchema.index({ currentStock: 1, reorderPoint: 1 });
productSchema.index({ autoReorderEnabled: 1, lastRestockDate: 1 });
productSchema.index({ legacyId: 1, 'migrationData.source': 1 });
productSchema.index({ 'migrationData.importedAt': 1 });
productSchema.index({ isDeleted: 1 });
productSchema.index({ deletedAt: 1 });
productSchema.index({ isDeleted: 1, status: 1 });
productSchema.index({ sku: 1 }, { unique: true, partialFilterExpression: { isDeleted: { $ne: true } } });
productSchema.index({ name: 'text', sku: 'text', description: 'text' });

// ── Methods ──

productSchema.methods.updateRestockAnalytics = async function (quantity: number) {
  const self = this as unknown as IProduct;
  const analytics = StockService.calculateRestockAnalytics(self, quantity);
  Object.assign(this, analytics);
  await this.save();
};

productSchema.methods.needsRestock = function (threshold?: number) {
  return StockService.needsRestock(this as unknown as IProduct, threshold);
};

productSchema.methods.getSuggestedRestockQuantity = function () {
  return StockService.getSuggestedRestockQuantity(this as unknown as IProduct);
};

productSchema.methods.isAutoReorderDue = function () {
  return StockService.isAutoReorderDue(this as unknown as IProduct);
};

productSchema.methods.getBackorderQuantity = function () {
  return StockService.getBackorderQuantity(this as unknown as IProduct);
};

productSchema.methods.isOversold = function () {
  return StockService.isOversold(this as unknown as IProduct);
};

productSchema.methods.getAvailableStock = function () {
  return StockService.getAvailableStock(this as unknown as IProduct);
};

productSchema.methods.needsUrgentRestock = function () {
  return StockService.needsUrgentRestock(this as unknown as IProduct);
};

productSchema.methods.populateReferences = async function () {
  return populateReferences(this);
};

productSchema.methods.convertUnit = function (fromValue: number, fromUnit: string, toUnit: string): number {
  if (fromUnit === toUnit) return fromValue;

  const conversion = this.unitConversions?.get(fromUnit);
  if (conversion?.to === toUnit) return fromValue * conversion.factor;

  const reverse = this.unitConversions?.get(toUnit);
  if (reverse?.to === fromUnit) return fromValue / reverse.factor;

  const common: Record<string, Record<string, number>> = {
    drops: { ml: 0.05 }, ml: { l: 0.001, drops: 20 },
    g: { kg: 0.001 }, kg: { g: 1000 }, l: { ml: 1000 }
  };
  if (common[fromUnit]?.[toUnit]) return fromValue * common[fromUnit][toUnit];

  throw new Error(`Cannot convert from ${fromUnit} to ${toUnit}`);
};

productSchema.methods.addUnitConversion = async function (fromUnit: string, toUnit: string, factor: number) {
  if (!this.unitConversions) this.unitConversions = new Map();
  this.unitConversions.set(fromUnit, { to: toUnit, factor });
  await this.save();
};

productSchema.methods.generateSKU = async function () {
  if (this.sku) return this.sku;
  const brandPrefix = this.brandName ? this.brandName.substring(0, 3).toUpperCase() : 'GEN';
  const productAbbr = this.name.substring(0, 2).toUpperCase();

  const existing = await Product.find({ sku: { $regex: `^${brandPrefix}-${productAbbr}-` } }).sort({ sku: 1 });
  let next = 1;
  if (existing.length) {
    const match = existing[existing.length - 1].sku.match(/-(\d+)$/);
    if (match) next = parseInt(match[1]) + 1;
  }

  this.sku = `${brandPrefix}-${productAbbr}-${next.toString().padStart(3, '0')}`;
  return this.sku;
};

productSchema.methods.softDelete = async function (userId?: string, reason?: string) {
  this.isDeleted = true;
  this.isActive = false;
  this.status = 'inactive';
  this.deletedAt = new Date();
  if (userId) this.deletedBy = userId;
  if (reason) this.deleteReason = reason;
  return this.save();
};

export const Product = mongoose.models.Product || mongoose.model('Product', productSchema);
