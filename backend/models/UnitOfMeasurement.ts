import mongoose, { Document } from 'mongoose';

export interface IUnitOfMeasurement extends Document {
  name: string;
  abbreviation: string;
  type: 'weight' | 'volume' | 'count' | 'length' | 'area' | 'temperature' | 'other';
  description?: string;
  isActive: boolean;
  baseUnit?: string;
  conversionRate?: number;
  createdAt: Date;
  updatedAt: Date;
}

const unitOfMeasurementSchema = new mongoose.Schema<IUnitOfMeasurement>({
  name: { type: String, required: true },
  abbreviation: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['weight', 'volume', 'count', 'length', 'area', 'temperature', 'other'],
    required: true 
  },
  description: String,
  isActive: { type: Boolean, default: true }
}, {
  timestamps: true
});

// Add indexes
unitOfMeasurementSchema.index({ name: 1 });
unitOfMeasurementSchema.index({ abbreviation: 1 });
unitOfMeasurementSchema.index({ type: 1 });

export const UnitOfMeasurement = mongoose.models.UnitOfMeasurement || mongoose.model('UnitOfMeasurement', unitOfMeasurementSchema); 