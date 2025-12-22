import mongoose from 'mongoose';

const supplierCategorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: String,
  isActive: { type: Boolean, default: true },
  createdBy: String,
  lastModifiedBy: String
}, {
  timestamps: true
});

// Index for name field is already created by unique: true option

export const SupplierCategory = mongoose.models.SupplierCategory || mongoose.model('SupplierCategory', supplierCategorySchema); 