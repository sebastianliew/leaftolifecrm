export class RestockValidator {
  static validateRestockOperation(data: {
    productId: string;
    quantity: number;
    reference?: string;
    notes?: string;
    unitCost?: number;
  }) {
    return { success: true, data, errors: undefined };
  }
  
  static validateBulkRestockRequest(data: {
    operations: Array<{
      productId: string;
      quantity: number;
      reference?: string;
      notes?: string;
      unitCost?: number;
    }>;
    supplierId?: string;
    purchaseOrderRef?: string;
    batchReference?: string;
    notes?: string;
  }) {
    return { success: true, data, errors: undefined };
  }
}