import { Types, Schema } from 'mongoose';
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

export interface RestockSuggestion {
  product: {
    _id: string;
    name: string;
    sku: string;
    currentStock: number;
    reorderPoint: number;
  };
  currentStock: number;
  reorderPoint: number;
  suggestedQuantity: number;
  daysUntilStockout?: number;
  priority: 'high' | 'medium' | 'low';
}

export interface IInventoryRepository {
  findProductById(id: string): Promise<IProduct | null>;
  updateProductStock(id: string, quantity: number): Promise<{ product: IProduct; previousStock: number }>;
  createInventoryMovement(movement: Omit<IInventoryMovement, '_id' | 'createdAt' | 'updatedAt'>): Promise<IInventoryMovement>;
  findLowStockProducts(threshold: number): Promise<IProduct[]>;
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
    
    // Create inventory movement record to handle stock updates
    const inventoryMovement = new InventoryMovement({
      productId: new Schema.Types.ObjectId(id),
      productName: product.name,
      movementType: 'adjustment',
      quantity: quantity,
      convertedQuantity: quantity,
      unitOfMeasurementId: typeof product.unitOfMeasurement === 'object'
        ? product.unitOfMeasurement as Schema.Types.ObjectId
        : new Schema.Types.ObjectId(product.unitOfMeasurement as string),
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

  async findLowStockProducts(threshold: number = 1.0): Promise<IProduct[]> {
    return await Product.find({
      $expr: {
        $lte: ['$currentStock', { $multiply: ['$reorderPoint', threshold] }]
      },
      status: 'active'
    })
    .populate('supplierId')
    .populate('unitOfMeasurement')
    .populate('category');
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

      const movementData = {
        productId: new Schema.Types.ObjectId(operation.productId),
        movementType: 'adjustment' as const,
        quantity: operation.quantity,
        unitOfMeasurementId: typeof product.unitOfMeasurement === 'object'
          ? product.unitOfMeasurement as Schema.Types.ObjectId
          : new Schema.Types.ObjectId((product.unitOfMeasurement as string) || '507f1f77bcf86cd799439011'),
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

  async getRestockSuggestions(
    threshold: number = 1.0,
    category?: string,
    supplier?: string
  ): Promise<RestockSuggestion[]> {
    const products = await this.inventoryRepository.findLowStockProducts(threshold);
    
    return products
      .filter(product => {
        if (category && product.category) {
          const categoryId = typeof product.category === 'string' 
            ? product.category 
            : product.category.toString();
          if (categoryId !== category) return false;
        }
        if (supplier && product.supplierId) {
          const supplierIdStr = typeof product.supplierId === 'string' 
            ? product.supplierId 
            : product.supplierId.toString();
          if (supplierIdStr !== supplier) return false;
        }
        return true;
      })
      .map(product => this.createRestockSuggestion(product));
  }

  private createRestockSuggestion(product: IProduct): RestockSuggestion {
    const currentStock = product.currentStock;
    const reorderPoint = product.reorderPoint;
    
    // Use the product's intelligent suggestion method if available
    const suggestedQuantity = product.getSuggestedRestockQuantity ? 
      product.getSuggestedRestockQuantity() : 
      Math.max(reorderPoint - currentStock, reorderPoint);
    
    let priority: 'high' | 'medium' | 'low' = 'low';
    if (currentStock <= 0) priority = 'high';
    else if (currentStock <= reorderPoint * 0.5) priority = 'high';
    else if (currentStock <= reorderPoint * 0.8) priority = 'medium';

    // Calculate estimated days until stockout based on average usage
    let daysUntilStockout: number | undefined;
    const avgRestockQty = product.averageRestockQuantity || 0;
    const restockCount = product.restockCount || 0;
    const restockFreq = product.restockFrequency || 30;
    
    if (avgRestockQty > 0 && restockCount > 1) {
      const estimatedDailyUsage = avgRestockQty / restockFreq;
      if (estimatedDailyUsage > 0) {
        daysUntilStockout = Math.floor(currentStock / estimatedDailyUsage);
      }
    }

    return {
      product: {
        _id: product.id || product._id?.toString() || '',
        name: product.name,
        sku: product.sku,
        currentStock: product.currentStock,
        reorderPoint: product.reorderPoint
      },
      currentStock,
      reorderPoint,
      suggestedQuantity,
      daysUntilStockout,
      priority
    };
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
    // TODO: Implement RestockBatch query
    return [];
  }
}