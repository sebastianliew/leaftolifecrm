import mongoose from 'mongoose'

export type UomType = 'weight' | 'volume' | 'count' | 'length' | 'area' | 'temperature';

export interface IContainerType extends mongoose.Document {
  _id: mongoose.Types.ObjectId
  name: string
  description?: string
  allowedUomTypes: UomType[]
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

const ContainerTypeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  allowedUomTypes: {
    type: [String],
    enum: ['weight', 'volume', 'count', 'length', 'area', 'temperature'],
    validate: {
      validator: (v: string[]) => v.length > 0,
      message: 'At least one allowed unit of measurement type is required'
    }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  collection: 'containertypes'
})

ContainerTypeSchema.index(
  { name: 1, isActive: 1 },
  { unique: true, partialFilterExpression: { isActive: true } }
)

export const ContainerType = mongoose.models.ContainerType || mongoose.model<IContainerType>('ContainerType', ContainerTypeSchema)
