import mongoose, { ClientSession } from 'mongoose';
import { Product } from '../models/Product.js';
import { Bundle } from '../models/Bundle.js';
import { BlendTemplate } from '../models/BlendTemplate.js';
import { InventoryMovement, IInventoryMovement } from '../models/inventory/InventoryMovement.js';
import { CustomBlendService } from './CustomBlendService.js';
import { ITransaction } from '../models/Transaction.js';
import { InventoryDeductionResult, InventoryReversalResult, TransactionItem } from '../types/transaction-inventory.types.js';

export class TransactionInventoryService {
  private customBlendService: CustomBlendService;

  constructor() {
    this.customBlendService = new CustomBlendService();
  }

  /**
   * Main entry point - process inventory deduction for a transaction
   */
  async processTransactionInventory(
    transaction: ITransaction,
    userId: string,
    session?: ClientSession
  ): Promise<InventoryDeductionResult> {
    const result: InventoryDeductionResult = {
      success: true,
      movements: [],
      errors: [],
      warnings: []
    };

    // CRITICAL: Check if inventory movements already exist for this transaction
    // This prevents duplicate deductions from retried requests or race conditions
    const existingMovements = await InventoryMovement.find({
      reference: transaction.transactionNumber,
      movementType: { $in: ['sale', 'fixed_blend', 'bundle_sale', 'bundle_blend_ingredient', 'blend_ingredient', 'custom_blend'] }
    }).session(session || null);

    if (existingMovements.length > 0) {
      console.log(`[TransactionInventoryService] DUPLICATE PREVENTED: Inventory movements already exist for ${transaction.transactionNumber} (${existingMovements.length} movements). Returning existing movements.`);
      result.warnings.push(`Inventory movements already exist for this transaction (${existingMovements.length} movements). Skipping to prevent duplicate deduction.`);
      // Return existing movements instead of creating duplicates
      result.movements = existingMovements;
      return result;
    }

    for (const item of transaction.items) {
      try {
        const itemMovements = await this.processItem(
          item as TransactionItem,
          transaction.transactionNumber,
          userId,
          session
        );
        result.movements.push(...itemMovements);
      } catch (error) {
        const errorMsg = `Failed to process ${item.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error('[TransactionInventoryService]', errorMsg);
        result.errors.push(errorMsg);
        // Continue processing other items - allow negative stock
      }
    }

    // Log summary
    console.log(`[TransactionInventoryService] Processed ${result.movements.length} movements for transaction ${transaction.transactionNumber}`);
    if (result.errors.length > 0) {
      console.warn(`[TransactionInventoryService] ${result.errors.length} errors occurred:`, result.errors);
    }

    return result;
  }

  /**
   * Router for item types
   */
  private async processItem(
    item: TransactionItem,
    transactionRef: string,
    userId: string,
    session?: ClientSession
  ): Promise<IInventoryMovement[]> {
    const itemType = item.itemType || 'product'; // Default to product for backwards compatibility

    switch (itemType) {
      case 'product':
        return this.processProductItem(item, transactionRef, userId, session);

      case 'fixed_blend':
        return this.processFixedBlendItem(item, transactionRef, userId, session);

      case 'bundle':
        return this.processBundleItem(item, transactionRef, userId, session);

      case 'custom_blend':
        // Custom blends are handled by CustomBlendService during transaction creation
        // This is called from the frontend, so we skip here to avoid double deduction
        console.log(`[TransactionInventoryService] Skipping custom_blend item: ${item.name} (handled separately)`);
        return [];

      case 'miscellaneous':
      case 'service':
      case 'consultation':
        // No inventory impact for these item types
        console.log(`[TransactionInventoryService] Skipping ${itemType} item: ${item.name} (no inventory impact)`);
        return [];

      default:
        // Default to product behavior for unknown types
        console.warn(`[TransactionInventoryService] Unknown item type '${itemType}' for ${item.name}, treating as product`);
        return this.processProductItem(item, transactionRef, userId, session);
    }
  }

  /**
   * Process regular product sale
   * Supports both full container sales (saleType: 'quantity') and partial bottle sales (saleType: 'volume')
   */
  private async processProductItem(
    item: TransactionItem,
    transactionRef: string,
    userId: string,
    session?: ClientSession
  ): Promise<IInventoryMovement[]> {
    const product = await Product.findById(item.productId).session(session || null);
    if (!product) {
      throw new Error(`Product not found: ${item.productId}`);
    }

    // Determine if this is a partial/volume sale (selling from an open bottle)
    const isPartialSale = item.saleType === 'volume';
    const containerStatus = isPartialSale ? 'partial' : undefined;

    // Create inventory movement
    const movement = new InventoryMovement({
      productId: new mongoose.Types.ObjectId(item.productId),
      movementType: 'sale',
      quantity: item.quantity,
      unitOfMeasurementId: new mongoose.Types.ObjectId(item.unitOfMeasurementId),
      baseUnit: item.baseUnit || 'unit',
      convertedQuantity: item.convertedQuantity || item.quantity,
      reference: transactionRef,
      notes: `Sale: ${item.name} x ${item.quantity}${isPartialSale ? ' (partial bottle)' : ''}`,
      createdBy: userId,
      productName: item.name,
      // Container tracking for partial sales
      containerStatus: containerStatus,
      containerId: item.containerId
    });

    if (session) {
      await movement.save({ session });
    } else {
      await movement.save();
    }

    // For partial/volume sales with container capacity, use bottle-level tracking
    if (isPartialSale && product.containerCapacity && product.containerCapacity > 0) {
      // Use the enhanced handlePartialContainerSale with bottle tracking
      await product.handlePartialContainerSale(item.convertedQuantity || item.quantity, {
        containerId: item.containerId,
        transactionRef: transactionRef,
        userId: userId
      });
      console.log(`[TransactionInventoryService] Deducted ${item.quantity} of ${item.name} from bottle${item.containerId ? ` (${item.containerId})` : ' (auto-FIFO)'}`);
    } else {
      // Standard stock deduction via movement
      await movement.updateProductStock();
      console.log(`[TransactionInventoryService] Deducted ${item.quantity} of ${item.name} (product)`);
    }

    return [movement];
  }

  /**
   * Process fixed blend (blend template) sale - deducts ingredients
   */
  private async processFixedBlendItem(
    item: TransactionItem,
    transactionRef: string,
    userId: string,
    session?: ClientSession
  ): Promise<IInventoryMovement[]> {
    // Find the blend template
    const blendTemplate = await BlendTemplate.findById(item.productId).session(session || null);
    if (!blendTemplate) {
      throw new Error(`Blend template not found: ${item.productId}`);
    }

    const movements: IInventoryMovement[] = [];

    // Deduct each ingredient (scaled by transaction quantity)
    for (const ingredient of blendTemplate.ingredients) {
      const scaledQuantity = ingredient.quantity * item.quantity;

      const movement = new InventoryMovement({
        productId: ingredient.productId,
        movementType: 'fixed_blend',
        quantity: scaledQuantity,
        unitOfMeasurementId: ingredient.unitOfMeasurementId,
        baseUnit: ingredient.unitName || 'unit',
        convertedQuantity: scaledQuantity,
        reference: transactionRef,
        notes: `Fixed blend ingredient: ${ingredient.name} for ${blendTemplate.name} x ${item.quantity}`,
        createdBy: userId,
        productName: ingredient.name
      });

      if (session) {
        await movement.save({ session });
      } else {
        await movement.save();
      }

      await movement.updateProductStock();
      movements.push(movement);
    }

    // Update blend template usage statistics
    blendTemplate.usageCount = (blendTemplate.usageCount || 0) + item.quantity;
    blendTemplate.lastUsed = new Date();
    if (session) {
      await blendTemplate.save({ session });
    } else {
      await blendTemplate.save();
    }

    console.log(`[TransactionInventoryService] Deducted ${movements.length} ingredients for fixed blend: ${blendTemplate.name} x ${item.quantity}`);
    return movements;
  }

  /**
   * Process bundle sale - deducts all component products
   */
  private async processBundleItem(
    item: TransactionItem,
    transactionRef: string,
    userId: string,
    session?: ClientSession
  ): Promise<IInventoryMovement[]> {
    // Find the bundle
    const bundle = await Bundle.findById(item.productId).session(session || null);
    if (!bundle) {
      throw new Error(`Bundle not found: ${item.productId}`);
    }

    const movements: IInventoryMovement[] = [];

    // Process each bundle product
    for (const bundleProduct of bundle.bundleProducts) {
      const totalQuantity = bundleProduct.quantity * item.quantity;

      if (bundleProduct.productType === 'fixed_blend' && bundleProduct.blendTemplateId) {
        // Bundle contains a fixed blend - deduct blend ingredients
        const blendMovements = await this.processFixedBlendForBundle(
          bundleProduct.blendTemplateId.toString(),
          totalQuantity,
          transactionRef,
          userId,
          bundle.name,
          session
        );
        movements.push(...blendMovements);
      } else {
        // Regular product in bundle
        const product = await Product.findById(bundleProduct.productId).session(session || null);
        if (!product) {
          console.warn(`[TransactionInventoryService] Bundle product not found: ${bundleProduct.productId}, skipping`);
          continue;
        }

        const movement = new InventoryMovement({
          productId: bundleProduct.productId,
          movementType: 'bundle_sale',
          quantity: totalQuantity,
          unitOfMeasurementId: bundleProduct.unitOfMeasurementId || product.unitOfMeasurement,
          baseUnit: bundleProduct.unitName || 'unit',
          convertedQuantity: totalQuantity,
          reference: transactionRef,
          notes: `Bundle sale: ${bundleProduct.name} from ${bundle.name} x ${item.quantity}`,
          createdBy: userId,
          productName: bundleProduct.name
        });

        if (session) {
          await movement.save({ session });
        } else {
          await movement.save();
        }

        await movement.updateProductStock();
        movements.push(movement);
      }
    }

    console.log(`[TransactionInventoryService] Deducted ${movements.length} products for bundle: ${bundle.name} x ${item.quantity}`);
    return movements;
  }

  /**
   * Helper for fixed blends within bundles
   */
  private async processFixedBlendForBundle(
    blendTemplateId: string,
    quantity: number,
    transactionRef: string,
    userId: string,
    bundleName: string,
    session?: ClientSession
  ): Promise<IInventoryMovement[]> {
    const blendTemplate = await BlendTemplate.findById(blendTemplateId).session(session || null);
    if (!blendTemplate) {
      throw new Error(`Blend template not found in bundle: ${blendTemplateId}`);
    }

    const movements: IInventoryMovement[] = [];

    for (const ingredient of blendTemplate.ingredients) {
      const scaledQuantity = ingredient.quantity * quantity;

      const movement = new InventoryMovement({
        productId: ingredient.productId,
        movementType: 'bundle_blend_ingredient',
        quantity: scaledQuantity,
        unitOfMeasurementId: ingredient.unitOfMeasurementId,
        baseUnit: ingredient.unitName || 'unit',
        convertedQuantity: scaledQuantity,
        reference: transactionRef,
        notes: `Bundle blend ingredient: ${ingredient.name} for ${blendTemplate.name} in ${bundleName}`,
        createdBy: userId,
        productName: ingredient.name
      });

      if (session) {
        await movement.save({ session });
      } else {
        await movement.save();
      }

      await movement.updateProductStock();
      movements.push(movement);
    }

    return movements;
  }

  /**
   * Reverse inventory deductions for a cancelled transaction
   * Creates 'return' movements to restore stock for all items that were deducted
   */
  async reverseTransactionInventory(
    transactionNumber: string,
    userId: string,
    session?: ClientSession
  ): Promise<InventoryReversalResult> {
    const result: InventoryReversalResult = {
      success: true,
      reversedMovements: [],
      errors: [],
      warnings: [],
      originalMovementCount: 0,
      reversedCount: 0
    };

    // Movement types that should be reversed (stock-affecting)
    const reversibleTypes = [
      'sale',
      'fixed_blend',
      'bundle_sale',
      'bundle_blend_ingredient',
      'blend_ingredient',
      'custom_blend'
    ];

    try {
      // Check if already reversed (prevent double-reversal)
      const existingReversals = await InventoryMovement.find({
        reference: `CANCEL-${transactionNumber}`
      }).session(session || null);

      if (existingReversals.length > 0) {
        result.warnings.push(`Transaction ${transactionNumber} already has ${existingReversals.length} reversal movements. Skipping to prevent double-reversal.`);
        console.log(`[TransactionInventoryService] Skipping reversal - already reversed: ${transactionNumber}`);
        return result;
      }

      // Find all original movements for this transaction
      const originalMovements = await InventoryMovement.find({
        reference: transactionNumber,
        movementType: { $in: reversibleTypes }
      }).session(session || null);

      result.originalMovementCount = originalMovements.length;

      if (originalMovements.length === 0) {
        result.warnings.push(`No inventory movements found for transaction ${transactionNumber}. May have been a draft or already reversed.`);
        console.log(`[TransactionInventoryService] No movements to reverse for: ${transactionNumber}`);
        return result;
      }

      console.log(`[TransactionInventoryService] Reversing ${originalMovements.length} movements for: ${transactionNumber}`);

      // Create return movements for each original movement
      for (const original of originalMovements) {
        try {
          const returnMovement = new InventoryMovement({
            productId: original.productId,
            movementType: 'return',
            quantity: original.quantity,
            unitOfMeasurementId: original.unitOfMeasurementId,
            baseUnit: original.baseUnit,
            convertedQuantity: original.convertedQuantity,
            reference: `CANCEL-${transactionNumber}`,
            notes: `Cancellation reversal for ${original.movementType}: ${original.notes || 'No notes'}`,
            createdBy: userId,
            productName: original.productName,
            // Preserve container info if present
            containerStatus: original.containerStatus,
            containerId: original.containerId,
            remainingQuantity: original.remainingQuantity
          });

          if (session) {
            await returnMovement.save({ session });
          } else {
            await returnMovement.save();
          }

          // Update product stock (adds back the quantity)
          await returnMovement.updateProductStock();

          result.reversedMovements.push(returnMovement);
          result.reversedCount++;

          console.log(`[TransactionInventoryService] Reversed: ${original.productName} +${original.convertedQuantity} ${original.baseUnit}`);
        } catch (movementError) {
          const errorMsg = `Failed to reverse movement for ${original.productName}: ${movementError instanceof Error ? movementError.message : 'Unknown error'}`;
          console.error('[TransactionInventoryService]', errorMsg);
          result.errors.push(errorMsg);
          // Continue with other movements
        }
      }

      console.log(`[TransactionInventoryService] Reversal complete: ${result.reversedCount}/${result.originalMovementCount} movements reversed`);

    } catch (error) {
      const errorMsg = `Failed to reverse inventory for ${transactionNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error('[TransactionInventoryService]', errorMsg);
      result.errors.push(errorMsg);
      result.success = false;
    }

    return result;
  }
}

// Export a singleton instance for convenience
export const transactionInventoryService = new TransactionInventoryService();
