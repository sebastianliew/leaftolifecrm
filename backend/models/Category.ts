import mongoose, { Schema, Document } from 'mongoose';

export interface ICategory extends Document {
  name: string;
  level: number;
  parent?: Schema.Types.ObjectId;
  description?: string;
  status: 'active' | 'inactive';
  isActive?: boolean;
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
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Add indexes
CategorySchema.index({ name: 1 });
CategorySchema.index({ level: 1 });
CategorySchema.index({ parent: 1 });

export const Category = mongoose.models.Category || mongoose.model('Category', CategorySchema); 