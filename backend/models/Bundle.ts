import mongoose, { Document, Schema } from 'mongoose';

export interface IBundle extends Document {
  name: string;
  description?: string;
  category?: string;
  sku: string;
  status: 'active' | 'inactive' | 'discontinued' | 'pending_approval';
  isActive: boolean;
  isPromoted: boolean;
  promotionText?: string;
  validFrom?: Date;
  validUntil?: Date;
  
  // Bundle Products
  bundleProducts: Array<{
    productId: Schema.Types.ObjectId;
    product?: Record<string, unknown>;
    name: string;
    quantity: number;
    productType: 'product' | 'fixed_blend';
    blendTemplateId?: Schema.Types.ObjectId;
    unitOfMeasurementId?: Schema.Types.ObjectId;
    unitName?: string;
    individualPrice: number;
    totalPrice: number;
    notes?: string;
  }>;
  
  // Pricing
  bundlePrice: number;
  individualTotalPrice: number;
  savings: number;
  savingsPercentage: number;
  currency: string;
  
  // Inventory
  availableQuantity: number;
  maxQuantity: number;
  reorderPoint: number;
  
  // Metadata
  tags: string[];
  internalNotes?: string;
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  
  // System fields
  createdBy: Schema.Types.ObjectId;
  lastModifiedBy?: Schema.Types.ObjectId;
  
  // Migration support
  legacyId?: string;
  migrationData?: {
    source?: string;
    importedAt?: Date;
    originalData?: Map<string, unknown>;
  };
}

const bundleProductSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  name: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  productType: { type: String, enum: ['product', 'fixed_blend'], required: true },
  blendTemplateId: { type: mongoose.Schema.Types.ObjectId, ref: 'BlendTemplate' },
  unitOfMeasurementId: { type: mongoose.Schema.Types.ObjectId, ref: 'UnitOfMeasurement' },
  unitName: { type: String },
  individualPrice: { type: Number, required: true, min: 0 },
  totalPrice: { type: Number, required: true, min: 0 },
  notes: { type: String }
}, { _id: false });

const bundleSchema = new mongoose.Schema<IBundle>({
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  category: { type: String, trim: true },
  sku: { type: String, required: true, unique: true },
  status: {
    type: String,
    enum: ['active', 'inactive', 'discontinued', 'pending_approval'],
    default: 'active'
  },
  isActive: { type: Boolean, default: true },
  isPromoted: { type: Boolean, default: false },
  promotionText: { type: String, trim: true },
  validFrom: { type: Date },
  validUntil: { type: Date },
  
  // Bundle Products
  bundleProducts: [bundleProductSchema],
  
  // Pricing
  bundlePrice: { type: Number, required: true, min: 0 },
  individualTotalPrice: { type: Number, required: true, min: 0 },
  savings: { type: Number, required: true, min: 0 },
  savingsPercentage: { type: Number, required: true, min: 0, max: 100 },
  currency: { type: String, default: 'SGD' },
  
  // Inventory
  availableQuantity: { type: Number, default: 0, min: 0 },
  maxQuantity: { type: Number, default: 1000, min: 0 },
  reorderPoint: { type: Number, default: 5, min: 0 },
  
  // Metadata
  tags: [{ type: String, trim: true }],
  internalNotes: { type: String, trim: true },
  weight: { type: Number, min: 0 },
  dimensions: {
    length: { type: Number, min: 0 },
    width: { type: Number, min: 0 },
    height: { type: Number, min: 0 }
  },
  
  // System fields
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  lastModifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
  // Migration support
  legacyId: { type: String, index: true },
  migrationData: {
    source: { type: String },
    importedAt: { type: Date },
    originalData: {
      type: Map,
      of: mongoose.Schema.Types.Mixed
    }
  }
}, {
  timestamps: true
});

// Indexes for better query performance
bundleSchema.index({ status: 1 });
bundleSchema.index({ isActive: 1 });
bundleSchema.index({ isPromoted: 1 });
bundleSchema.index({ category: 1 });
bundleSchema.index({ name: 'text', description: 'text' });
bundleSchema.index({ createdAt: 1 });
bundleSchema.index({ bundlePrice: 1 });
bundleSchema.index({ savingsPercentage: 1 });
bundleSchema.index({ tags: 1 });

// Migration indexes
bundleSchema.index({ legacyId: 1, 'migrationData.source': 1 });
bundleSchema.index({ 'migrationData.importedAt': 1 });

// Pre-save middleware to generate SKU and calculate pricing
bundleSchema.pre('save', async function(next) {
  // Generate SKU if not provided
  if (!this.sku) {
    try {
      const count = await (this.constructor as mongoose.Model<unknown>).countDocuments({});
      this.sku = `BDL-${(count + 1).toString().padStart(6, '0')}`;
    } catch (error) {
      console.error('Error generating bundle SKU:', error);
      this.sku = `BDL-${Date.now()}`;
    }
  }
  
  // Calculate pricing automatically
  if (this.bundleProducts && this.bundleProducts.length > 0) {
    this.individualTotalPrice = this.bundleProducts.reduce((total, item) => {
      item.totalPrice = item.quantity * item.individualPrice;
      return total + item.totalPrice;
    }, 0);
    
    this.savings = Math.max(0, this.individualTotalPrice - this.bundlePrice);
    this.savingsPercentage = this.individualTotalPrice > 0 
      ? Math.round((this.savings / this.individualTotalPrice) * 100) 
      : 0;
  }
  
  next();
});

// Method to check bundle availability
bundleSchema.methods.checkAvailability = async function(quantity = 1) {
  const Product = mongoose.model('Product');
  
  const availability = {
    available: true,
    quantity: this.availableQuantity,
    issues: [] as string[]
  };
  
  // Check if bundle quantity available
  if (this.availableQuantity < quantity) {
    availability.available = false;
    availability.issues.push(`Only ${this.availableQuantity} bundles available, requested ${quantity}`);
  }
  
  // Check individual product availability
  for (const bundleProduct of this.bundleProducts) {
    const product = await Product.findById(bundleProduct.productId);
    if (!product) {
      availability.available = false;
      availability.issues.push(`Product ${bundleProduct.name} not found`);
      continue;
    }
    
    const requiredQuantity = bundleProduct.quantity * quantity;
    if (product.availableStock < requiredQuantity) {
      availability.available = false;
      availability.issues.push(`Insufficient stock for ${bundleProduct.name}: need ${requiredQuantity}, have ${product.availableStock}`);
    }
  }
  
  return availability;
};

// Method to update bundle availability based on product stock
bundleSchema.methods.updateAvailability = async function() {
  const Product = mongoose.model('Product');
  
  let minAvailableQuantity = this.maxQuantity;
  
  for (const bundleProduct of this.bundleProducts) {
    const product = await Product.findById(bundleProduct.productId);
    if (product) {
      const possibleQuantity = Math.floor(product.availableStock / bundleProduct.quantity);
      minAvailableQuantity = Math.min(minAvailableQuantity, possibleQuantity);
    } else {
      minAvailableQuantity = 0;
      break;
    }
  }
  
  this.availableQuantity = Math.max(0, minAvailableQuantity);
  await this.save();
  
  return this.availableQuantity;
};

export const Bundle = mongoose.models.Bundle || mongoose.model('Bundle', bundleSchema);