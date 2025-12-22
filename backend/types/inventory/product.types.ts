import { Schema, Document } from 'mongoose';

export interface IProduct extends Document {
  name: string;
  description?: string;
  category: Schema.Types.ObjectId;
  sku: string;
  brand?: Schema.Types.ObjectId;
  containerType?: Schema.Types.ObjectId;
  unitOfMeasurement: Schema.Types.ObjectId;
  quantity: number;
  reorderPoint: number;
  currentStock: number;
  totalQuantity: number;
  availableStock: number;
  reservedStock: number;
  costPrice?: number;
  sellingPrice?: number;
  status: 'active' | 'inactive' | 'discontinued' | 'pending_approval';
  isActive: boolean;
  expiryDate?: Date;
  autoReorderEnabled: boolean;
  lastRestockDate?: Date;
  restockFrequency: number;
  averageRestockQuantity: number;
  restockCount: number;
  containerCapacity: number;
  containers: {
    full: number;
    empty: number;
    partial: Array<{
      id: string;
      remaining: number;
      capacity: number;
      status: 'full' | 'partial' | 'empty';
      lastMovement?: Schema.Types.ObjectId;
    }>;
  };
  supplierId?: Schema.Types.ObjectId;
  isDeleted?: boolean;
  deletedAt?: Date;
  deletedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}