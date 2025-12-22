export interface InventoryMovement {
  id: string;
  productId: string;
  type: 'in' | 'out' | 'adjustment';
  quantity: number;
  reason: string;
  notes?: string;
  createdAt: string | Date;
}

export interface StockAlert {
  id: string;
  productId: string;
  alertType: 'low_stock' | 'out_of_stock' | 'expired' | 'expiring_soon';
  currentLevel: number;
  threshold: number;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  isActive: boolean;
  createdAt: string;
}

export interface StockAdditionData {
  productId: string;
  quantity: number;
  batchNumber?: string;
  notes?: string;
}

export interface StockMovement {
  productId: string;
  quantity: number;
  type: 'addition' | 'removal';
  reason: string;
  userId?: string;
  timestamp: Date;
  batchNumber?: string;
  notes?: string;
}