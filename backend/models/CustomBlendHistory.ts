import mongoose, { Document, Model } from 'mongoose';
import crypto from 'crypto';

// Blend ingredient interface
interface IBlendIngredient {
  productId: mongoose.Types.ObjectId;
  name: string;
  quantity: number;
  unitOfMeasurementId: mongoose.Types.ObjectId;
  unitName: string;
  costPerUnit?: number;
  selectedContainers?: Array<{
    containerId: string;
    containerCode: string;
    quantityToConsume: number;
    batchNumber?: string;
    expiryDate?: Date;
  }>;
}

// TypeScript interfaces
interface ICustomBlendHistory extends Document {
  blendName: string;
  customerId?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  ingredients: IBlendIngredient[];
  totalIngredientCost: number;
  sellingPrice: number;
  marginPercent: number;
  containerType?: mongoose.Types.ObjectId;
  containerCapacity?: number;
  preparationNotes?: string;
  mixedBy: string;
  transactionId: mongoose.Types.ObjectId;
  transactionNumber?: string;
  usageCount: number;
  lastUsed: Date;
  usageDates: Date[];
  averageReorderInterval: number;
  isFavorite: boolean;
  signatureHash?: string;
  isActive: boolean;
  createdBy: string;
  lastModifiedBy?: string;
  recordUsage(): Promise<void>;
  calculateSignature(): string;
}

interface ICustomBlendHistoryModel extends Model<ICustomBlendHistory> {
  getPopular(limit?: number, customerId?: string): Promise<ICustomBlendHistory[]>;
  getByCustomer(customerId: string, limit?: number): Promise<ICustomBlendHistory[]>;
  searchBlends(searchTerm: string, customerId?: string, limit?: number): Promise<ICustomBlendHistory[]>;
}

// Blend Ingredient History Schema
const BlendIngredientHistorySchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  unitOfMeasurementId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UnitOfMeasurement',
    required: true
  },
  unitName: {
    type: String,
    required: true
  },
  costPerUnit: {
    type: Number,
    min: 0
  },
  selectedContainers: [{
    containerId: String,
    containerCode: String,
    quantityToConsume: Number,
    batchNumber: String,
    expiryDate: Date
  }]
}, { _id: false });

// Custom Blend History Schema
const CustomBlendHistorySchema = new mongoose.Schema({
  blendName: {
    type: String,
    required: true,
    trim: true
  },
  
  // Customer Information
  customerId: {
    type: String,
    ref: 'Customer'
  },
  customerName: {
    type: String,
    required: true
  },
  customerEmail: String,
  customerPhone: String,
  
  // Blend Details
  ingredients: {
    type: [BlendIngredientHistorySchema],
    required: true,
    validate: {
      validator: function(ingredients: IBlendIngredient[]) {
        return ingredients && ingredients.length > 0;
      },
      message: 'At least one ingredient is required'
    }
  },
  
  // Pricing Information
  totalIngredientCost: {
    type: Number,
    required: true,
    min: 0
  },
  sellingPrice: {
    type: Number,
    required: true,
    min: 0
  },
  marginPercent: {
    type: Number,
    default: 100
  },
  
  // Container Information
  containerType: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ContainerType'
  },
  containerCapacity: {
    type: Number,
    min: 0
  },
  
  // Preparation Details
  preparationNotes: String,
  mixedBy: {
    type: String,
    required: true
  },
  
  // Reference Information
  transactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction',
    required: true
  },
  transactionNumber: String,
  
  // Usage Tracking
  usageCount: {
    type: Number,
    default: 1,
    min: 0
  },
  lastUsed: {
    type: Date,
    default: Date.now
  },
  usageDates: [{
    type: Date
  }],
  averageReorderInterval: {
    type: Number,
    default: 0 // days
  },
  isFavorite: {
    type: Boolean,
    default: false
  },
  signatureHash: {
    type: String,
    index: true
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  
  // System fields
  createdBy: {
    type: String,
    required: true
  },
  lastModifiedBy: String
}, {
  timestamps: true
});

// Indexes for better query performance
CustomBlendHistorySchema.index({ customerName: 1 });
CustomBlendHistorySchema.index({ customerId: 1 });
CustomBlendHistorySchema.index({ blendName: 1 });
CustomBlendHistorySchema.index({ createdAt: -1 });
CustomBlendHistorySchema.index({ usageCount: -1 });
CustomBlendHistorySchema.index({ lastUsed: -1 });
CustomBlendHistorySchema.index({ isActive: 1 });
CustomBlendHistorySchema.index({ signatureHash: 1, customerId: 1 });

// Pre-save middleware
CustomBlendHistorySchema.pre('save', function(next) {
  // Calculate signature hash if not already set
  if (!this.signatureHash && this.ingredients && this.ingredients.length > 0) {
    
    // Create a consistent string representation of ingredients
    const ingredientString = this.ingredients
      .map(ing => `${ing.productId}-${ing.quantity}-${ing.unitOfMeasurementId}`)
      .sort()
      .join('|');
      
    this.signatureHash = crypto.createHash('md5').update(ingredientString).digest('hex');
  }
  
  // Initialize usageDates array if not set
  if (!this.usageDates || this.usageDates.length === 0) {
    this.usageDates = [this.createdAt || new Date()];
  }
  
  next();
});

// Method to record usage
CustomBlendHistorySchema.methods.recordUsage = async function() {
  this.usageCount += 1;
  this.lastUsed = new Date();
  this.usageDates.push(new Date());
  
  // Calculate average reorder interval if we have enough data
  if (this.usageDates.length > 1) {
    const dates = this.usageDates.sort((a: Date, b: Date) => a.getTime() - b.getTime());
    let totalInterval = 0;
    
    for (let i = 1; i < dates.length; i++) {
      const interval = dates[i].getTime() - dates[i-1].getTime();
      totalInterval += interval;
    }
    
    const avgInterval = totalInterval / (dates.length - 1);
    this.averageReorderInterval = Math.round(avgInterval / (1000 * 60 * 60 * 24)); // Convert to days
  }
  
  await this.save();
};

// Method to calculate signature hash for blend ingredients
CustomBlendHistorySchema.methods.calculateSignature = function() {
  
  // Create a consistent string representation of ingredients
  const ingredientString = this.ingredients
    .map((ing: IBlendIngredient) => `${ing.productId}-${ing.quantity}-${ing.unitOfMeasurementId}`)
    .sort()
    .join('|');
    
  return crypto.createHash('md5').update(ingredientString).digest('hex');
};

// Static method to get popular blends
CustomBlendHistorySchema.statics.getPopular = function(limit = 10, customerId?: string) {
  const query: { isActive: boolean; customerId?: string } = { isActive: true };
  if (customerId) {
    query.customerId = customerId;
  }
  
  return this.find(query)
    .sort({ usageCount: -1, lastUsed: -1 })
    .limit(limit)
    .populate('ingredients.productId')
    .populate('ingredients.unitOfMeasurementId');
};

// Static method to get blends by customer
CustomBlendHistorySchema.statics.getByCustomer = function(customerId: string, limit = 20) {
  return this.find({ customerId, isActive: true })
    .sort({ lastUsed: -1, createdAt: -1 })
    .limit(limit)
    .populate('ingredients.productId')
    .populate('ingredients.unitOfMeasurementId');
};

// Static method to search blends
CustomBlendHistorySchema.statics.searchBlends = function(searchTerm: string, customerId?: string, limit = 20) {
  const query: {
    isActive: boolean;
    customerId?: string;
    $or: Array<Record<string, unknown>>;
  } = {
    isActive: true,
    $or: [
      { blendName: { $regex: searchTerm, $options: 'i' } },
      { customerName: { $regex: searchTerm, $options: 'i' } },
      { 'ingredients.name': { $regex: searchTerm, $options: 'i' } }
    ]
  };
  
  if (customerId) {
    query.customerId = customerId;
  }
  
  return this.find(query)
    .sort({ lastUsed: -1, createdAt: -1 })
    .limit(limit)
    .populate('ingredients.productId')
    .populate('ingredients.unitOfMeasurementId');
};

export const CustomBlendHistory = (mongoose.models.CustomBlendHistory || mongoose.model<ICustomBlendHistory, ICustomBlendHistoryModel>('CustomBlendHistory', CustomBlendHistorySchema)) as ICustomBlendHistoryModel; 