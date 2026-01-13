import { IInventoryMovement } from '../models/inventory/InventoryMovement.js';

export interface InventoryDeductionResult {
  success: boolean;
  movements: IInventoryMovement[];
  errors: string[];
  warnings: string[];
}

export interface InventoryReversalResult {
  success: boolean;
  reversedMovements: IInventoryMovement[];
  errors: string[];
  warnings: string[];
  originalMovementCount: number;
  reversedCount: number;
}

export interface TransactionItem {
  productId: string;
  name: string;
  quantity: number;
  unitOfMeasurementId: string;
  baseUnit: string;
  convertedQuantity: number;
  itemType?: 'product' | 'fixed_blend' | 'custom_blend' | 'bundle' | 'miscellaneous' | 'consultation' | 'service';
  // Sale type for partial bottle tracking
  saleType?: 'quantity' | 'volume';
  // Container/bottle ID for targeted partial sales
  containerId?: string;
  customBlendData?: {
    name: string;
    ingredients: Array<{
      productId: string;
      name: string;
      quantity: number;
      unitOfMeasurementId: string;
      unitName: string;
      costPerUnit: number;
    }>;
    totalIngredientCost: number;
    preparationNotes?: string;
    mixedBy: string;
    mixedAt: Date;
  };
}
