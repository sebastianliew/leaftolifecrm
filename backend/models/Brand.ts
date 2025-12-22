import mongoose, { Schema, Document } from 'mongoose';
import type { BrandStatus } from '../types/brands/brand.types.js';

// Define sub-schemas
const BrandCategorySchema = new Schema({
  id: String,
  name: String,
  description: String
}, { _id: false });

const QualityStandardSchema = new Schema({
  id: String,
  name: String,
  description: String,
  compliance: Boolean
}, { _id: false });

// Interface for Brand document
export interface IBrand extends Document {
  name: string;
  code?: string;
  description?: string;
  website?: string;
  contactEmail?: string;
  contactPhone?: string;
  categories?: Array<{
    id?: string;
    name?: string;
    description?: string;
  }>;
  qualityStandards?: Array<{
    id?: string;
    name?: string;
    description?: string;
    compliance?: boolean;
  }>;
  status: BrandStatus;
  isActive: boolean;
  isExclusive: boolean;
  createdBy?: string;
  lastModifiedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Define main schema
const BrandSchema = new Schema<IBrand>({
  name: {
    type: String,
    required: [true, 'Brand name is required'],
    trim: true
  },
  code: {
    type: String,
    unique: true,
    sparse: true // This allows multiple documents with undefined/null code during creation
  },
  description: {
    type: String,
    default: ''
  },
  
  // Business Information
  website: {
    type: String,
    default: ''
  },
  contactEmail: {
    type: String,
    default: ''
  },
  contactPhone: {
    type: String,
    default: ''
  },
  
  // Categories and Classifications
  categories: {
    type: [BrandCategorySchema],
    default: []
  },
  
  // Quality and Certifications
  qualityStandards: {
    type: [QualityStandardSchema],
    default: []
  },
  
  // Status
  status: {
    type: String,
    enum: ['active', 'inactive', 'discontinued', 'pending_approval'],
    default: 'active'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isExclusive: {
    type: Boolean,
    default: false
  },
  
  // System fields
  createdBy: {
    type: String,
    default: ''
  },
  lastModifiedBy: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Auto-generate brand code before saving
BrandSchema.pre('save', async function(this: IBrand, next) {
  console.log('Pre-save middleware executing for brand:', this.name);
  
  if (this.isNew && !this.code) {
    try {
      console.log('Generating code for new brand...');
      
      const BrandModel = mongoose.model<IBrand>('Brand');
      const count = await BrandModel.countDocuments({});
      
      // Generate code with format BRD00001, BRD00002, etc.
      this.code = `BRD${String(count + 1).padStart(5, '0')}`;
      console.log('Generated brand code:', this.code);
      
    } catch (error) {
      console.error('Error generating brand code:', error);
      return next(new Error('Failed to generate brand code'));
    }
  }
  
  next();
});

// Add index for better performance
BrandSchema.index({ name: 1 });
BrandSchema.index({ status: 1 });
BrandSchema.index({ isActive: 1 });

// Check if the model already exists before compiling
export const Brand = mongoose.models.Brand || mongoose.model<IBrand>('Brand', BrandSchema);