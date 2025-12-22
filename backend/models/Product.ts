import mongoose, { Document, Schema } from 'mongoose';

export interface IProduct extends Document {
  name: string;
  description?: string;
  category: Schema.Types.ObjectId;
  sku: string;
  brand?: Schema.Types.ObjectId;
  containerType?: Schema.Types.ObjectId;
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
  containerCapacity: number;
  containers: {
    full: number;
    empty: number;
    partial: Array<{
      id: string;
      remaining: number;
      capacity: number;
      status: 'full' | 'partial' | 'empty';
      lastMovement?: Schema.Types.ObjectId;
    }>;
  };
  supplierId?: Schema.Types.ObjectId;
  supplierName?: string;
  // Simplified entry fields for CSV-like interface
  categoryName?: string;
  brandName?: string;
  unitName?: string;
  containerTypeName?: string;
  bundleInfo?: string;
  bundlePrice?: number;
  hasBundle?: boolean;
  // Migration support fields
  legacyId?: string;
  migrationData?: {
    source?: string;
    importedAt?: Date;
    originalData?: Record<string, unknown>;
  };
  // Fields from SQL that don't exist in current schema
  discountFlags?: {
    discountableForAll?: boolean;
    discountableForMembers?: boolean;
    discountableInBlends?: boolean;
  };
  // Unit conversion support for blends
  unitConversions?: {
    targetUnit?: Schema.Types.ObjectId;
    conversionFactor?: number;
    notes?: string;
  };
  // Common unit size for blends (e.g., 1ml, 20 drops, 1g)
  baseUnitSize?: number;
  isDeleted?: boolean;
  deletedAt?: Date;
  deletedBy?: string;
  deleteReason?: string;
  createdAt: Date;
  updatedAt: Date;
  
  // Method signatures
  handlePartialContainerSale(quantity: number): Promise<void>;
  handleFullContainerSale(): Promise<void>;
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

// Container Schema
const ContainerSchema = new mongoose.Schema({
  id: { type: String, required: true },
  remaining: { type: Number, required: true },
  capacity: { type: Number, required: true },
  status: { 
    type: String, 
    enum: ['full', 'partial', 'empty'],
    default: 'full'
  },
  lastMovement: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InventoryMovement'
  }
}, { _id: false });

const productSchema = new mongoose.Schema<IProduct>({
  name: { type: String, required: true },
  description: String,
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  sku: { type: String, required: true },
  brand: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand' },
  containerType: { type: mongoose.Schema.Types.ObjectId, ref: 'ContainerType' },
  unitOfMeasurement: { type: mongoose.Schema.Types.ObjectId, ref: 'UnitOfMeasurement', required: true },
  quantity: { type: Number, required: true, default: 0 },
  reorderPoint: { type: Number, required: true, default: 10 },
  currentStock: { type: Number, required: true, default: 0 },
  totalQuantity: { type: Number, default: 0 },
  availableStock: { type: Number, default: 0 },
  reservedStock: { type: Number, default: 0 },
  costPrice: Number,
  sellingPrice: Number,
  status: { 
    type: String, 
    enum: ['active', 'inactive', 'discontinued', 'pending_approval'],
    default: 'active'
  },
  isActive: { type: Boolean, default: true },
  expiryDate: { type: Date },
  // Restock features
  autoReorderEnabled: { type: Boolean, default: false },
  lastRestockDate: { type: Date },
  restockFrequency: { type: Number, default: 30 }, // days
  averageRestockQuantity: { type: Number, default: 0 },
  restockCount: { type: Number, default: 0 },
  // Container tracking
  containerCapacity: { type: Number, required: false, default: 0 },
  containers: {
    full: { type: Number, default: 0 },
    partial: [ContainerSchema]
  },
  // Simplified entry fields for CSV-like interface
  categoryName: { type: String }, // Direct text entry
  brandName: { type: String }, // Direct text entry  
  unitName: { type: String }, // Direct text entry
  containerTypeName: { type: String }, // Direct text entry
  bundleInfo: { type: String }, // From CSV "Bundle?" column
  bundlePrice: { type: Number }, // From CSV "Bundle price" column
  hasBundle: { type: Boolean, default: false }, // Computed from bundleInfo
  
  // Migration support fields
  legacyId: { type: String, index: true }, // Original SQL ID
  migrationData: {
    source: { type: String }, // 'sql_inventory', 'sql_component', etc.
    importedAt: { type: Date },
    originalData: { type: mongoose.Schema.Types.Mixed } // Store original row for reference
  },
  
  // Fields from SQL that don't exist in current schema
  discountFlags: {
    discountableForAll: { type: Boolean, default: true },
    discountableForMembers: { type: Boolean, default: true },
    discountableInBlends: { type: Boolean, default: false }
  },
  
  // Unit conversion support for blends
  unitConversions: {
    type: Map,
    of: {
      to: String,
      factor: Number
    },
    default: new Map()
  },
  // Common unit size for blends (e.g., 1ml, 20 drops, 1g)
  baseUnitSize: { type: Number, default: 1 },
  
  supplierId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier'
  },
  supplierName: { type: String }, // For direct entry during migration

  // Soft delete fields
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  deletedBy: { type: String },
  deleteReason: { type: String }
}, {
  timestamps: true
});

// Add indexes for better query performance
productSchema.index({ status: 1 });
productSchema.index({ category: 1 });
productSchema.index({ currentStock: 1, reorderPoint: 1 });
productSchema.index({ autoReorderEnabled: 1, lastRestockDate: 1 });
// Migration indexes
productSchema.index({ legacyId: 1, 'migrationData.source': 1 });
productSchema.index({ 'migrationData.importedAt': 1 });

// Soft delete indexes
productSchema.index({ isDeleted: 1 });
productSchema.index({ deletedAt: 1 });
productSchema.index({ isDeleted: 1, status: 1 });

// Unique SKU index that allows duplicates only when one is deleted
// This ensures active products have unique SKUs
productSchema.index(
  { sku: 1 },
  {
    unique: true,
    partialFilterExpression: { isDeleted: { $ne: true } }
  }
);

// Text index for search functionality
productSchema.index({ name: 'text', sku: 'text', description: 'text' });

// Virtual for total stock calculation
productSchema.virtual('totalStock').get(function() {
  const fullContainers = this.containers?.full || 0;
  const partialContainers = Array.isArray(this.containers?.partial) ? this.containers.partial : [];
  return (fullContainers * (this.containerCapacity || 0)) + 
         partialContainers.reduce((sum, p) => sum + (p?.remaining || 0), 0);
});

// Method to handle partial container sale
productSchema.methods.handlePartialContainerSale = async function(quantity: number) {
  // If no container capacity is set, treat as regular stock deduction
  if (!this.containerCapacity || this.containerCapacity <= 0) {
    // Allow negative stock - validation removed for clinical workflow
    // Staff can sell out-of-stock items and reconcile inventory later
    this.currentStock -= quantity;
    await this.save();
    return;
  }
  
  // Container-based logic
  if (this.containers?.full > 0) {
    // Convert a full container to partial
    this.containers.full--;
    if (!Array.isArray(this.containers.partial)) {
      this.containers.partial = [];
    }
    this.containers.partial.push({
      id: `CONTAINER_${Date.now()}`,
      remaining: this.containerCapacity - quantity,
      capacity: this.containerCapacity,
      status: 'partial'
    });
  } else if (Array.isArray(this.containers?.partial) && this.containers.partial.length > 0) {
    // Update existing partial container
    const container = this.containers.partial[0];
    container.remaining -= quantity;
    if (container.remaining <= 0) {
      this.containers.partial.shift(); // Remove empty container
    } else {
      container.status = container.remaining < this.containerCapacity ? 'partial' : 'full';
    }
  } else {
    // No containers available - allow out-of-stock sales by tracking as negative partial container
    if (!this.containers) {
      this.containers = { full: 0, partial: [], empty: [] };
    }
    if (!Array.isArray(this.containers.partial)) {
      this.containers.partial = [];
    }
    // Create a negative partial container to track oversold quantity
    this.containers.partial.push({
      id: `OVERSOLD_${Date.now()}`,
      remaining: -quantity,  // Negative remaining indicates oversold amount
      capacity: this.containerCapacity,
      status: 'oversold'
    });
  }
  
  // Update current stock (recalculate from container data)
  this.currentStock = this.totalStock;
  await this.save();
};

// Method to handle full container sale
productSchema.methods.handleFullContainerSale = async function() {
  // If no container capacity is set, treat as regular stock deduction
  if (!this.containerCapacity || this.containerCapacity <= 0) {
    // Allow negative stock - validation removed for clinical workflow
    // Staff can sell out-of-stock items and reconcile inventory later
    this.currentStock--;
    await this.save();
    return;
  }
  
  // Container-based logic - allow negative container counts for out-of-stock sales
  if (this.containers?.full > 0) {
    this.containers.full--;
    this.currentStock = this.totalStock;
  } else {
    // Allow selling when no full containers available - track as negative container count
    if (!this.containers) {
      this.containers = { full: 0, partial: [], empty: [] };
    }
    this.containers.full--;  // This will go negative, indicating oversold containers
    this.currentStock--;     // Track container deduction
  }
  await this.save();
};

// Method to update restock analytics
productSchema.methods.updateRestockAnalytics = async function(quantity: number) {
  this.lastRestockDate = new Date();
  this.restockCount = (this.restockCount || 0) + 1;
  
  // Update average restock quantity using rolling average
  if (this.restockCount === 1) {
    this.averageRestockQuantity = quantity;
  } else {
    this.averageRestockQuantity = ((this.averageRestockQuantity * (this.restockCount - 1)) + quantity) / this.restockCount;
  }
  
  await this.save();
};

// Method to check if product needs restocking
productSchema.methods.needsRestock = function(threshold: number = 1.0): boolean {
  return this.currentStock <= (this.reorderPoint * threshold);
};

// Method to get suggested restock quantity
productSchema.methods.getSuggestedRestockQuantity = function(): number {
  if (this.averageRestockQuantity > 0) {
    return Math.max(this.averageRestockQuantity, this.reorderPoint - this.currentStock);
  }
  return Math.max(this.reorderPoint, this.reorderPoint - this.currentStock);
};

// Method to check if auto-reorder is due
productSchema.methods.isAutoReorderDue = function(): boolean {
  if (!this.autoReorderEnabled || !this.lastRestockDate) return false;
  
  const daysSinceLastRestock = Math.floor(
    (Date.now() - this.lastRestockDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  
  return daysSinceLastRestock >= this.restockFrequency;
};

// Method to get backorder quantity (negative stock amount)
productSchema.methods.getBackorderQuantity = function(): number {
  return Math.abs(Math.min(0, this.currentStock));
};

// Method to check if product is oversold (has negative stock)
productSchema.methods.isOversold = function(): boolean {
  return this.currentStock < 0;
};

// Method to get safe available stock (never negative for UI display)
productSchema.methods.getAvailableStock = function(): number {
  return Math.max(0, this.currentStock - (this.reservedStock || 0));
};

// Method to check if product needs urgent restocking (oversold or very low)
productSchema.methods.needsUrgentRestock = function(): boolean {
  return this.currentStock <= 0 || this.currentStock <= (this.reorderPoint * 0.5);
};

// Method to auto-create reference data and populate ObjectIds
productSchema.methods.populateReferences = async function() {
  try {
    const { Category } = await import('./Category.js');
    const { Brand } = await import('./Brand.js');
    const { UnitOfMeasurement } = await import('./UnitOfMeasurement.js');
    const { ContainerType } = await import('./ContainerType.js');

    // Auto-create Category if categoryName is provided
    if (this.categoryName && !this.category) {
      let category = await Category.findOne({ name: this.categoryName });
      if (!category) {
        category = new Category({ name: this.categoryName, isActive: true });
        await category.save();
      }
      this.category = category._id;
    }

    // Auto-create Brand if brandName is provided
    if (this.brandName && !this.brand) {
      let brand = await Brand.findOne({ name: this.brandName });
      if (!brand) {
        brand = new Brand({ name: this.brandName, isActive: true });
        await brand.save();
      }
      this.brand = brand._id;
    }


    // Auto-create UnitOfMeasurement if unitName is provided
    if (this.unitName && !this.unitOfMeasurement) {
      let unit = await UnitOfMeasurement.findOne({ 
        $or: [{ name: this.unitName }, { abbreviation: this.unitName }]
      });
      if (!unit) {
        // Determine unit type based on common patterns
        let unitType = 'count';
        if (['g', 'gram', 'grams', 'kg', 'kilogram'].includes(this.unitName.toLowerCase())) {
          unitType = 'weight';
        } else if (['ml', 'milliliter', 'l', 'liter', 'drops'].includes(this.unitName.toLowerCase())) {
          unitType = 'volume';
        }
        
        unit = new UnitOfMeasurement({ 
          name: this.unitName,
          abbreviation: this.unitName,
          type: unitType,
          isActive: true
        });
        await unit.save();
      }
      this.unitOfMeasurement = unit._id;
    }

    // Auto-create ContainerType if containerTypeName is provided
    if (this.containerTypeName && !this.containerType) {
      let containerType = await ContainerType.findOne({ name: this.containerTypeName });
      if (!containerType) {
        containerType = new ContainerType({ 
          name: this.containerTypeName,
          isActive: true
        });
        await containerType.save();
      }
      this.containerType = containerType._id;
    }

    return this;
  } catch (error) {
    console.error('Error populating references:', error);
    throw error;
  }
};

// Method to convert between units
productSchema.methods.convertUnit = function(fromValue: number, fromUnit: string, toUnit: string): number {
  // If same unit, return as is
  if (fromUnit === toUnit) return fromValue;
  
  // Check if we have a direct conversion
  const conversion = this.unitConversions?.get(fromUnit);
  if (conversion && conversion.to === toUnit) {
    return fromValue * conversion.factor;
  }
  
  // Check reverse conversion
  const reverseConversion = this.unitConversions?.get(toUnit);
  if (reverseConversion && reverseConversion.to === fromUnit) {
    return fromValue / reverseConversion.factor;
  }
  
  // Common conversions if not in product-specific conversions
  const commonConversions: Record<string, Record<string, number>> = {
    'drops': { 'ml': 0.05 },
    'ml': { 'l': 0.001, 'drops': 20 },
    'g': { 'kg': 0.001 },
    'kg': { 'g': 1000 },
    'l': { 'ml': 1000 }
  };
  
  if (commonConversions[fromUnit]?.[toUnit]) {
    return fromValue * commonConversions[fromUnit][toUnit];
  }
  
  throw new Error(`Cannot convert from ${fromUnit} to ${toUnit}`);
};

// Method to add unit conversion
productSchema.methods.addUnitConversion = async function(fromUnit: string, toUnit: string, factor: number) {
  if (!this.unitConversions) {
    this.unitConversions = new Map();
  }
  this.unitConversions.set(fromUnit, { to: toUnit, factor });
  await this.save();
};

// Method to generate SKU automatically
productSchema.methods.generateSKU = async function() {
  if (this.sku) return this.sku;

  try {
    // Get brand prefix (first 3 letters of brand name, default to 'GEN')
    let brandPrefix = 'GEN';
    if (this.brandName) {
      brandPrefix = this.brandName.substring(0, 3).toUpperCase();
    }

    // Get product abbreviation (first 2 letters of product name)
    const productAbbr = this.name.substring(0, 2).toUpperCase();

    // Find the next sequential number for this brand
    const existingProducts = await Product.find({
      sku: { $regex: `^${brandPrefix}-${productAbbr}-` }
    }).sort({ sku: 1 });

    let nextNumber = 1;
    if (existingProducts.length > 0) {
      const lastSKU = existingProducts[existingProducts.length - 1].sku;
      const match = lastSKU.match(/-(\d+)$/);
      if (match) {
        nextNumber = parseInt(match[1]) + 1;
      }
    }

    this.sku = `${brandPrefix}-${productAbbr}-${nextNumber.toString().padStart(3, '0')}`;
    return this.sku;
  } catch (error) {
    console.error('Error generating SKU:', error);
    this.sku = `GEN-${Date.now()}`;
    return this.sku;
  }
};

export const Product = mongoose.models.Product || mongoose.model('Product', productSchema); 