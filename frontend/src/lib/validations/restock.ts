import { z } from 'zod';

export const RestockOperationSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  quantity: z.number().positive('Quantity must be positive'),
  supplier: z.string().optional(),
  notes: z.string().max(500, 'Notes cannot exceed 500 characters').optional(),
  reference: z.string().max(100, 'Reference cannot exceed 100 characters').optional(),
  unitCost: z.number().min(0, 'Unit cost must be non-negative').optional(),
  containerSize: z.number().positive('Container size must be positive').optional(),
  expiryDate: z.date().optional()
});

export const BulkRestockRequestSchema = z.object({
  operations: z.array(RestockOperationSchema).min(1, 'At least one operation is required'),
  batchReference: z.string().max(100, 'Batch reference cannot exceed 100 characters').optional(),
  notes: z.string().max(500, 'Notes cannot exceed 500 characters').optional(),
  purchaseOrderRef: z.string().max(100, 'Purchase order reference cannot exceed 100 characters').optional(),
  supplierId: z.string().optional()
});

export const RestockSuggestionQuerySchema = z.object({
  threshold: z.number().min(0).max(1).default(1.0),
  category: z.string().optional(),
  supplier: z.string().optional(),
  includeInactive: z.boolean().default(false)
});

export type RestockOperation = z.infer<typeof RestockOperationSchema>;
export type BulkRestockRequest = z.infer<typeof BulkRestockRequestSchema>;
export type RestockSuggestionQuery = z.infer<typeof RestockSuggestionQuerySchema>;

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: string[];
}

export class RestockValidator {
  static validateRestockOperation(data: unknown): ValidationResult<RestockOperation> {
    try {
      const validated = RestockOperationSchema.parse(data);
      return { success: true, data: validated };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { 
          success: false, 
          errors: error.issues.map(e => `${e.path.join('.')}: ${e.message}`)
        };
      }
      return { success: false, errors: ['Invalid data format'] };
    }
  }

  static validateBulkRestockRequest(data: unknown): ValidationResult<BulkRestockRequest> {
    try {
      const validated = BulkRestockRequestSchema.parse(data);
      return { success: true, data: validated };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { 
          success: false, 
          errors: error.issues.map(e => `${e.path.join('.')}: ${e.message}`)
        };
      }
      return { success: false, errors: ['Invalid data format'] };
    }
  }

  static validateRestockSuggestionQuery(data: unknown): ValidationResult<RestockSuggestionQuery> {
    try {
      const validated = RestockSuggestionQuerySchema.parse(data);
      return { success: true, data: validated };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { 
          success: false, 
          errors: error.issues.map(e => `${e.path.join('.')}: ${e.message}`)
        };
      }
      return { success: false, errors: ['Invalid data format'] };
    }
  }
}

export interface RestockBusinessRule {
  validate(operation: RestockOperation, productData: unknown): Promise<ValidationResult<void>>;
}

export class QuantityLimitRule implements RestockBusinessRule {
  constructor(private maxQuantityPerOperation: number = 10000) {}

  async validate(operation: RestockOperation): Promise<ValidationResult<void>> {
    if (operation.quantity > this.maxQuantityPerOperation) {
      return {
        success: false,
        errors: [`Quantity ${operation.quantity} exceeds maximum allowed ${this.maxQuantityPerOperation}`]
      };
    }
    return { success: true };
  }
}

export class ProductActiveRule implements RestockBusinessRule {
  async validate(operation: RestockOperation, productData: unknown): Promise<ValidationResult<void>> {
    const product = productData as { status?: string };
    if (!product || product.status !== 'active') {
      return {
        success: false,
        errors: ['Product must be active to perform restock operations']
      };
    }
    return { success: true };
  }
}

export class SupplierValidationRule implements RestockBusinessRule {
  async validate(operation: RestockOperation, productData: unknown): Promise<ValidationResult<void>> {
    const product = productData as { supplier?: { toString(): string } };
    if (operation.supplier && product.supplier && 
        operation.supplier !== product.supplier.toString()) {
      return {
        success: false,
        errors: ['Specified supplier does not match product\'s default supplier']
      };
    }
    return { success: true };
  }
}

export class RestockBusinessValidator {
  private rules: RestockBusinessRule[] = [
    new QuantityLimitRule(),
    new ProductActiveRule(),
    new SupplierValidationRule()
  ];

  async validateOperation(operation: RestockOperation, productData: unknown): Promise<ValidationResult<void>> {
    const errors: string[] = [];

    for (const rule of this.rules) {
      const result = await rule.validate(operation, productData);
      if (!result.success && result.errors) {
        errors.push(...result.errors);
      }
    }

    return errors.length > 0 
      ? { success: false, errors } 
      : { success: true };
  }

  addRule(rule: RestockBusinessRule): void {
    this.rules.push(rule);
  }

  removeRule(ruleType: new (...args: unknown[]) => RestockBusinessRule): void {
    this.rules = this.rules.filter(rule => !(rule instanceof ruleType));
  }
}