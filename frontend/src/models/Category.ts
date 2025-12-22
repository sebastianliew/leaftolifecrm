import mongoose from 'mongoose'

export interface ICategory extends mongoose.Document {
  _id: mongoose.Types.ObjectId
  name: string
  description?: string
  level: number
  parent?: mongoose.Types.ObjectId
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

const CategorySchema = new mongoose.Schema({
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
  level: {
    type: Number,
    default: 1,
    min: 1,
    max: 5
  },
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  collection: 'categories'
})

// Indexes
CategorySchema.index({ parent: 1, isActive: 1 })
CategorySchema.index({ level: 1, isActive: 1 })

// Ensure name uniqueness among active categories
CategorySchema.index(
  { name: 1, isActive: 1 },
  { 
    unique: true,
    partialFilterExpression: { isActive: true }
  }
)

export const Category = mongoose.models.Category || mongoose.model<ICategory>('Category', CategorySchema)