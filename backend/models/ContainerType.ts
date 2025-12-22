import mongoose from 'mongoose';

// Remove existing compiled model to apply schema changes
if (mongoose.models.ContainerType) {
  delete mongoose.models.ContainerType;
}

const containerTypeSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    trim: true
  },
  description: { 
    type: String,
    trim: true
  },
  allowedUoms: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'UnitOfMeasurement',
    required: true 
  }],
  isActive: { 
    type: Boolean, 
    default: true 
  }
}, {
  timestamps: true
});

// Add indexes for better query performance
containerTypeSchema.index({ name: 1 });
containerTypeSchema.index({ isActive: 1 });

export const ContainerType = mongoose.models.ContainerType || mongoose.model('ContainerType', containerTypeSchema);