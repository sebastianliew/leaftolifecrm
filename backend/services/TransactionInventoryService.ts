import mongoose, { ClientSession } from 'mongoose';
import { Product } from '../models/Product.js';
import { Bundle } from '../models/Bundle.js';
import { BlendTemplate } from '../models/BlendTemplate.js';
import { InventoryMovement, IInventoryMovement } from '../models/inventory/InventoryMovement.js';
import { CustomBlendService } from './CustomBlendService.js';
import { ITransaction } from '../models/Transaction.js';
import { InventoryDeductionResult, InventoryReversalResult, TransactionItem } from '../types/transaction-inventory.types.js';

// ── Helpers ──

/** Save a Mongoose document with optional session */
async function saveDoc(doc: { save(opts?: { session: ClientSession }): Promise<unknown> }, session?: ClientSession) {
  return session ? doc.save({ session }) : doc.save();
}

/** Create and save an InventoryMovement, then update product stock */
async function createMovement(
  fields: Record<string, unknown>,
  session?: ClientSession,
  skipStockUpdate = false
): Promise<IInventoryMovement> {
  const movement = new InventoryMovement(fields);
  await saveDoc(movement, session);
  if (!skipStockUpdate) await movement.updateProductStock();
  return movement;
}

const REVERSIBLE_TYPES = ['sale', 'fixed_blend', 'bundle_sale', 'bundle_blend_ingredient', 'blend_ingredient', 'custom_blend'];
const NO_INVENTORY_TYPES = new Set(['miscellaneous', 'service', 'consultation']);

// ── Strategy: Item Processors ──

type ItemProcessor = (
  item: TransactionItem,
  transactionRef: string,
  userId: string,
  session?: ClientSession
) => Promise<IInventoryMovement[]>;

/** Deduct blend template ingredients, scaled by quantity */
async function deductBlendIngredients(
  blendTemplateId: string,
  quantity: number,
  transactionRef: string,
  userId: string,
  contextLabel: string,
  session?: ClientSession
): Promise<IInventoryMovement[]> {
  const template = await BlendTemplate.findById(blendTemplateId).session(session || null);
  if (!template) throw new Error(`Blend template not found: ${blendTemplateId}`);

  const movements: IInventoryMovement[] = [];
  for (const ing of template.ingredients) {
    const scaled = ing.quantity * quantity;
    movements.push(await createMovement({
      productId: ing.productId,
      movementType: contextLabel.includes('bundle') ? 'bundle_blend_ingredient' : 'fixed_blend',
      quantity: scaled, convertedQuantity: scaled,
      unitOfMeasurementId: ing.unitOfMeasurementId,
      baseUnit: ing.unitName || 'unit',
      reference: transactionRef,
      notes: `${contextLabel}: ${ing.name} for ${template.name} x ${quantity}`,
      createdBy: userId, productName: ing.name
    }, session));
  }
  return movements;
}

const processProduct: ItemProcessor = async (item, ref, userId, session) => {
  const movement = await createMovement({
    productId: new mongoose.Types.ObjectId(item.productId),
    movementType: 'sale',
    quantity: item.quantity, convertedQuantity: item.convertedQuantity || item.quantity,
    unitOfMeasurementId: new mongoose.Types.ObjectId(item.unitOfMeasurementId),
    baseUnit: item.baseUnit || 'unit',
    reference: ref,
    notes: `Sale: ${item.name} x ${item.quantity}${item.saleType === 'volume' ? ' (volume)' : ''}`,
    createdBy: userId, productName: item.name,
  }, session);

  return [movement];
};

const processFixedBlend: ItemProcessor = async (item, ref, userId, session) => {
  const movements = await deductBlendIngredients(item.productId, item.quantity, ref, userId, 'Fixed blend ingredient', session);

  // Update usage stats
  const template = await BlendTemplate.findById(item.productId).session(session || null);
  if (template) {
    template.usageCount = (template.usageCount || 0) + item.quantity;
    template.lastUsed = new Date();
    await saveDoc(template, session);
  }

  return movements;
};

const processBundle: ItemProcessor = async (item, ref, userId, session) => {
  const bundle = await Bundle.findById(item.productId).session(session || null);
  if (!bundle) throw new Error(`Bundle not found: ${item.productId}`);

  const movements: IInventoryMovement[] = [];

  for (const bp of bundle.bundleProducts) {
    const totalQty = bp.quantity * item.quantity;

    if ((bp.productType === 'fixed_blend') && bp.blendTemplateId) {
      movements.push(...await deductBlendIngredients(
        bp.blendTemplateId.toString(), totalQty, ref, userId, `Bundle blend ingredient`, session
      ));
    } else {
      const product = await Product.findById(bp.productId).session(session || null);
      if (!product) { console.warn(`[TIS] Bundle product not found: ${bp.productId}, skipping`); continue; }

      movements.push(await createMovement({
        productId: bp.productId,
        movementType: 'bundle_sale',
        quantity: totalQty, convertedQuantity: totalQty,
        unitOfMeasurementId: bp.unitOfMeasurementId || product.unitOfMeasurement,
        baseUnit: bp.unitName || 'unit',
        reference: ref,
        notes: `Bundle sale: ${bp.name} from ${bundle.name} x ${item.quantity}`,
        createdBy: userId, productName: bp.name
      }, session));
    }
  }

  return movements;
};

/** Registry of item type → processor */
const ITEM_PROCESSORS: Record<string, ItemProcessor> = {
  product: processProduct,
  fixed_blend: processFixedBlend,
  bundle: processBundle,
};

// ── Main Service ──

export class TransactionInventoryService {
  private customBlendService = new CustomBlendService();

  async processTransactionInventory(
    transaction: ITransaction,
    userId: string,
    session?: ClientSession
  ): Promise<InventoryDeductionResult> {
    const result: InventoryDeductionResult = { success: true, movements: [], errors: [], warnings: [] };

    // Idempotency: check for existing movements
    const existing = await InventoryMovement.find({
      reference: transaction.transactionNumber,
      movementType: { $in: REVERSIBLE_TYPES }
    }).session(session || null);

    if (existing.length > 0) {
      result.warnings.push(`Inventory movements already exist (${existing.length}). Skipping to prevent duplicate deduction.`);
      result.movements = existing;
      return result;
    }

    for (const item of transaction.items) {
      try {
        const txItem = item as TransactionItem;
        const itemType = txItem.itemType || 'product';

        if (NO_INVENTORY_TYPES.has(itemType)) continue;

        if (itemType === 'custom_blend') {
          // Handled separately by CustomBlendService during transaction creation
          continue;
        }

        const processor = ITEM_PROCESSORS[itemType] || processProduct;
        result.movements.push(...await processor(txItem, transaction.transactionNumber, userId, session));
      } catch (error) {
        result.errors.push(`Failed to process ${item.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    if (result.errors.length) console.warn(`[TIS] ${result.errors.length} errors:`, result.errors);
    return result;
  }

  async reverseTransactionInventory(
    transactionNumber: string,
    userId: string,
    session?: ClientSession
  ): Promise<InventoryReversalResult> {
    const result: InventoryReversalResult = {
      success: true, reversedMovements: [], errors: [], warnings: [],
      originalMovementCount: 0, reversedCount: 0
    };

    // Idempotency: check for existing reversals
    const existingReversals = await InventoryMovement.find({
      reference: `CANCEL-${transactionNumber}`
    }).session(session || null);

    if (existingReversals.length > 0) {
      result.warnings.push(`Already reversed (${existingReversals.length} movements). Skipping.`);
      return result;
    }

    const originals = await InventoryMovement.find({
      reference: transactionNumber,
      movementType: { $in: REVERSIBLE_TYPES }
    }).session(session || null);

    result.originalMovementCount = originals.length;
    if (!originals.length) {
      result.warnings.push(`No movements found for ${transactionNumber}.`);
      return result;
    }

    for (const orig of originals) {
      try {
        const reversal = await createMovement({
          productId: orig.productId,
          movementType: 'return',
          quantity: orig.quantity, convertedQuantity: orig.convertedQuantity,
          unitOfMeasurementId: orig.unitOfMeasurementId,
          baseUnit: orig.baseUnit,
          reference: `CANCEL-${transactionNumber}`,
          notes: `Cancellation reversal for ${orig.movementType}: ${orig.notes || ''}`,
          createdBy: userId, productName: orig.productName,
        }, session);

        result.reversedMovements.push(reversal);
        result.reversedCount++;
      } catch (error) {
        result.errors.push(`Failed to reverse ${orig.productName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return result;
  }
}

export const transactionInventoryService = new TransactionInventoryService();
