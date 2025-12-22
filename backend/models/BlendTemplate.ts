import mongoose from 'mongoose';

// Interface for blend ingredient
interface IBlendIngredient {
  productId: mongoose.Types.ObjectId;
  name: string;
  quantity: number;
  unitOfMeasurementId: mongoose.Types.ObjectId;
  unitName: string;
  costPerUnit?: number;
  notes?: string;
}

// Interface for virtual properties
interface IBlendTemplateVirtuals {
  totalCost: number;
  costPerUnit: number;
  profit: number;
  profitMargin: number;
}

// Interface for the BlendTemplate document
interface IBlendTemplateDocument extends mongoose.Document, IBlendTemplateVirtuals {
  name: string;
  batchSize: number;
  createdBy: string;
  isActive: boolean;
  ingredients: IBlendIngredient[];
  usageCount: number;
  lastUsed?: Date;
  sellingPrice: number;
}

// Blend Ingredient Schema
const BlendIngredientSchema = new mongoose.Schema({
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
  notes: String
}, { _id: false });

// Blend Template Schema
const BlendTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    trim: true
  },
  
  // Recipe/Formula
  ingredients: {
    type: [BlendIngredientSchema],
    required: true,
    validate: {
      validator: function(ingredients: IBlendIngredient[]) {
        return ingredients && ingredients.length > 0;
      },
      message: 'At least one ingredient is required'
    }
  },
  
  // Batch information - made optional for recipe-only templates
  batchSize: {
    type: Number,
    default: 1,
    min: 1
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
  
  // Pricing
  sellingPrice: {
    type: Number,
    min: 0,
    default: 0
  },
  
  // Metadata
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: String,
    required: true
  },
  lastUsed: {
    type: Date
  },
  usageCount: {
    type: Number,
    default: 0,
    min: 0
  },

  // Soft delete fields
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: Date,
  deletedBy: String,
  deleteReason: String
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
BlendTemplateSchema.index({ name: 1 });
BlendTemplateSchema.index({ category: 1 });
BlendTemplateSchema.index({ isActive: 1 });
BlendTemplateSchema.index({ createdBy: 1 });
BlendTemplateSchema.index({ usageCount: -1 });
BlendTemplateSchema.index({ lastUsed: -1 });

// Soft delete indexes
BlendTemplateSchema.index({ isDeleted: 1 });
BlendTemplateSchema.index({ deletedAt: 1 });
BlendTemplateSchema.index({ isDeleted: 1, isActive: 1 });

// Virtual for calculating total cost
BlendTemplateSchema.virtual('totalCost').get(function() {
  if (!this.ingredients) return 0;
  return this.ingredients.reduce((total: number, ingredient) => {
    return total + (ingredient.quantity * (ingredient.costPerUnit || 0));
  }, 0);
});

// Virtual for calculating cost per unit
BlendTemplateSchema.virtual('costPerUnit').get(function(this: IBlendTemplateDocument) {
  const total = this.get('totalCost') || 0;
  const batchSize = this.batchSize || 1;
  return batchSize > 0 ? total / batchSize : 0;
});

// Virtual for calculating profit
BlendTemplateSchema.virtual('profit').get(function(this: IBlendTemplateDocument) {
  const totalCost = this.get('totalCost') || 0;
  const sellingPrice = this.sellingPrice || 0;
  return sellingPrice - totalCost;
});

// Virtual for calculating profit margin percentage
BlendTemplateSchema.virtual('profitMargin').get(function(this: IBlendTemplateDocument) {
  const sellingPrice = this.sellingPrice || 0;
  if (sellingPrice === 0) return 0;
  
  const profit = this.get('profit') || 0;
  return (profit / sellingPrice) * 100;
});

// Method to record usage
BlendTemplateSchema.methods.recordUsage = async function() {
  this.usageCount += 1;
  this.lastUsed = new Date();
  await this.save();
};


// Method to calculate blend in different unit
BlendTemplateSchema.methods.calculateInUnit = async function(targetUnit: string) {
  const UnitConversionService = (await import('../lib/unit-conversion')).default;
  const ingredients = [];
  
  for (const ingredient of this.ingredients) {
    try {
      const converted = UnitConversionService.convert(
        ingredient.quantity,
        ingredient.unitName,
        targetUnit
      );
      ingredients.push({
        ...ingredient.toObject(),
        convertedQuantity: converted.value,
        convertedUnit: targetUnit,
        originalQuantity: ingredient.quantity,
        originalUnit: ingredient.unitName
      });
    } catch (error) {
      throw new Error(`Cannot convert ingredient ${ingredient.name} from ${ingredient.unitName} to ${targetUnit}`);
    }
  }
  
  const totalQuantity = ingredients.reduce((sum, ing) => sum + ing.convertedQuantity, 0);
  
  return {
    ingredients,
    totalQuantity,
    unit: targetUnit,
    originalUnit: this.unitName,
    scalingFactor: 1
  };
};

// Method to scale recipe for different batch size
BlendTemplateSchema.methods.scaleRecipe = async function(targetQuantity: number, targetUnit?: string) {
  const UnitConversionService = (await import('../lib/unit-conversion')).default;
  
  // Convert batch size to target unit if needed
  let batchSizeInTargetUnit = this.batchSize;
  if (targetUnit && targetUnit !== this.unitName) {
    try {
      const converted = UnitConversionService.convert(this.batchSize, this.unitName, targetUnit);
      batchSizeInTargetUnit = converted.value;
    } catch (error) {
      throw new Error(`Cannot convert batch size from ${this.unitName} to ${targetUnit}`);
    }
  }
  
  const scalingFactor = targetQuantity / batchSizeInTargetUnit;
  const scaledIngredients = [];
  
  for (const ingredient of this.ingredients) {
    const scaledQuantity = ingredient.quantity * scalingFactor;
    let finalUnit = ingredient.unitName;
    let finalQuantity = scaledQuantity;
    
    // Convert to target unit if specified and different
    if (targetUnit && UnitConversionService.canConvert(ingredient.unitName, targetUnit)) {
      try {
        const converted = UnitConversionService.convert(scaledQuantity, ingredient.unitName, targetUnit);
        finalQuantity = converted.value;
        finalUnit = targetUnit;
      } catch (error) {
        // Keep original unit if conversion fails
      }
    }
    
    scaledIngredients.push({
      ...ingredient.toObject(),
      quantity: finalQuantity,
      unitName: finalUnit,
      originalQuantity: ingredient.quantity,
      originalUnit: ingredient.unitName,
      scalingFactor
    });
  }
  
  return {
    ...this.toObject(),
    ingredients: scaledIngredients,
    batchSize: targetQuantity,
    unitName: targetUnit || this.unitName,
    scalingFactor,
    originalBatchSize: this.batchSize,
    originalUnit: this.unitName
  };
};

// Static method to get popular templates
BlendTemplateSchema.statics.getPopular = function(limit = 10) {
  return this.find({ isActive: true })
    .sort({ usageCount: -1, lastUsed: -1 })
    .limit(limit)
    .populate('ingredients.productId')
    .populate('ingredients.unitOfMeasurementId')
    .populate('unitOfMeasurementId');
};

// Static method to get templates by category
BlendTemplateSchema.statics.getByCategory = function(category: string) {
  return this.find({ category, isActive: true })
    .sort({ name: 1 })
    .populate('ingredients.productId')
    .populate('ingredients.unitOfMeasurementId')
    .populate('unitOfMeasurementId');
};


// Force model recreation in development to pick up schema changes
if (process.env.NODE_ENV === 'development') {
  delete mongoose.models.BlendTemplate;
  // Use type assertion to allow deletion in development
  delete (mongoose.connection.models as Record<string, mongoose.Model<unknown>>).BlendTemplate;
}

export const BlendTemplate = mongoose.models.BlendTemplate || mongoose.model('BlendTemplate', BlendTemplateSchema);

// Log schema paths in development to verify sellingPrice is included
if (process.env.NODE_ENV === 'development' && BlendTemplate.schema) {
  const paths = Object.keys(BlendTemplate.schema.paths);
  if (!paths.includes('sellingPrice')) {
    console.warn('WARNING: sellingPrice field not found in BlendTemplate schema paths!');
  }
} 