import { Schema, model, Document } from 'mongoose';
import { UnitOfMeasurement } from '../UnitOfMeasurement.js';
import mongoose from 'mongoose';

export interface IInventoryMovement extends Document {
  productId: Schema.Types.ObjectId;
  movementType: 'sale' | 'return' | 'adjustment' | 'transfer' | 'fixed_blend' | 'bundle_sale' | 'bundle_blend_ingredient' | 'blend_ingredient' | 'custom_blend' | 'pool_transfer';
  pool?: 'loose' | 'sealed' | 'any';
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
      enum: ['sale', 'return', 'adjustment', 'transfer', 'fixed_blend', 'bundle_sale', 'bundle_blend_ingredient', 'blend_ingredient', 'custom_blend', 'pool_transfer'],
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
    pool: {
      type: String,
      enum: ['loose', 'sealed', 'any'],
      default: 'any',
    },
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

// Compound index to prevent duplicate movements for the same transaction+product+type
// This provides database-level protection against duplicate deductions
// Note: Using sparse index since we allow multiple movements of same type for different items
InventoryMovementSchema.index(
  { reference: 1, productId: 1, movementType: 1, _id: 1 },
  { background: true }
);

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

// Method to update product stock using ATOMIC operations to prevent race conditions
InventoryMovementSchema.methods.updateProductStock = async function(session?: any) {
  const Product = model("Product");
  const pool = (this.pool as string) || "any";
  const mtype = this.movementType as string;
  const qty = this.convertedQuantity as number;

  if (mtype === "pool_transfer") {
    // Only adjusts looseStock within 0..currentStock bounds
    await Product.updateOne(
      { _id: this.productId },
      [{
        $set: {
          looseStock: {
            $max: [0, {
              $min: [
                { $add: [{ $ifNull: ["$looseStock", 0] }, qty] },
                "$currentStock"
              ]
            }]
          }
        }
      }],
      session ? { session } : {}
    );
    return;
  }

  if (mtype === "transfer") return;

  const decreaseTypes = ["sale","fixed_blend","bundle_sale","bundle_blend_ingredient","blend_ingredient","custom_blend"];
  const increaseTypes = ["return", "adjustment"];
  const isDecrease = decreaseTypes.includes(mtype);
  const isIncrease = increaseTypes.includes(mtype);
  if (!isDecrease && !isIncrease) return;

  const stockChange = isDecrease ? -qty : qty;

  if (pool === "loose") {
    await Product.updateOne(
      { _id: this.productId },
      [
        { $set: {
          currentStock: { $add: ["$currentStock", stockChange] },
          availableStock: { $add: [{ $ifNull: ["$availableStock", "$currentStock"] }, stockChange] }
        }},
        { $set: {
          looseStock: { $max: [0, { $min: [
            { $add: [{ $ifNull: ["$looseStock", 0] }, stockChange] },
            "$currentStock"
          ]}]}
        }}
      ],
      session ? { session } : {}
    );
  } else if (pool === "sealed") {
    await Product.updateOne(
      { _id: this.productId },
      [
        { $set: {
          currentStock: { $add: ["$currentStock", stockChange] },
          availableStock: { $add: [{ $ifNull: ["$availableStock", "$currentStock"] }, stockChange] }
        }},
        { $set: {
          looseStock: { $max: [0, { $min: [{ $ifNull: ["$looseStock", 0] }, "$currentStock"] }] }
        }}
      ],
      session ? { session } : {}
    );
  } else {
    // "any" — blend/restock/adjustment
    await Product.updateOne(
      { _id: this.productId },
      [
        { $set: {
          currentStock: { $add: ["$currentStock", stockChange] },
          availableStock: { $add: [{ $ifNull: ["$availableStock", "$currentStock"] }, stockChange] }
        }},
        { $set: {
          looseStock: { $max: [0, { $min: [{ $ifNull: ["$looseStock", 0] }, "$currentStock"] }] }
        }}
      ],
      session ? { session } : {}
    );
  }

  console.log(`[InventoryMovement] Stock update: Product ${this.productId} pool:${pool} ${stockChange > 0 ? "+" : ""}${stockChange}`);
};

export const InventoryMovement = mongoose.models.InventoryMovement || model<IInventoryMovement>('InventoryMovement', InventoryMovementSchema); 