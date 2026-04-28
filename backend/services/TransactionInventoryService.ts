import mongoose, { ClientSession } from 'mongoose';
import { Product } from '../models/Product.js';
import { Bundle } from '../models/Bundle.js';
import { BlendTemplate } from '../models/BlendTemplate.js';
import { InventoryMovement, IInventoryMovement } from '../models/inventory/InventoryMovement.js';
import { CustomBlendHistory } from '../models/CustomBlendHistory.js';
import { CustomBlendService } from './CustomBlendService.js';
import { ITransaction } from '../models/Transaction.js';
import { InventoryDeductionResult, InventoryReversalResult, TransactionItem } from '../types/transaction-inventory.types.js';
import { type InsufficientStockDetail } from '../middlewares/errorHandler.middleware.js';

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
  if (!skipStockUpdate) await movement.updateProductStock(session);
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
      createdBy: userId, productName: ing.name,
      // Blend ingredients are dispensed from open (loose) bottles.
      // pool='loose' decrements looseStock + currentStock together so subsequent
      // volume/loose validations see accurate pool availability.
      pool: 'loose',
    }, session));
  }
  return movements;
}

const processProduct: ItemProcessor = async (item, ref, userId, session) => {
  // Stock is always tracked in loose units — use convertedQuantity from controller.
  // The controller now sets the correct value based on saleType and containerCapacity.
  const safeConvertedQty = item.convertedQuantity;

  const movement = await createMovement({
    productId: new mongoose.Types.ObjectId(item.productId),
    movementType: 'sale',
    quantity: item.quantity, convertedQuantity: safeConvertedQty,
    unitOfMeasurementId: new mongoose.Types.ObjectId(item.unitOfMeasurementId),
    baseUnit: item.baseUnit || 'unit',
    reference: ref,
    notes: `Sale: ${item.name} x ${item.quantity}${item.saleType === 'volume' ? ' (volume/loose)' : ' (sealed)'}`,
    createdBy: userId, productName: item.name,
    pool: item.saleType === 'volume' ? 'loose' : 'sealed',
  }, session);

  return [movement];
};

const processFixedBlend: ItemProcessor = async (item, ref, userId, session) => {
  const movements = await deductBlendIngredients(item.productId, item.quantity, ref, userId, 'Fixed blend ingredient', session);

  // Atomic usage-stat update. Read-modify-write loses counter updates under
  // concurrent sales of the same template — $inc is the only safe form.
  await BlendTemplate.updateOne(
    { _id: item.productId },
    { $inc: { usageCount: item.quantity }, $set: { lastUsed: new Date() } },
    session ? { session } : {},
  );

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
      if (!product) {
        const warnMsg = `[TIS] Bundle product not found: ${bp.productId} (bundle: ${bundle.name}) — inventory NOT deducted for this component`;
        console.error(warnMsg);
        // Push a sentinel movement to signal the error upstream (outer caller checks result.errors)
        movements.push({ __error: warnMsg } as unknown as typeof movements[0]);
        continue; // Still process other components
      }

      movements.push(await createMovement({
        productId: bp.productId,
        movementType: 'bundle_sale',
        quantity: totalQty, convertedQuantity: totalQty,
        unitOfMeasurementId: bp.unitOfMeasurementId || product.unitOfMeasurement,
        baseUnit: bp.unitName || 'unit',
        reference: ref,
        notes: `Bundle sale: ${bp.name} from ${bundle.name} x ${item.quantity}`,
        createdBy: userId, productName: bp.name,
        // Bundle components are typically dispensed from open (loose) stock just
        // like blend ingredients. pool='loose' keeps looseStock in sync with
        // currentStock; the 'any' default was leaving looseStock stale.
        pool: 'loose',
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

type Requirement = { loose: number; sealed: number; any: number; name: string };
const ID_RE = /^[a-fA-F0-9]{24}$/;

export class TransactionInventoryService {
  private customBlendService = new CustomBlendService();

  /**
   * Expand a transaction's items into per-product pool requirements.
   *
   * Strict pool enforcement (loose vs sealed) applies only to direct
   * product sales — volume sales must be satisfied by loose stock, sealed
   * sales by sealed stock. Blend ingredients (fixed, bundle-blend,
   * custom) and bundle components use `any` because they draw from total
   * stock: the pharmacist may open a sealed bottle mid-blend, which is
   * semantically a pool transfer rather than a hard availability wall.
   *
   * Non-inventory item types (service/consultation/miscellaneous) and
   * non-ObjectId productIds are skipped — they do not reach stock.
   */
  private async computeRequirements(
    transaction: ITransaction,
    session?: ClientSession,
  ): Promise<Map<string, Requirement>> {
    const reqs = new Map<string, Requirement>();
    const bump = (productId: string, pool: 'loose' | 'sealed' | 'any', qty: number, name: string) => {
      if (!productId || qty <= 0) return;
      const cur = reqs.get(productId) || { loose: 0, sealed: 0, any: 0, name };
      cur[pool] += qty;
      if (!cur.name) cur.name = name;
      reqs.set(productId, cur);
    };

    for (const item of transaction.items) {
      const tx = item as TransactionItem;
      const itemType = tx.itemType || 'product';
      if (NO_INVENTORY_TYPES.has(itemType)) continue;

      if (itemType === 'product') {
        if (!tx.productId || !ID_RE.test(tx.productId)) continue;
        const pool = tx.saleType === 'volume' ? 'loose' : 'sealed';
        bump(tx.productId, pool, Number(tx.convertedQuantity ?? 0), tx.name);
      } else if (itemType === 'fixed_blend') {
        if (!tx.productId || !ID_RE.test(tx.productId)) continue;
        const template = await BlendTemplate.findById(tx.productId).session(session || null).lean() as
          | { ingredients: Array<{ productId: unknown; quantity: number; name: string }> }
          | null;
        if (!template) continue;
        for (const ing of template.ingredients) {
          const scaled = Number(ing.quantity) * Number(tx.quantity ?? 1);
          bump(String(ing.productId), 'any', scaled, ing.name);
        }
      } else if (itemType === 'bundle') {
        if (!tx.productId || !ID_RE.test(tx.productId)) continue;
        const bundle = await Bundle.findById(tx.productId).session(session || null).lean() as
          | { bundleProducts: Array<{ productId: unknown; productType?: string; blendTemplateId?: unknown; quantity: number; name: string }> }
          | null;
        if (!bundle) continue;
        for (const bp of bundle.bundleProducts) {
          const totalQty = Number(bp.quantity) * Number(tx.quantity ?? 1);
          if (bp.productType === 'fixed_blend' && bp.blendTemplateId) {
            const template = await BlendTemplate.findById(bp.blendTemplateId).session(session || null).lean() as
              | { ingredients: Array<{ productId: unknown; quantity: number; name: string }> }
              | null;
            if (!template) continue;
            for (const ing of template.ingredients) {
              bump(String(ing.productId), 'any', Number(ing.quantity) * totalQty, ing.name);
            }
          } else {
            bump(String(bp.productId), 'any', totalQty, bp.name);
          }
        }
      } else if (itemType === 'custom_blend') {
        const blendData = tx.customBlendData;
        if (!blendData?.ingredients) continue;
        // Matches CustomBlendService.deductCustomBlendIngredients: ingredient
        // quantities are absolute per this blend, not scaled by item.quantity.
        for (const ing of blendData.ingredients) {
          if (!ing.productId || !ID_RE.test(String(ing.productId))) continue;
          bump(String(ing.productId), 'any', Number(ing.quantity ?? 0), ing.name || '');
        }
      }
    }
    return reqs;
  }

  /**
   * Compute the shortages a transaction would incur against current stock.
   *
   * Sell-through-permissive policy: this method does NOT throw. Sales are
   * allowed to push stock negative; the returned list is informational so
   * callers can surface "stock owed" warnings or skip them entirely. Kept
   * around for diagnostic endpoints; the patient-flow path no longer calls it.
   */
  async checkAvailability(
    transaction: ITransaction,
    session?: ClientSession,
  ): Promise<InsufficientStockDetail[]> {
    const reqs = await this.computeRequirements(transaction, session);
    if (reqs.size === 0) return [];

    const ids = Array.from(reqs.keys())
      .filter((id) => ID_RE.test(id))
      .map((id) => new mongoose.Types.ObjectId(id));
    if (ids.length === 0) return [];

    const products = (await Product.find({ _id: { $in: ids } })
      .select('_id name currentStock looseStock')
      .session(session || null)
      .lean()) as unknown as Array<{ _id: mongoose.Types.ObjectId; name: string; currentStock: number; looseStock?: number }>;

    const map = new Map(products.map((p) => [String(p._id), p]));

    const shortages: InsufficientStockDetail[] = [];
    for (const [productId, req] of reqs.entries()) {
      const p = map.get(productId);
      if (!p) {
        shortages.push({
          productId,
          productName: req.name || 'unknown',
          requested: req.loose + req.sealed + req.any,
          available: 0,
          pool: 'any',
          reason: 'product_not_found',
        });
        continue;
      }
      const currentStock = Number(p.currentStock ?? 0);
      const looseStock = Number(p.looseStock ?? 0);
      const sealedStock = currentStock - looseStock;

      if (req.loose > looseStock) {
        shortages.push({
          productId, productName: p.name,
          requested: req.loose, available: Math.max(0, looseStock),
          pool: 'loose', reason: 'insufficient_stock',
        });
      }
      if (req.sealed > sealedStock) {
        shortages.push({
          productId, productName: p.name,
          requested: req.sealed, available: Math.max(0, sealedStock),
          pool: 'sealed', reason: 'insufficient_stock',
        });
      }
      // For 'any'-pool demand, ensure total demand doesn't exceed total stock.
      const totalDemand = req.any + req.loose + req.sealed;
      if (req.any > 0 && totalDemand > currentStock) {
        shortages.push({
          productId, productName: p.name,
          requested: req.any, available: Math.max(0, currentStock - req.loose - req.sealed),
          pool: 'any', reason: 'insufficient_stock',
        });
      }
    }

    return shortages;
  }

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
      // Check if movements have been reversed (cancelled transaction being re-opened)
      const reversals = await InventoryMovement.find({
        reference: `CANCEL-${transaction.transactionNumber}`
      }).session(session || null);

      // If fully reversed (same count of reversals as originals), allow fresh deduction
      if (reversals.length > 0 && reversals.length === existing.length) {
        console.log(`[TIS] Transaction ${transaction.transactionNumber} was previously reversed — allowing fresh deduction`);
        // Continue to process inventory normally
      } else {
        result.warnings.push(`Inventory movements already exist (${existing.length}). Skipping to prevent duplicate deduction.`);
        result.movements = existing;
        return result;
      }
    }

    // Sell-through-permissive policy: no pre-check. Sales proceed even when
    // stock would go negative; the resulting deficit appears in reports as
    // "stock owed" for admin reconciliation.
    for (const item of transaction.items) {
      try {
        const txItem = item as TransactionItem;
        const itemType = txItem.itemType || 'product';

        if (NO_INVENTORY_TYPES.has(itemType)) continue;

        if (itemType === 'custom_blend') {
          const movements = await this.processCustomBlend(
            txItem,
            transaction,
            userId,
            session,
          );
          for (const m of movements) result.movements.push(m);
          continue;
        }

        const processor = ITEM_PROCESSORS[itemType] || processProduct;
        const movements = await processor(txItem, transaction.transactionNumber, userId, session);
        for (const m of movements) {
          // Check for error sentinels from bundle processor
          if ((m as unknown as Record<string, unknown>).__error) {
            result.errors.push((m as unknown as Record<string, unknown>).__error as string);
          } else {
            result.movements.push(m);
          }
        }
      } catch (error) {
        // Sell-through policy: stock-shortage errors no longer surface here.
        // Any error reaching this catch is a real failure — log and continue.
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

    // A completed transaction can be edited multiple times after the initial
    // sale. Each edit lays down EDIT-${txn} movements that adjust stock by
    // the qty delta — these are *also* part of the transaction's net stock
    // impact and must be reversed when the transaction is cancelled,
    // otherwise edited-then-cancelled transactions leave a residue.
    const originals = await InventoryMovement.find({
      $or: [
        { reference: transactionNumber, movementType: { $in: REVERSIBLE_TYPES } },
        // EDIT movements only ever come from updateTransaction's delta loop,
        // which writes 'sale' for upward edits and 'return' for downward.
        { reference: `EDIT-${transactionNumber}`, movementType: { $in: ['sale', 'return'] } },
      ],
    }).session(session || null);

    result.originalMovementCount = originals.length;
    if (!originals.length) {
      result.warnings.push(`No movements found for ${transactionNumber}.`);
      return result;
    }

    for (const orig of originals) {
      try {
        // Reversal must cancel the original direction, not always restore
        // stock. Original DECREASE types (sale, blend, bundle_sale, etc.) get
        // reversed with 'return' (an INCREASE). Original INCREASE types
        // (a 'return' movement from a downward edit) get reversed with 'sale'
        // (a DECREASE) so the cancellation actually unwinds them rather than
        // double-restoring.
        const wasIncrease = orig.movementType === 'return' || orig.movementType === 'adjustment';
        const reversalType = wasIncrease ? 'sale' : 'return';

        const reversal = await createMovement({
          productId: orig.productId,
          movementType: reversalType,
          quantity: orig.quantity, convertedQuantity: orig.convertedQuantity,
          unitOfMeasurementId: orig.unitOfMeasurementId,
          baseUnit: orig.baseUnit,
          reference: `CANCEL-${transactionNumber}`,
          notes: `Cancellation reversal for ${orig.movementType}: ${orig.notes || ''}`,
          createdBy: userId, productName: orig.productName,
          pool: (orig as any).pool || 'any',
        }, session);

        result.reversedMovements.push(reversal);
        result.reversedCount++;
      } catch (error) {
        result.errors.push(`Failed to reverse ${orig.productName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return result;
  }

  /**
   * Deduct ingredient stock for a custom_blend item and record a
   * CustomBlendHistory entry. Runs inside the outer mongoose session so
   * movements, stock, and the history record commit atomically with the
   * parent transaction.
   */
  private async processCustomBlend(
    item: TransactionItem,
    transaction: ITransaction,
    userId: string,
    session?: ClientSession,
  ): Promise<IInventoryMovement[]> {
    const blendData = item.customBlendData;
    if (!blendData || !blendData.ingredients || blendData.ingredients.length === 0) {
      return [];
    }

    const unitPrice = (item as unknown as { unitPrice?: number }).unitPrice ?? 0;
    const totalIngredientCost = blendData.totalIngredientCost || 0;
    const mixedBy = blendData.mixedBy || userId;
    const transactionId = (transaction as unknown as { _id: unknown })._id;

    const movements = await this.customBlendService.deductCustomBlendIngredients(
      blendData.ingredients as unknown as Parameters<
        typeof this.customBlendService.deductCustomBlendIngredients
      >[0],
      String(transactionId),
      transaction.transactionNumber,
      mixedBy,
      session,
    );

    // Capture a per-sale recipe snapshot. Pre-save middleware computes signatureHash.
    const history = new CustomBlendHistory({
      blendName: blendData.name || item.name,
      customerId: transaction.customerId,
      customerName: transaction.customerName || 'Walk-in Customer',
      customerEmail: transaction.customerEmail,
      customerPhone: transaction.customerPhone,
      ingredients: blendData.ingredients,
      totalIngredientCost,
      sellingPrice: unitPrice,
      marginPercent: unitPrice > 0
        ? ((unitPrice - totalIngredientCost) / unitPrice) * 100
        : 0,
      preparationNotes: blendData.preparationNotes,
      mixedBy,
      transactionId,
      transactionNumber: transaction.transactionNumber,
      createdBy: userId,
    });

    if (session) {
      await history.save({ session });
    } else {
      await history.save();
    }

    return movements;
  }
}

export const transactionInventoryService = new TransactionInventoryService();
