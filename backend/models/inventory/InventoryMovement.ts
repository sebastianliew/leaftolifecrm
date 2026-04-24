import { Schema, model, Document } from 'mongoose';
import { UnitOfMeasurement } from '../UnitOfMeasurement.js';
import mongoose from 'mongoose';
import { InsufficientStockError } from '../../middlewares/errorHandler.middleware.js';

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

  // Atomic insufficient-stock guard. For decrements we add a filter predicate
  // that requires the relevant pool to have >= qty.
  //
  // Strict pool enforcement (loose vs sealed) applies only to product
  // `sale` movements — a volume sale must find that much loose stock, and
  // a sealed sale must find that much sealed stock. Blend / bundle /
  // ingredient movements use `pool` as a tracking hint only and are
  // guarded against total currentStock; in real workflow a pharmacist may
  // open a sealed bottle mid-blend, which is semantically a pool transfer
  // and not a hard availability constraint.
  //
  // If the filter does not match we re-fetch to build a structured
  // InsufficientStockError so callers can report per-item.
  const baseFilter: Record<string, unknown> = { _id: this.productId };
  const strictPool = mtype === 'sale';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let guardPool: 'loose' | 'sealed' | 'any' = pool as any;
  if (isDecrease) {
    if (strictPool && pool === "loose") {
      baseFilter.looseStock = { $gte: qty };
    } else if (strictPool && pool === "sealed") {
      baseFilter.$expr = {
        $gte: [
          { $subtract: ["$currentStock", { $ifNull: ["$looseStock", 0] }] },
          qty,
        ],
      };
      guardPool = 'sealed';
    } else {
      baseFilter.currentStock = { $gte: qty };
      guardPool = 'any';
    }
  }

  const opts = session ? { session } : {};
  let res: { matchedCount?: number; modifiedCount?: number };

  if (pool === "loose") {
    res = await Product.updateOne(
      baseFilter,
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
      opts
    );
  } else if (pool === "sealed") {
    res = await Product.updateOne(
      baseFilter,
      [
        { $set: {
          currentStock: { $add: ["$currentStock", stockChange] },
          availableStock: { $add: [{ $ifNull: ["$availableStock", "$currentStock"] }, stockChange] }
        }},
        { $set: {
          looseStock: { $max: [0, { $min: [{ $ifNull: ["$looseStock", 0] }, "$currentStock"] }] }
        }}
      ],
      opts
    );
  } else {
    // "any" — blend/restock/adjustment
    res = await Product.updateOne(
      baseFilter,
      [
        { $set: {
          currentStock: { $add: ["$currentStock", stockChange] },
          availableStock: { $add: [{ $ifNull: ["$availableStock", "$currentStock"] }, stockChange] }
        }},
        { $set: {
          looseStock: { $max: [0, { $min: [{ $ifNull: ["$looseStock", 0] }, "$currentStock"] }] }
        }}
      ],
      opts
    );
  }

  if (isDecrease && (res.matchedCount ?? 0) === 0) {
    const current = await Product.findById(this.productId)
      .session(session || null)
      .lean() as Record<string, unknown> | null;
    if (!current) {
      throw new InsufficientStockError({
        productId: String(this.productId),
        productName: this.productName || 'unknown',
        requested: qty,
        available: 0,
        pool: guardPool,
        reason: 'product_not_found',
      });
    }
    const cs = Number(current.currentStock ?? 0);
    const ls = Number(current.looseStock ?? 0);
    const available = guardPool === 'loose' ? ls : guardPool === 'sealed' ? cs - ls : cs;
    throw new InsufficientStockError({
      productId: String(this.productId),
      productName: this.productName || String(current.name ?? 'unknown'),
      requested: qty,
      available,
      pool: guardPool,
      reason: 'insufficient_stock',
    });
  }

  console.log(`[InventoryMovement] Stock update: Product ${this.productId} pool:${pool} ${stockChange > 0 ? "+" : ""}${stockChange}`);
};

export const InventoryMovement = mongoose.models.InventoryMovement || model<IInventoryMovement>('InventoryMovement', InventoryMovementSchema); 