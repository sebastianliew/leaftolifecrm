import mongoose, { Schema, Document } from 'mongoose';

export type UomType = 'weight' | 'volume' | 'count' | 'length' | 'area' | 'temperature';

export interface ICategory extends Document {
  name: string;
  level: number;
  parent?: Schema.Types.ObjectId;
  description?: string;
  isActive: boolean;
  allowedUomTypes?: UomType[];
  defaultUom?: Schema.Types.ObjectId;
  defaultCanSellLoose?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<ICategory>({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: [200, 'Category name cannot exceed 200 characters']
  },
  level: { type: Number, required: true, default: 1, min: [1, 'Level must be at least 1'] },
  parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  description: String,
  isActive: {
    type: Boolean,
    default: true
  },
  allowedUomTypes: {
    type: [String],
    enum: ['weight', 'volume', 'count', 'length', 'area', 'temperature'],
    default: []
  },
  // Pre-populate UOM when a new product is created under this category so
  // staff don't have to re-pick a unit for every product (issue #20).
  defaultUom: { type: mongoose.Schema.Types.ObjectId, ref: 'UnitOfMeasurement' },
  // Pre-check "sell loose" when a new product under this category supports
  // loose sales (tablets/capsules/liquids) — issue #21.
  defaultCanSellLoose: { type: Boolean, default: false }
}, {
  timestamps: true
});

// Case-insensitive unique name (prevents duplicate-key race past the controller check)
CategorySchema.index(
  { name: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } }
);
CategorySchema.index({ level: 1 });
CategorySchema.index({ parent: 1 });

export const Category = mongoose.models.Category || mongoose.model('Category', CategorySchema); 