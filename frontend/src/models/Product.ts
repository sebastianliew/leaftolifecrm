import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  sku: { type: String, unique: true, required: true },
  description: String,
  category: { type: String, required: true },
  brand: String,
  supplier: String,
  currentStock: { type: Number, default: 0 },
  reorderPoint: { type: Number, default: 10 },
  costPrice: { type: Number, required: true },
  sellingPrice: { type: Number, required: true },
  unit: { type: String, default: 'pieces' },
  expiryDate: Date,
  batchNumber: String,
  location: String,
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

productSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export const Product = mongoose.models.Product || mongoose.model('Product', productSchema);