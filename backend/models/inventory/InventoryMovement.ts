import { Schema, model, Document } from 'mongoose';
import { UnitOfMeasurement } from '../UnitOfMeasurement.js';
import mongoose from 'mongoose';

export interface IInventoryMovement extends Document {
  productId: Schema.Types.ObjectId;
  movementType: 'sale' | 'return' | 'adjustment' | 'transfer' | 'fixed_blend' | 'bundle_sale' | 'bundle_blend_ingredient' | 'blend_ingredient' | 'custom_blend';
  quantity: number;
  unitOfMeasurementId: Schema.Types.ObjectId;
  baseUnit: string;
  convertedQuantity: number;
  reference: string; // Transaction ID or other reference
  notes?: string;
  createdAt: Date;
  createdBy: string;
  // Additional fields used by services
  productName?: string;
  referenceId?: Schema.Types.ObjectId;
  referenceType?: string;
  reason?: string;
  // Container tracking
  containerStatus?: 'full' | 'partial' | 'empty';
  containerId?: string;
  remainingQuantity?: number;
  updateProductStock(): Promise<void>;
}

const InventoryMovementSchema = new Schema<IInventoryMovement>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    movementType: {
      type: String,
      required: true,
      enum: ['sale', 'return', 'adjustment', 'transfer', 'fixed_blend', 'bundle_sale', 'bundle_blend_ingredient', 'blend_ingredient', 'custom_blend'],
    },
    quantity: {
      type: Number,
      required: true,
    },
    unitOfMeasurementId: {
      type: Schema.Types.ObjectId,
      ref: 'UnitOfMeasurement',
      required: true,
    },
    baseUnit: {
      type: String,
      required: true,
    },
    convertedQuantity: {
      type: Number,
      required: true,
    },
    reference: {
      type: String,
      required: true,
    },
    notes: String,
    createdBy: {
      type: String,
      required: true,
    },
    // Additional fields used by services
    productName: String,
    referenceId: {
      type: Schema.Types.ObjectId,
      ref: 'Transaction',
    },
    referenceType: String,
    reason: String,
    // Container tracking
    containerStatus: {
      type: String,
      enum: ['full', 'partial', 'empty'],
    },
    containerId: String,
    remainingQuantity: Number,
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
InventoryMovementSchema.index({ productId: 1 });
InventoryMovementSchema.index({ movementType: 1 });
InventoryMovementSchema.index({ createdAt: 1 });
InventoryMovementSchema.index({ reference: 1 });

// Pre-save middleware to ensure convertedQuantity is set
InventoryMovementSchema.pre('save', async function(next) {
  if (!this.convertedQuantity) {
    const unitOfMeasurement = await UnitOfMeasurement.findById(this.unitOfMeasurementId);
    if (unitOfMeasurement?.conversionRate) {
      this.convertedQuantity = this.quantity * unitOfMeasurement.conversionRate;
    } else {
      this.convertedQuantity = this.quantity;
    }
  }
  next();
});

// Method to update product stock
InventoryMovementSchema.methods.updateProductStock = async function() {
  const Product = model('Product');
  const product = await Product.findById(this.productId);
  
  if (!product) {
    throw new Error('Product not found');
  }

  if (this.containerStatus) {
    // Handle container-based movement
    if (this.movementType === 'sale') {
      if (this.containerStatus === 'partial') {
        await product.handlePartialContainerSale(this.quantity);
      } else if (this.containerStatus === 'full') {
        await product.handleFullContainerSale();
      }
    } else if (this.movementType === 'return') {
      // Handle container returns
      if (this.containerStatus === 'partial') {
        product.containers.partial.push({
          id: this.containerId || `CONTAINER_${Date.now()}`,
          remaining: this.remainingQuantity || 0,
          capacity: product.containerCapacity,
          status: 'partial'
        });
      } else if (this.containerStatus === 'full') {
        product.containers.full++;
      }
      product.currentStock = product.totalStock;
      await product.save();
    }
  } else {
    // Handle non-container movement
    let stockChange = 0;
    switch (this.movementType) {
      case 'sale':
        stockChange = -this.convertedQuantity;
        break;
      case 'return':
        stockChange = this.convertedQuantity;
        break;
      case 'adjustment':
        stockChange = this.convertedQuantity;
        break;
      case 'transfer':
        // Handle transfer logic if needed
        break;
    }

    product.currentStock += stockChange;
    product.availableStock += stockChange;
    await product.save();
  }
};

export const InventoryMovement = mongoose.models.InventoryMovement || model<IInventoryMovement>('InventoryMovement', InventoryMovementSchema); 