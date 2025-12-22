import mongoose from 'mongoose';

const supplierSchema = new mongoose.Schema({
  // Basic Information
  name: { 
    type: String, 
    required: true,
    trim: true,
    unique: true
  },
  code: { 
    type: String, 
    unique: true,
    sparse: true 
  },
  description: { 
    type: String, 
    trim: true 
  },
  
  // Contact Information
  email: { 
    type: String,
    lowercase: true,
    trim: true,
    validate: {
      validator: function(v: string) {
        return !v || /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(v);
      },
      message: 'Please enter a valid email address'
    }
  },
  phone: { 
    type: String,
    trim: true 
  },
  fax: { 
    type: String,
    trim: true 
  },
  website: { 
    type: String,
    trim: true 
  },
  contactPerson: { 
    type: String,
    trim: true 
  },
  
  // Address Information
  address: { 
    type: String,
    trim: true 
  },
  city: { 
    type: String,
    trim: true 
  },
  state: { 
    type: String,
    trim: true 
  },
  postalCode: { 
    type: String,
    trim: true 
  },
  country: { 
    type: String,
    default: 'SG',
    trim: true 
  },
  
  // Business Information
  businessType: {
    type: String,
    enum: ['manufacturer', 'distributor', 'wholesaler', 'retailer', 'service_provider'],
    default: 'distributor'
  },
  taxId: { 
    type: String,
    trim: true 
  },
  businessRegistrationNumber: { 
    type: String,
    trim: true 
  },
  
  // Terms and Conditions
  paymentTerms: {
    type: String,
    enum: ['immediate', 'net_15', 'net_30', 'net_60', 'net_90'],
    default: 'net_30'
  },
  creditLimit: { 
    type: Number,
    default: 0,
    min: 0 
  },
  minimumOrderValue: { 
    type: Number,
    default: 0,
    min: 0 
  },
  currency: { 
    type: String,
    default: 'SGD' 
  },
  
  // Categories and Products
  categories: [{
    categoryId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Category' 
    },
    categoryName: String
  }],
  productCount: { 
    type: Number,
    default: 0,
    min: 0 
  },
  
  // Quality and Certifications
  qualityStandards: [{
    name: String,
    certificateNumber: String,
    issuedDate: Date,
    expiryDate: Date,
    documentPath: String
  }],
  
  // Performance Metrics
  rating: { 
    type: Number,
    min: 0,
    max: 5,
    default: 0 
  },
  totalOrders: { 
    type: Number,
    default: 0,
    min: 0 
  },
  totalSpent: { 
    type: Number,
    default: 0,
    min: 0 
  },
  averageDeliveryTime: { 
    type: Number,
    default: 0,
    min: 0 
  }, // in days
  lastOrderDate: { type: Date },
  
  // Status and Flags
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'pending_approval', 'blacklisted'],
    default: 'active'
  },
  isActive: { 
    type: Boolean,
    default: true 
  },
  isPreferred: { 
    type: Boolean,
    default: false 
  },
  requiresApproval: { 
    type: Boolean,
    default: false 
  },
  
  // Notes
  notes: { type: String },
  internalNotes: { type: String },
  
  // System Fields
  createdBy: { 
    type: String,
    required: true 
  },
  lastModifiedBy: { type: String },
  tags: [{ 
    type: String,
    trim: true 
  }],
  
  // Migration support fields
  legacyId: { 
    type: String,
    index: true 
  },
  migrationData: {
    source: { type: String },
    importedAt: { type: Date },
    originalData: {
      type: Map,
      of: mongoose.Schema.Types.Mixed
    }
  }
  
}, {
  timestamps: true
});

// Indexes for better query performance
supplierSchema.index({ status: 1 });
supplierSchema.index({ isActive: 1 });
supplierSchema.index({ isPreferred: 1 });
supplierSchema.index({ businessType: 1 });
supplierSchema.index({ createdAt: 1 });
supplierSchema.index({ lastOrderDate: 1 });
// Migration indexes
supplierSchema.index({ legacyId: 1, 'migrationData.source': 1 });
supplierSchema.index({ 'migrationData.importedAt': 1 });

// Pre-save middleware to generate supplier code
supplierSchema.pre('save', async function(next) {
  if (!this.code) {
    // Generate code from name (first 3 letters) + sequential number
    const prefix = this.name.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, '') || 'SUP';
    const count = await (this.constructor as mongoose.Model<unknown>).countDocuments({ code: { $regex: `^${prefix}` } });
    this.code = `${prefix}${(count + 1).toString().padStart(4, '0')}`;
  }
  next();
});

// Method to update performance metrics
supplierSchema.methods.updateMetrics = async function(orderValue: number, deliveryDays: number) {
  this.totalOrders += 1;
  this.totalSpent += orderValue;
  this.lastOrderDate = new Date();
  
  // Update average delivery time
  if (this.averageDeliveryTime === 0) {
    this.averageDeliveryTime = deliveryDays;
  } else {
    this.averageDeliveryTime = ((this.averageDeliveryTime * (this.totalOrders - 1)) + deliveryDays) / this.totalOrders;
  }
  
  await this.save();
};

export const Supplier = mongoose.models.Supplier || mongoose.model('Supplier', supplierSchema);