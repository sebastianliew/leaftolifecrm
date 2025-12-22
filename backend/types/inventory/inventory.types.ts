import { Schema, Document } from 'mongoose';

export interface IInventoryMovement extends Document {
  productId: Schema.Types.ObjectId;
  movementType: 'sale' | 'return' | 'adjustment' | 'transfer' | 'fixed_blend' | 'bundle_sale' | 'bundle_blend_ingredient' | 'blend_ingredient' | 'custom_blend';
  quantity: number;
  unitOfMeasurementId: Schema.Types.ObjectId;
  baseUnit: string;
  convertedQuantity: number;
  reference: string;
  notes?: string;
  createdAt: Date;
  createdBy: string;
  productName?: string;
  referenceId?: Schema.Types.ObjectId;
  referenceType?: string;
  reason?: string;
  containerStatus?: 'full' | 'partial' | 'empty';
  containerId?: string;
  remainingQuantity?: number;
  updateProductStock(): Promise<void>;
}