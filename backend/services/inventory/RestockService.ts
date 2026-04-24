import mongoose, { Types, Schema } from 'mongoose';
import { Product, IProduct } from '../../models/Product.js';
import { InventoryMovement, IInventoryMovement } from '../../models/inventory/InventoryMovement.js';
// import { RestockBatch } from '../../../models/RestockBatch.js'; // TODO: Fix module import
import { UnitOfMeasurement } from '../../models/UnitOfMeasurement.js';
// TODO: Create proper validation types and classes
interface RestockOperation {
  productId: string;
  quantity: number;
  reference?: string;
  notes?: string;
  unitCost?: number;
}

interface BulkRestockRequest {
  operations: RestockOperation[];
  supplierId?: string;
  purchaseOrderRef?: string;
  batchReference?: string;
  notes?: string;
}

interface ValidationResult {
  success: boolean;
  errors?: string[];
}

class RestockBusinessValidator {
  async validateOperation(operation: RestockOperation, product: IProduct | null): Promise<ValidationResult> {
    const errors: string[] = [];
    
    if (!operation.productId) errors.push('Product ID is required');
    if (!operation.quantity || operation.quantity <= 0) errors.push('Quantity must be positive');
    if (!product) errors.push('Product not found');
    
    return {
      success: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }
}

class AppError extends Error {
  constructor(message: string, public status: number = 500) {
    super(message);
    this.name = 'AppError';
  }
}

export interface RestockResult {
  productId: string;
  previousStock: number;
  newStock: number;
  quantityAdded: number;
  movementId: string;
  success: boolean;
  error?: string;
}

export interface BulkRestockResult {
  batchId: string;
  totalOperations: number;
  successCount: number;
  failureCount: number;
  results: RestockResult[];
  batch: {
    id: string;
    createdAt: Date;
    status: 'pending' | 'processing' | 'completed' | 'failed';
  };
}

export interface IInventoryRepository {
  findProductById(id: string): Promise<IProduct | null>;
  updateProductStock(id: string, quantity: number): Promise<{ product: IProduct; previousStock: number }>;
  createInventoryMovement(movement: Omit<IInventoryMovement, '_id' | 'createdAt' | 'updatedAt'>): Promise<IInventoryMovement>;
}

export interface IRestockNotificationService {
  notifyRestockCompleted(result: RestockResult): Promise<void>;
  notifyBulkRestockCompleted(result: BulkRestockResult): Promise<void>;
}

export class MongoInventoryRepository implements IInventoryRepository {
  async findProductById(id: string): Promise<IProduct | null> {
    const product = await Product.findById(id)
      .populate('supplierId')
      .populate('unitOfMeasurement')
      .populate('category');
    
    if (!product) {
      throw new AppError(`Product with ID ${id} not found`, 404);
    }
    
    return product;
  }

  async updateProductStock(id: string, quantity: number): Promise<{ product: IProduct; previousStock: number }> {
    const product = await Product.findById(id);
    if (!product) {
      throw new AppError(`Product with ID ${id} not found`, 404);
    }

    const previousStock = product.currentStock;
    
    // Create inventory movement record to handle stock updates.
    // Schema.Types.ObjectId is a schema-type metadata class — not the BSON
    // ObjectId constructor. Using it here used to cause mongoose CastError at
    // save, silently swallowed by restockProduct's try/catch. Use
    // mongoose.Types.ObjectId instead.
    const uomId = typeof product.unitOfMeasurement === 'object'
      ? (product.unitOfMeasurement as unknown as { _id: mongoose.Types.ObjectId })._id
        ?? (product.unitOfMeasurement as unknown as mongoose.Types.ObjectId)
      : new mongoose.Types.ObjectId(product.unitOfMeasurement as string);
    const inventoryMovement = new InventoryMovement({
      productId: new mongoose.Types.ObjectId(id),
      productName: product.name,
      movementType: 'adjustment',
      quantity: quantity,
      convertedQuantity: quantity,
      unitOfMeasurementId: uomId,
      baseUnit: product.unitName || 'unit',
      reference: `RESTOCK-${Date.now()}`,
      reason: `Stock addition`,
      referenceType: 'restock',
      createdBy: 'system'
    });
    
    await inventoryMovement.save();
    await inventoryMovement.updateProductStock();
    return { product, previousStock };
  }

  async createInventoryMovement(movementData: Omit<IInventoryMovement, '_id' | 'createdAt' | 'updatedAt'>): Promise<IInventoryMovement> {
    const movement = new InventoryMovement(movementData);
    return await movement.save();
  }
}

export class NoOpNotificationService implements IRestockNotificationService {
  async notifyRestockCompleted(result: RestockResult): Promise<void> {
    console.log(`Restock completed for product ${result.productId}`);
  }

  async notifyBulkRestockCompleted(result: BulkRestockResult): Promise<void> {
    console.log(`Bulk restock completed: ${result.successCount}/${result.totalOperations} successful`);
  }
}

export class RestockService {
  private validator = new RestockBusinessValidator();

  constructor(
    private inventoryRepository: IInventoryRepository = new MongoInventoryRepository(),
    private notificationService: IRestockNotificationService = new NoOpNotificationService()
  ) {}

  async restockProduct(operation: RestockOperation, _createdBy: string): Promise<RestockResult> {
    try {
      const product = await this.inventoryRepository.findProductById(operation.productId);
      
      const validationResult = await this.validator.validateOperation(operation, product);
      if (!validationResult.success) {
        throw new AppError(`Validation failed: ${validationResult.errors?.join(', ')}`, 400);
      }

      if (!product) {
        throw new AppError('Product not found', 404);
      }

      const unitOfMeasurement = await UnitOfMeasurement.findById(product.unitOfMeasurement);
      if (!unitOfMeasurement) {
        throw new AppError('Unit of measurement not found', 404);
      }

      const { product: updatedProduct, previousStock } = await this.inventoryRepository.updateProductStock(
        operation.productId, 
        operation.quantity
      );

      // Update restock analytics
      if (updatedProduct.updateRestockAnalytics) {
        await updatedProduct.updateRestockAnalytics(operation.quantity);
      }

      // Secondary ledger-only movement (the stock update already happened inside
      // inventoryRepository.updateProductStock). Historically this was using
      // Schema.Types.ObjectId too, which silently failed at save. Using the
      // correct BSON constructor here so the ledger row actually persists.
      const uomId2 = typeof product.unitOfMeasurement === 'object'
        ? (product.unitOfMeasurement as unknown as { _id: mongoose.Types.ObjectId })._id
          ?? (product.unitOfMeasurement as unknown as mongoose.Types.ObjectId)
        : new mongoose.Types.ObjectId((product.unitOfMeasurement as string) || '507f1f77bcf86cd799439011');
      const movementData = {
        productId: new mongoose.Types.ObjectId(operation.productId),
        movementType: 'adjustment' as const,
        quantity: operation.quantity,
        unitOfMeasurementId: uomId2,
        baseUnit: unitOfMeasurement?.name || 'unit',
        convertedQuantity: operation.quantity,
        reference: operation.reference || `RESTOCK-${Date.now()}`,
        notes: operation.notes || 'Product restocked',
        createdBy: 'system'
      };

      const movement = new InventoryMovement(movementData);
      await movement.save();

      const result: RestockResult = {
        productId: operation.productId,
        previousStock,
        newStock: updatedProduct.currentStock,
        quantityAdded: operation.quantity,
        movementId: movement.id?.toString() || '',
        success: true
      };

      await this.notificationService.notifyRestockCompleted(result);
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return {
        productId: operation.productId,
        previousStock: 0,
        newStock: 0,
        quantityAdded: 0,
        movementId: '',
        success: false,
        error: errorMessage
      };
    }
  }

  async bulkRestock(request: BulkRestockRequest, _createdBy: string): Promise<BulkRestockResult> {
    // TODO: Implement RestockBatch functionality
    const batchId = `BATCH-${Date.now()}`;
    const batch = {
      _id: new Types.ObjectId(),
      batchId,
      save: async () => {},
      markAsProcessing: async () => {},
      addMovement: async (_id: Types.ObjectId) => {},
      markAsCompleted: async () => {},
      markAsFailed: async (_reason: string) => {}
    };

    const results: RestockResult[] = [];
    let successCount = 0;
    let failureCount = 0;

    try {
      for (const operation of request.operations) {
        const result = await this.restockProduct(operation, _createdBy);
        results.push(result);

        if (result.success) {
          successCount++;
          if (result.movementId) {
            await batch.addMovement(new Types.ObjectId(result.movementId));
          }
        } else {
          failureCount++;
        }
      }

      if (failureCount === 0) {
        await batch.markAsCompleted();
      } else if (successCount === 0) {
        await batch.markAsFailed('All operations failed');
      } else {
        await batch.markAsCompleted();
      }

      const bulkResult: BulkRestockResult = {
        batchId: batch.batchId,
        totalOperations: request.operations.length,
        successCount,
        failureCount,
        results,
        batch: {
          id: batch._id instanceof Types.ObjectId ? batch._id.toString() : String(batch._id),
          createdAt: new Date(),
          status: 'completed' as const
        }
      };

      await this.notificationService.notifyBulkRestockCompleted(bulkResult);
      return bulkResult;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Bulk restock failed';
      await batch.markAsFailed(errorMessage);
      throw new AppError(errorMessage, 500);
    }
  }

  async getRestockHistory(productId?: string, limit: number = 50) {
    const filter: { movementType: string; productId?: string } = { movementType: 'adjustment' };
    if (productId) filter.productId = productId;

    return await InventoryMovement.find(filter)
      .populate('productId', 'name sku')
      .sort({ createdAt: -1 })
      .limit(limit);
  }

  async getBatchHistory(_limit: number = 20) {
    // TODO: Implement RestockBatch query — returns empty until RestockBatch model is created
    console.warn('[RestockService] getBatchHistory not implemented — RestockBatch model missing');
    return [];
  }
}