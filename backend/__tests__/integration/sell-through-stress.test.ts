/**
 * Sell-through-permissive policy stress test.
 *
 * Hammer the new "no blocking" policy under load and across edge cases:
 *
 *   1.  Massive concurrent oversells on a single product (100 × 5 sales vs stock=0)
 *   2.  Interleaved oversells + refunds + restocks on the same product
 *   3.  Deep deficit recovery chain (sell to −1000, restock partial, end at 0)
 *   4.  Idempotency: replay an oversold transaction → no double-deduction
 *   5.  Bundle with all components oversold in one shot
 *   6.  Custom blend with every ingredient oversold (5-ingredient burst)
 *   7.  Pool semantics under negative stock — looseStock collapses to 0
 *   8.  Volume sale (loose pool) at currentStock = 0 → succeeds, no crash
 *   9.  Inventory valuation clamps to non-negative even at deep deficit
 *  10.  Stock-status surfaces 'owed' for negative inventory in reports
 *  11.  Refund of an oversold transaction passes through zero into positive
 *  12.  Multi-item transaction: every line oversells; all movements written
 *
 * The atomic $add pipeline inside `InventoryMovement.updateProductStock`
 * still runs in a single round trip per movement, so concurrent oversells
 * are race-consistent — they no longer race-fail, but they still race-correct.
 */

process.env.JWT_SECRET = 'test-secret';

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import mongoose from 'mongoose';

import { clearUserCache } from '../../middlewares/auth.middleware.js';

import {
  createTestProduct,
  createTestUnit,
  createTestTransactionItem,
  createTestTransaction,
  createTestBlendTemplate,
  createTestBundle,
  Product,
  InventoryMovement,
} from '../setup/test-fixtures.js';
import { teardownTestDB } from '../setup/mongodb-memory-server.js';
import {
  setupReplSetDB,
  teardownReplSetDB,
  clearReplSetCollections,
} from '../setup/mongodb-replset-server.js';

import { TransactionInventoryService } from '../../services/TransactionInventoryService.js';
import { Transaction } from '../../models/Transaction.js';
import { RestockService } from '../../services/inventory/RestockService.js';
import { InventoryAnalysisService } from '../../services/InventoryAnalysisService.js';
import { InventoryCostService } from '../../services/InventoryCostService.js';

beforeAll(async () => {
  await teardownTestDB();
  await setupReplSetDB();
}, 60_000);

afterAll(async () => {
  await teardownReplSetDB();
}, 30_000);

beforeEach(async () => {
  await clearReplSetCollections();
  clearUserCache();
});

// ────────────────────────────────────────────────────────────────────
// 1. Massive concurrent oversells against a single product
// ────────────────────────────────────────────────────────────────────
describe('Sell-through stress — concurrent oversells', () => {
  let tis: TransactionInventoryService;
  beforeAll(() => { tis = new TransactionInventoryService(); });

  it('100 concurrent sales of 5 vs stock=0 all succeed; stock = -500; 100 movements', async () => {
    const unit = await createTestUnit({ name: 'ml' });
    const product = await createTestProduct({
      unitOfMeasurement: unit._id as mongoose.Types.ObjectId,
      currentStock: 0, availableStock: 0,
      sellingPrice: 25, costPrice: 10,
    });

    const SALES = 100;
    const QTY = 5;

    const outcomes = await Promise.all(
      Array.from({ length: SALES }, async (_, i) => {
        const item = createTestTransactionItem({
          productId: String(product._id),
          name: product.name,
          quantity: QTY,
          convertedQuantity: QTY,
          unitPrice: 25,
          totalPrice: 25 * QTY,
        });
        const tx = await Transaction.create(
          createTestTransaction([item], { transactionNumber: `MASS-${i}` }),
        );
        const result = await tis.processTransactionInventory(tx as any, 'stress-user');
        return result.errors.length === 0;
      }),
    );

    expect(outcomes.every(Boolean)).toBe(true);

    const after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(-(SALES * QTY)); // -500

    const movementCount = await InventoryMovement.countDocuments({
      productId: product._id,
      movementType: 'sale',
    });
    expect(movementCount).toBe(SALES);
  }, 60_000);

  it('interleaved sales + refunds + restocks: final stock matches algebraic sum exactly', async () => {
    const unit = await createTestUnit({ name: 'ml' });
    const product = await createTestProduct({
      unitOfMeasurement: unit._id as mongoose.Types.ObjectId,
      currentStock: 50, availableStock: 50, costPrice: 10,
    });

    const sellTx = async (n: number, qty: number) => {
      const item = createTestTransactionItem({
        productId: String(product._id),
        name: product.name,
        quantity: qty, convertedQuantity: qty,
        unitPrice: 25, totalPrice: 25 * qty,
      });
      const tx = await Transaction.create(
        createTestTransaction([item], { transactionNumber: `MIX-SALE-${n}` }),
      );
      return tis.processTransactionInventory(tx as any, 'stress-user');
    };

    const refundTx = async (n: number) =>
      tis.reverseTransactionInventory(`MIX-SALE-${n}`, 'stress-user');

    const restockSvc = new RestockService();
    const restock = (qty: number) =>
      restockSvc.restockProduct({ productId: String(product._id), quantity: qty }, 'stress-user');

    // Plan: 30 concurrent ops → 10 sales, 5 refunds (of earlier sales 0..4), 15 restocks.
    // Sales: 10 × qty=10 = -100
    // Refunds: 5 × qty=10 = +50 (reverse first 5 sales)
    // Restocks: 15 × qty=5 = +75
    // Start: 50 → 50 - 100 + 50 + 75 = 75
    //
    // Sequence the refunds AFTER the sales they reverse so that the original
    // movements exist when we ask to reverse them. Restocks and remaining
    // sales can race freely.

    // Phase 1: all 10 sales concurrently (creates references for refunds).
    const phase1Sales = await Promise.all(
      Array.from({ length: 10 }, (_, i) => sellTx(i, 10)),
    );
    expect(phase1Sales.every((r) => r.errors.length === 0)).toBe(true);

    // Phase 2: 5 refunds + 15 restocks concurrently — these don't interact
    // (refunds reverse already-saved sale movements; restocks are pure +).
    const phase2 = await Promise.all([
      ...Array.from({ length: 5 }, (_, i) => refundTx(i)),
      ...Array.from({ length: 15 }, () => restock(5)),
    ]);
    expect(phase2.every((r) =>
      ('errors' in r ? r.errors.length === 0 : (r as { success?: boolean }).success !== false),
    )).toBe(true);

    const after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(75);
  }, 60_000);
});

// ────────────────────────────────────────────────────────────────────
// 2. Deep deficit and recovery
// ────────────────────────────────────────────────────────────────────
describe('Sell-through stress — deep deficit recovery', () => {
  let tis: TransactionInventoryService;
  beforeAll(() => { tis = new TransactionInventoryService(); });

  it('sells to -1000, then restocks 1500, lands at +500', async () => {
    const unit = await createTestUnit({ name: 'ml' });
    const product = await createTestProduct({
      unitOfMeasurement: unit._id as mongoose.Types.ObjectId,
      currentStock: 0, availableStock: 0, costPrice: 10,
    });

    const item = createTestTransactionItem({
      productId: String(product._id),
      name: product.name,
      quantity: 1000, convertedQuantity: 1000,
      unitPrice: 25, totalPrice: 25_000,
    });
    const tx = await Transaction.create(
      createTestTransaction([item], { transactionNumber: 'DEEP-1' }),
    );
    await tis.processTransactionInventory(tx as any, 'stress-user');

    let after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(-1000);

    const restockSvc = new RestockService();
    const r = await restockSvc.restockProduct(
      { productId: String(product._id), quantity: 1500 },
      'stress-user',
    );
    expect(r.success).toBe(true);

    after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(500);
  });

  it('refund chain pulls deep deficit back through zero into positive', async () => {
    const unit = await createTestUnit({ name: 'ml' });
    const product = await createTestProduct({
      unitOfMeasurement: unit._id as mongoose.Types.ObjectId,
      currentStock: 5, availableStock: 5, costPrice: 10,
    });

    // Sale of 100 → stock 5 → -95.
    const item = createTestTransactionItem({
      productId: String(product._id),
      name: product.name,
      quantity: 100, convertedQuantity: 100,
      unitPrice: 25, totalPrice: 2500,
    });
    const tx = await Transaction.create(
      createTestTransaction([item], { transactionNumber: 'CHAIN-1' }),
    );
    await tis.processTransactionInventory(tx as any, 'stress-user');

    let after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(-95);

    // Refund the sale → -95 + 100 = 5.
    const reversal = await tis.reverseTransactionInventory('CHAIN-1', 'stress-user');
    expect(reversal.errors).toEqual([]);
    expect(reversal.reversedCount).toBe(1);

    after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(5);
  });
});

// ────────────────────────────────────────────────────────────────────
// 3. Idempotency under oversell
// ────────────────────────────────────────────────────────────────────
describe('Sell-through stress — idempotency', () => {
  let tis: TransactionInventoryService;
  beforeAll(() => { tis = new TransactionInventoryService(); });

  it('replaying an oversold transaction does not double-deduct', async () => {
    const unit = await createTestUnit({ name: 'ml' });
    const product = await createTestProduct({
      unitOfMeasurement: unit._id as mongoose.Types.ObjectId,
      currentStock: 0, availableStock: 0, costPrice: 10,
    });

    const item = createTestTransactionItem({
      productId: String(product._id),
      name: product.name,
      quantity: 7, convertedQuantity: 7,
      unitPrice: 25, totalPrice: 175,
    });
    const tx = await Transaction.create(
      createTestTransaction([item], { transactionNumber: 'IDEMP-1' }),
    );

    const r1 = await tis.processTransactionInventory(tx as any, 'stress-user');
    const r2 = await tis.processTransactionInventory(tx as any, 'stress-user');

    expect(r1.errors).toEqual([]);
    // Second call short-circuits: existing movements are returned, no new write.
    expect(r2.warnings.some((w) => /Inventory movements already exist/i.test(w))).toBe(true);

    const after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(-7);

    const movementCount = await InventoryMovement.countDocuments({ reference: 'IDEMP-1' });
    expect(movementCount).toBe(1);
  });
});

// ────────────────────────────────────────────────────────────────────
// 4. Mixed item-type oversells (bundle + custom blend + product) in one txn
// ────────────────────────────────────────────────────────────────────
describe('Sell-through stress — mixed item types', () => {
  let tis: TransactionInventoryService;
  beforeAll(() => { tis = new TransactionInventoryService(); });

  it('one transaction with product + bundle + custom_blend, every line oversells', async () => {
    const unit = await createTestUnit({ name: 'ml' });
    const unitId = unit._id as mongoose.Types.ObjectId;

    // Product with stock 1, sell 5 → -4.
    const plain = await createTestProduct({
      name: 'Plain',
      unitOfMeasurement: unitId,
      currentStock: 1, availableStock: 1, costPrice: 10, containerCapacity: 100,
    });

    // Bundle component with stock 2, bundle needs 5 → -3.
    const comp = await createTestProduct({
      name: 'Comp',
      unitOfMeasurement: unitId,
      currentStock: 2, availableStock: 2, costPrice: 10, containerCapacity: 100,
    });
    const bundle = await createTestBundle(
      [
        {
          productId: comp._id as mongoose.Types.ObjectId,
          name: 'Comp', quantity: 5, productType: 'product',
          unitOfMeasurementId: unitId, unitName: 'ml', individualPrice: 10,
        },
      ],
      { bundlePrice: 30 },
    );

    // Custom blend ingredient with stock 1, blend needs 8 → -7.
    const ing = await createTestProduct({
      name: 'Ing',
      unitOfMeasurement: unitId,
      currentStock: 1, availableStock: 1, costPrice: 5, containerCapacity: 100,
    });
    await Product.updateOne(
      { _id: ing._id },
      { $set: { canSellLoose: true, looseStock: 1 } },
    );

    const productItem = createTestTransactionItem({
      productId: String(plain._id), name: plain.name,
      quantity: 5, convertedQuantity: 5,
      itemType: 'product',
      unitPrice: 25, totalPrice: 125,
    });
    const bundleItem = createTestTransactionItem({
      productId: String(bundle._id), name: bundle.name,
      quantity: 1, convertedQuantity: 1,
      itemType: 'bundle',
      unitPrice: 30, totalPrice: 30,
    });
    const blendItem = createTestTransactionItem({
      productId: 'CUSTOM_BLEND', name: 'Custom Blend',
      quantity: 1, convertedQuantity: 1,
      itemType: 'custom_blend',
      unitPrice: 50, totalPrice: 50,
    });
    (blendItem as any).customBlendData = {
      name: 'Custom Mix',
      ingredients: [
        {
          productId: String(ing._id),
          name: 'Ing',
          quantity: 8,
          unitOfMeasurementId: String(unitId),
          unitName: 'ml',
          costPerUnit: 5,
          sellingPricePerUnit: 10,
        },
      ],
      totalIngredientCost: 40,
      mixedBy: 'stress-user',
      mixedAt: new Date(),
    };

    const tx = await Transaction.create(createTestTransaction(
      [productItem, bundleItem, blendItem],
      { transactionNumber: 'MIX-OVERSELL-1' },
    ));

    const result = await tis.processTransactionInventory(tx as any, 'stress-user');
    expect(result.errors).toEqual([]);

    const afterPlain = await Product.findById(plain._id);
    const afterComp = await Product.findById(comp._id);
    const afterIng = await Product.findById(ing._id);

    expect(afterPlain!.currentStock).toBe(-4);   // 1 - 5
    expect(afterComp!.currentStock).toBe(-3);    // 2 - 5
    expect(afterIng!.currentStock).toBe(-7);     // 1 - 8

    // 3 movements: sale (plain), bundle_sale (comp), custom_blend (ing)
    const movements = await InventoryMovement.find({ reference: 'MIX-OVERSELL-1' });
    expect(movements.length).toBe(3);
  });
});

// ────────────────────────────────────────────────────────────────────
// 5. Custom blend with all ingredients oversold simultaneously
// ────────────────────────────────────────────────────────────────────
describe('Sell-through stress — custom blend bursts', () => {
  let tis: TransactionInventoryService;
  beforeAll(() => { tis = new TransactionInventoryService(); });

  it('5-ingredient custom blend with every ingredient at stock=0 succeeds', async () => {
    const unit = await createTestUnit({ name: 'ml' });
    const unitId = unit._id as mongoose.Types.ObjectId;

    const ings = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        createTestProduct({
          name: `Ing-${i}`,
          unitOfMeasurement: unitId,
          currentStock: 0, availableStock: 0, costPrice: 5, containerCapacity: 100,
        }),
      ),
    );
    await Product.updateMany(
      { _id: { $in: ings.map((p) => p._id) } },
      { $set: { canSellLoose: true } },
    );

    const burstItem = createTestTransactionItem({
      productId: 'CUSTOM_BLEND', name: 'Custom Mix',
      quantity: 1, convertedQuantity: 1,
      itemType: 'custom_blend',
      unitPrice: 100, totalPrice: 100,
    });
    (burstItem as any).customBlendData = {
      name: 'Burst',
      ingredients: ings.map((p, i) => ({
        productId: String(p._id),
        name: `Ing-${i}`,
        quantity: 10,
        unitOfMeasurementId: String(unitId),
        unitName: 'ml',
        costPerUnit: 5,
        sellingPricePerUnit: 10,
      })),
      totalIngredientCost: 250,
      mixedBy: 'stress-user',
      mixedAt: new Date(),
    };

    const tx = await Transaction.create(createTestTransaction(
      [burstItem],
      { transactionNumber: 'BURST-1' },
    ));

    const result = await tis.processTransactionInventory(tx as any, 'stress-user');
    expect(result.errors).toEqual([]);

    for (const ing of ings) {
      const after = await Product.findById(ing._id);
      expect(after!.currentStock).toBe(-10);
    }

    const movements = await InventoryMovement.countDocuments({
      reference: 'BURST-1',
      movementType: 'custom_blend',
    });
    expect(movements).toBe(5);
  });
});

// ────────────────────────────────────────────────────────────────────
// 6. Pool semantics under deep negative
// ────────────────────────────────────────────────────────────────────
describe('Sell-through stress — pool semantics under negative', () => {
  let tis: TransactionInventoryService;
  beforeAll(() => { tis = new TransactionInventoryService(); });

  it('volume sale (loose pool) at currentStock=0 with looseStock=0 succeeds; looseStock stays 0', async () => {
    const unit = await createTestUnit({ name: 'ml' });
    const product = await createTestProduct({
      unitOfMeasurement: unit._id as mongoose.Types.ObjectId,
      currentStock: 0, availableStock: 0, costPrice: 10, containerCapacity: 100,
    });
    await Product.updateOne(
      { _id: product._id },
      { $set: { canSellLoose: true, looseStock: 0 } },
    );

    const item = createTestTransactionItem({
      productId: String(product._id),
      name: product.name,
      quantity: 30, convertedQuantity: 30,
      saleType: 'volume',
      unitPrice: 1, totalPrice: 30,
    });
    const tx = await Transaction.create(
      createTestTransaction([item], { transactionNumber: 'VOL-OVERSELL-1' }),
    );

    const result = await tis.processTransactionInventory(tx as any, 'stress-user');
    expect(result.errors).toEqual([]);

    const after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(-30);
    // looseStock pipeline: $max(0, $min(looseStock + delta, currentStock)) →
    // $max(0, $min(-30, -30)) = 0. Loose stock cannot go negative; the deficit
    // is carried by the (computed) sealed pool: currentStock − looseStock = -30.
    expect(after!.looseStock).toBe(0);
  });

  it('after deep deficit, sealed pool computation is negative; loose stays at 0', async () => {
    const unit = await createTestUnit({ name: 'ml' });
    const product = await createTestProduct({
      unitOfMeasurement: unit._id as mongoose.Types.ObjectId,
      currentStock: 100, availableStock: 100, costPrice: 10, containerCapacity: 100,
    });
    await Product.updateOne(
      { _id: product._id },
      { $set: { canSellLoose: true, looseStock: 50 } },
    );

    // Sealed sale of 200 (we only have 50 sealed) → loose stays 50?
    // Actually: sale pool='sealed' decrements currentStock by 200 → -100;
    // pre-clamp pipeline brings looseStock to min(50, -100)=-100 then max(0,-100)=0.
    const item = createTestTransactionItem({
      productId: String(product._id),
      name: product.name,
      quantity: 2, convertedQuantity: 200,
      saleType: 'quantity',
      unitPrice: 25, totalPrice: 50,
    });
    const tx = await Transaction.create(
      createTestTransaction([item], { transactionNumber: 'SEAL-OVERSELL-1' }),
    );

    const result = await tis.processTransactionInventory(tx as any, 'stress-user');
    expect(result.errors).toEqual([]);

    const after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(-100);
    expect(after!.looseStock).toBe(0);
    // Sealed = currentStock − looseStock = -100 (deficit lives in sealed pool).
    expect(after!.currentStock - (after!.looseStock ?? 0)).toBe(-100);
  });
});

// ────────────────────────────────────────────────────────────────────
// 7. Reports: valuation clamped, status surfaces 'owed'
// ────────────────────────────────────────────────────────────────────
describe('Sell-through stress — reports clamp + status', () => {
  let tis: TransactionInventoryService;
  beforeAll(() => { tis = new TransactionInventoryService(); });

  it('InventoryAnalysisService never emits negative total_value; surfaces owed status', async () => {
    const unit = await createTestUnit({ name: 'ml' });
    const product = await createTestProduct({
      unitOfMeasurement: unit._id as mongoose.Types.ObjectId,
      currentStock: 0, availableStock: 0,
      sellingPrice: 25, costPrice: 10,
      containerCapacity: 100,
    });

    // Drive currentStock to -5000 (worst-case deficit).
    const item = createTestTransactionItem({
      productId: String(product._id),
      name: product.name,
      quantity: 5000, convertedQuantity: 5000,
      unitPrice: 25, totalPrice: 125_000,
    });
    const tx = await Transaction.create(
      createTestTransaction([item], { transactionNumber: 'CLAMP-1' }),
    );
    await tis.processTransactionInventory(tx as any, 'stress-user');

    const after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(-5000);

    const analysis = await InventoryAnalysisService.getInventoryAnalysis();
    const row = analysis.inventoryData.find((r) => r.id === String(product._id))!;
    expect(row).toBeDefined();
    expect(row.total_value).toBe(0);   // Clamped: max(0, -5000) × 10 = 0
    expect(row.status).toBe('owed');

    // Status summary surfaces a 'Stock Owed' bucket with abs(deficit) × cost.
    const owedRow = analysis.stockStatus.find((s) => s.status === 'Stock Owed')!;
    expect(owedRow).toBeDefined();
    expect(owedRow.count).toBe(1);
    expect(owedRow.value).toBe(50_000);   // |−5000| × 10

    // Summary metric — totalValue floored at 0.
    expect(analysis.summary?.totalValue ?? 0).toBeGreaterThanOrEqual(0);
  });

  it('InventoryCostService also clamps total_cost and emits owed', async () => {
    const unit = await createTestUnit({ name: 'ml' });
    const product = await createTestProduct({
      unitOfMeasurement: unit._id as mongoose.Types.ObjectId,
      currentStock: 0, availableStock: 0, costPrice: 7,
    });

    const item = createTestTransactionItem({
      productId: String(product._id),
      name: product.name,
      quantity: 200, convertedQuantity: 200,
      unitPrice: 25, totalPrice: 5000,
    });
    const tx = await Transaction.create(
      createTestTransaction([item], { transactionNumber: 'CLAMP-COST-1' }),
    );
    await tis.processTransactionInventory(tx as any, 'stress-user');

    const cost = await InventoryCostService.getInventoryCostAnalysis();
    const row = cost.inventoryCostData.find((r) => r.product_name === product.name)!;
    expect(row).toBeDefined();
    expect(row.total_cost).toBe(0);     // Clamped: max(0, -200) × 7 = 0
    expect(row.stock_status).toBe('owed');

    expect(cost.summary.totalInventoryValue).toBeGreaterThanOrEqual(0);
  });
});

// ────────────────────────────────────────────────────────────────────
// 8. Multi-line transaction: every line oversells, all movements written
// ────────────────────────────────────────────────────────────────────
describe('Sell-through stress — multi-line transaction', () => {
  let tis: TransactionInventoryService;
  beforeAll(() => { tis = new TransactionInventoryService(); });

  it('20-line transaction with every product at stock=0 produces 20 sale movements', async () => {
    const unit = await createTestUnit({ name: 'ml' });
    const products = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        createTestProduct({
          name: `P-${i}`,
          unitOfMeasurement: unit._id as mongoose.Types.ObjectId,
          currentStock: 0, availableStock: 0, costPrice: 5, sellingPrice: 10,
        }),
      ),
    );

    const items = products.map((p, i) =>
      createTestTransactionItem({
        productId: String(p._id),
        name: p.name,
        quantity: i + 1,
        convertedQuantity: i + 1,
        unitPrice: 10, totalPrice: 10 * (i + 1),
      }),
    );

    const tx = await Transaction.create(
      createTestTransaction(items, { transactionNumber: 'MULTI-1' }),
    );

    const result = await tis.processTransactionInventory(tx as any, 'stress-user');
    expect(result.errors).toEqual([]);
    expect(result.movements.length).toBe(20);

    for (let i = 0; i < products.length; i++) {
      const after = await Product.findById(products[i]._id);
      expect(after!.currentStock).toBe(-(i + 1));
    }

    expect(await InventoryMovement.countDocuments({ reference: 'MULTI-1' })).toBe(20);
  }, 30_000);
});

// ────────────────────────────────────────────────────────────────────
// 9. Conservation invariant — sum of movements equals stock delta
// ────────────────────────────────────────────────────────────────────
describe('Sell-through stress — conservation invariant', () => {
  let tis: TransactionInventoryService;
  beforeAll(() => { tis = new TransactionInventoryService(); });

  it('Σ(movement convertedQuantity) == initialStock − currentStock across 50 mixed sales', async () => {
    const unit = await createTestUnit({ name: 'ml' });
    const product = await createTestProduct({
      unitOfMeasurement: unit._id as mongoose.Types.ObjectId,
      currentStock: 100, availableStock: 100, costPrice: 10, sellingPrice: 25,
    });

    const SALES = 50;
    const quantities = Array.from({ length: SALES }, (_, i) => 1 + (i % 7)); // 1..7 cycle

    await Promise.all(
      quantities.map(async (qty, i) => {
        const item = createTestTransactionItem({
          productId: String(product._id),
          name: product.name,
          quantity: qty, convertedQuantity: qty,
          unitPrice: 25, totalPrice: 25 * qty,
        });
        const tx = await Transaction.create(
          createTestTransaction([item], { transactionNumber: `CONS-${i}` }),
        );
        await tis.processTransactionInventory(tx as any, 'stress-user');
      }),
    );

    const after = await Product.findById(product._id);
    const expectedDelta = quantities.reduce((a, b) => a + b, 0);
    expect(100 - after!.currentStock).toBe(expectedDelta);

    const movements = await InventoryMovement.find({ movementType: 'sale', productId: product._id });
    const movementSum = movements.reduce((sum, m) => sum + m.convertedQuantity, 0);
    expect(movementSum).toBe(expectedDelta);
  }, 60_000);
});
