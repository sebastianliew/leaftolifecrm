/**
 * Empirical audit of deduction-adjacent code paths outside blends.
 *
 * For each surface we drive the real service (not mocks) against
 * mongodb-memory-server and assert what actually happens. Tests that
 * currently pass while asserting broken behavior serve as regression guards;
 * the assertions are meant to be flipped once each is fixed.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import mongoose from 'mongoose';
import {
  createTestProduct,
  createTestUnit,
  createTestBlendTemplate,
  createTestBundle,
  createTestTransactionItem,
  createTestTransaction,
  Product,
  InventoryMovement,
} from '../setup/test-fixtures.js';
import { teardownTestDB } from '../setup/mongodb-memory-server.js';
import {
  setupReplSetDB,
  teardownReplSetDB,
  clearReplSetCollections as clearCollections,
} from '../setup/mongodb-replset-server.js';

import { TransactionInventoryService } from '../../services/TransactionInventoryService.js';
import { RefundService } from '../../services/RefundService.js';
import { RestockService } from '../../services/inventory/RestockService.js';
import { validatePoolAllocation } from '../../services/inventory/StockPoolService.js';
import { Transaction } from '../../models/Transaction.js';
import { Refund } from '../../models/Refund.js';

// Replace the global standalone Mongo server with a replica set so tests
// that open mongoose sessions (refunds, inventory with session) can run.
beforeAll(async () => {
  await teardownTestDB();
  await setupReplSetDB();
}, 60_000);

afterAll(async () => {
  await teardownReplSetDB();
}, 30_000);

// ────────────────────────────────────────────────────────────────────
// Surface 1 — Customer credit balance (offset_from_credit payment method)
// ────────────────────────────────────────────────────────────────────
describe('Deduction surface — customer credit balance', () => {
  let tis: TransactionInventoryService;
  beforeAll(() => { tis = new TransactionInventoryService(); });
  beforeEach(async () => { await clearCollections(); });

  it('REGRESSION: paymentMethod=offset_from_credit does NOT decrement any balance anywhere', async () => {
    // PatientEnrichment.outstandingBalance is the only balance-ish field in the
    // codebase. The grep audit found zero writers outside the schema default.
    // This test saves a transaction that "pays" with credit and asserts
    // nothing has been drawn down.
    const unit = await createTestUnit({ name: 'ml' });
    const product = await createTestProduct({
      unitOfMeasurement: unit._id as mongoose.Types.ObjectId,
      currentStock: 100,
      availableStock: 100,
      sellingPrice: 50,
      costPrice: 20,
    });

    // Seed a PatientEnrichment with a pretend $200 credit ("customer has prepaid").
    // We store the credit as a negative outstandingBalance (the convention would be
    // whatever the writer establishes; there is no writer, which is the point).
    const PatientEnrichment = mongoose.models.PatientEnrichment
      || mongoose.model('PatientEnrichment', new mongoose.Schema({
        financialSummary: { outstandingBalance: { type: Number, default: 0 } },
      }, { strict: false }));

    const enrichment = await PatientEnrichment.create({
      financialSummary: { outstandingBalance: -200 }, // pretend $200 in credit
    });

    // Build a transaction using the credit payment method
    const item = createTestTransactionItem({
      productId: String(product._id),
      name: product.name,
      quantity: 1,
      convertedQuantity: 1,
      unitPrice: 50,
      totalPrice: 50,
    });
    const txData = {
      ...createTestTransaction([item], {
        transactionNumber: 'CREDIT-PAY-1',
        paymentMethod: 'offset_from_credit',
        paymentStatus: 'paid',
        paidAmount: 50,
      }),
      customerId: String(enrichment._id),
    };

    const savedTx = await Transaction.create(txData);
    const result = await tis.processTransactionInventory(savedTx as any, 'stress-user');
    expect(result.errors).toEqual([]);

    // Inventory moved (confirms the transaction actually processed)
    const movements = await InventoryMovement.countDocuments({ reference: 'CREDIT-PAY-1' });
    expect(movements).toBe(1);

    // But the credit balance is UNCHANGED — nothing wired up
    const after = await PatientEnrichment.findById(enrichment._id) as any;
    expect(after.financialSummary.outstandingBalance).toBe(-200);

    // And no offset-tracking document exists (nothing creates one)
    const ledgerCols = mongoose.connection.collections;
    for (const key of Object.keys(ledgerCols)) {
      if (/credit|ledger|balance/i.test(key)) {
        const n = await ledgerCols[key].countDocuments({});
        expect(n).toBe(0);
      }
    }
  });
});

// ────────────────────────────────────────────────────────────────────
// Surface 2 — Refund inventory restoration
// ────────────────────────────────────────────────────────────────────
describe('Deduction surface — refund inventory restoration', () => {
  let tis: TransactionInventoryService;
  beforeAll(() => { tis = new TransactionInventoryService(); });
  beforeEach(async () => { await clearCollections(); });

  it('RefundService.createRefund auto-generates refundNumber via pre-validate and persists successfully', async () => {
    // Guards the D2 fix: refundNumber generation moved from pre('save') to
    // pre('validate'), so required-field validation sees a populated value.
    const unit = await createTestUnit({ name: 'ml' });
    const product = await createTestProduct({
      unitOfMeasurement: unit._id as mongoose.Types.ObjectId,
      currentStock: 100,
      availableStock: 100,
      sellingPrice: 50,
      costPrice: 20,
      containerCapacity: 1,
    });
    const item = createTestTransactionItem({
      productId: String(product._id),
      name: product.name,
      quantity: 1,
      convertedQuantity: 1,
      unitPrice: 50,
      totalPrice: 50,
    });
    const savedTx = await Transaction.create(
      createTestTransaction([item], { transactionNumber: 'REFUND-OK-1' }),
    );
    await tis.processTransactionInventory(savedTx as any, 'stress-user');

    const refund = await RefundService.createRefund(String(savedTx._id), {
      items: [{ productId: String(product._id), refundQuantity: 1 }],
      refundReason: 'customer_request',
      refundMethod: 'cash',
      createdBy: 'stress-user',
    });

    expect(refund).toBeTruthy();
    expect(refund.refundNumber).toMatch(/^REF-\d{8}-\d{4}$/);
    expect(refund.status).toBe('pending');
  });

  it('processRefund restores product stock when the Refund doc is built manually (bypassing the pre-save bug)', async () => {
    const unit = await createTestUnit({ name: 'ml' });
    const product = await createTestProduct({
      unitOfMeasurement: unit._id as mongoose.Types.ObjectId,
      currentStock: 100,
      availableStock: 100,
      sellingPrice: 50,
      costPrice: 20,
      containerCapacity: 1,
    });

    const item = createTestTransactionItem({
      productId: String(product._id),
      name: product.name,
      quantity: 3,
      convertedQuantity: 3,
      unitPrice: 50,
      totalPrice: 150,
      saleType: 'quantity',
    });
    const savedTx = await Transaction.create(
      createTestTransaction([item], { transactionNumber: 'REFUND-DIRECT-1' }),
    );
    await tis.processTransactionInventory(savedTx as any, 'stress-user');
    let current = await Product.findById(product._id);
    expect(current!.currentStock).toBe(97);

    // Build the Refund doc directly (skipping the broken createRefund path)
    const refund = await Refund.create({
      refundNumber: 'REF-STRESS-1',
      transactionId: savedTx._id,
      transactionNumber: savedTx.transactionNumber,
      customerName: savedTx.customerName,
      items: [{
        productId: String(product._id),
        productName: product.name,
        originalQuantity: 3,
        refundQuantity: 3,
        unitPrice: 50,
        refundAmount: 150,
      }],
      originalAmount: 150,
      refundAmount: 150,
      refundMethod: 'cash',
      refundReason: 'customer_request',
      refundType: 'full',
      status: 'approved',
      createdBy: 'stress-user',
    });

    await RefundService.processRefund(String(refund._id), 'stress-user');
    current = await Product.findById(product._id);
    expect(current!.currentStock).toBe(100);
  });

  it('processRefund now restores ingredient stock when refunding a fixed_blend line', async () => {
    // Guards the D3 fix: processRefund falls back to BlendTemplate/Bundle lookups
    // when productId isn't a Product, and restores each ingredient.
    const unit = await createTestUnit({ name: 'ml' });
    const unitId = unit._id as mongoose.Types.ObjectId;
    const ingredientA = await createTestProduct({
      name: 'Ingredient-A',
      unitOfMeasurement: unitId,
      currentStock: 1000,
      availableStock: 1000,
      costPrice: 50,
      containerCapacity: 500,
    });
    const ingredientB = await createTestProduct({
      name: 'Ingredient-B',
      unitOfMeasurement: unitId,
      currentStock: 1000,
      availableStock: 1000,
      costPrice: 80,
      containerCapacity: 500,
    });

    const template = await createTestBlendTemplate(
      [
        { productId: ingredientA._id as mongoose.Types.ObjectId, name: 'Ingredient-A', quantity: 10, unitOfMeasurementId: unitId, unitName: 'ml' },
        { productId: ingredientB._id as mongoose.Types.ObjectId, name: 'Ingredient-B', quantity: 5, unitOfMeasurementId: unitId, unitName: 'ml' },
      ],
      { unitOfMeasurementId: unitId, unitName: 'ml' },
    );

    const item = createTestTransactionItem({
      productId: String(template._id),
      name: template.name,
      itemType: 'fixed_blend',
      quantity: 2,
      convertedQuantity: 2,
      unitPrice: 40,
      totalPrice: 80,
    });
    const savedTx = await Transaction.create(
      createTestTransaction([item], { transactionNumber: 'REFUND-BLEND-DIRECT-1' }),
    );
    await tis.processTransactionInventory(savedTx as any, 'stress-user');

    // Ingredients drawn down: A=20 (10×2), B=10 (5×2)
    let a = await Product.findById(ingredientA._id);
    let b = await Product.findById(ingredientB._id);
    expect(a!.currentStock).toBe(980);
    expect(b!.currentStock).toBe(990);

    const refund = await Refund.create({
      refundNumber: 'REF-STRESS-BLEND-1',
      transactionId: savedTx._id,
      transactionNumber: savedTx.transactionNumber,
      customerName: savedTx.customerName,
      items: [{
        productId: String(template._id),
        productName: template.name,
        originalQuantity: 2,
        refundQuantity: 2,
        unitPrice: 40,
        refundAmount: 80,
      }],
      originalAmount: 80,
      refundAmount: 80,
      refundMethod: 'cash',
      refundReason: 'customer_request',
      refundType: 'full',
      status: 'approved',
      createdBy: 'stress-user',
    });

    await RefundService.processRefund(String(refund._id), 'stress-user');

    // Both ingredients fully restored (A: +20, B: +10)
    a = await Product.findById(ingredientA._id);
    b = await Product.findById(ingredientB._id);
    expect(a!.currentStock).toBe(1000);
    expect(b!.currentStock).toBe(1000);

    const returns = await InventoryMovement.find({
      reference: { $regex: /^REFUND-/ },
      movementType: 'return',
    });
    expect(returns).toHaveLength(2);
  });
});

// ────────────────────────────────────────────────────────────────────
// Surface 3 — Pool transfer concurrency (open/close container)
// ────────────────────────────────────────────────────────────────────
describe('Deduction surface — pool transfer concurrency', () => {
  beforeEach(async () => { await clearCollections(); });

  it('REGRESSION: concurrent opens past available sealed stock all succeed (TOCTOU)', async () => {
    // The controller's manageProductPool does: validatePoolAllocation (reads current
    // sealed stock) → create movement → updateProductStock. Validation uses the
    // stock read at check time; nothing prevents N parallel opens from all passing.
    const unit = await createTestUnit({ name: 'ml' });
    const product = await createTestProduct({
      unitOfMeasurement: unit._id as mongoose.Types.ObjectId,
      currentStock: 1000,
      availableStock: 1000,
      containerCapacity: 1000,
    });
    // looseStock and canSellLoose aren't in the Partial type for the fixture — set directly.
    await Product.updateOne(
      { _id: product._id },
      { $set: { looseStock: 0, canSellLoose: true } },
    );

    // 5 concurrent "open container" calls of 1000 ml each. Sealed stock is 1000,
    // so only ONE should actually be legal — but all 5 pass validation.
    const opens = Array.from({ length: 5 }, async () => {
      const p = (await Product.findById(product._id).lean()) as any;
      const validation = validatePoolAllocation(p, 1000, 'open');
      if (!validation.valid) return { attempted: false };
      const movement = new InventoryMovement({
        productId: p._id,
        movementType: 'pool_transfer',
        quantity: validation.delta,
        convertedQuantity: validation.delta,
        unitOfMeasurementId: p.unitOfMeasurement,
        baseUnit: 'ml',
        reference: `POOL-${Math.random()}`,
        notes: 'Stress test',
        createdBy: 'stress-user',
        pool: 'any',
      });
      await movement.save();
      await movement.updateProductStock();
      return { attempted: true };
    });

    const results = await Promise.all(opens);
    const attemptedCount = results.filter((r) => r.attempted).length;

    // All 5 pass validation — there is no atomic guard.
    expect(attemptedCount).toBe(5);

    // But the pool_transfer update clamps looseStock to currentStock, so the
    // final state is at least bounded (no negative, no > currentStock).
    const after = await Product.findById(product._id);
    expect(after!.looseStock).toBeGreaterThanOrEqual(0);
    expect(after!.looseStock).toBeLessThanOrEqual(after!.currentStock);
    // But the loose stock can be set to the full capacity even though only
    // one container's worth of sealed stock was physically opened.
    expect(after!.looseStock).toBe(1000);
  });
});

// ────────────────────────────────────────────────────────────────────
// Surface 4 — reservedStock writer audit
// ────────────────────────────────────────────────────────────────────
describe('Deduction surface — reservedStock field', () => {
  let tis: TransactionInventoryService;
  beforeAll(() => { tis = new TransactionInventoryService(); });
  beforeEach(async () => { await clearCollections(); });

  it('REGRESSION: no operation in the codebase mutates reservedStock (orphan field)', async () => {
    const unit = await createTestUnit({ name: 'ml' });
    const product = await createTestProduct({
      unitOfMeasurement: unit._id as mongoose.Types.ObjectId,
      currentStock: 500,
      availableStock: 500,
      reservedStock: 0,
      sellingPrice: 20,
      costPrice: 10,
      containerCapacity: 1,
    });

    // Run every mutation path we have
    const item = createTestTransactionItem({
      productId: String(product._id),
      quantity: 5,
      convertedQuantity: 5,
      unitPrice: 20,
      totalPrice: 100,
    });
    const tx = await Transaction.create(
      createTestTransaction([item], { transactionNumber: 'RESERVED-CHECK-1' }),
    );
    await tis.processTransactionInventory(tx as any, 'stress-user');

    // Manually build Refund (createRefund is broken, separate test guards that).
    const refund = await Refund.create({
      refundNumber: 'REF-STRESS-RSV-1',
      transactionId: tx._id,
      transactionNumber: tx.transactionNumber,
      customerName: tx.customerName,
      items: [{
        productId: String(product._id),
        productName: product.name,
        originalQuantity: 5,
        refundQuantity: 1,
        unitPrice: 20,
        refundAmount: 20,
      }],
      originalAmount: 100,
      refundAmount: 20,
      refundMethod: 'cash',
      refundReason: 'customer_request',
      refundType: 'partial',
      status: 'approved',
      createdBy: 'stress-user',
    });
    await RefundService.processRefund(String(refund._id), 'stress-user');

    const after = await Product.findById(product._id);
    // currentStock moved (sale −5 + refund +1 = −4)
    expect(after!.currentStock).toBe(496);
    // reservedStock never touched. Confirms dead field.
    expect(after!.reservedStock).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────────────
// Surface 5 — Bundle component products pool semantics
// ────────────────────────────────────────────────────────────────────
describe('Deduction surface — bundle component pool semantics', () => {
  let tis: TransactionInventoryService;
  beforeAll(() => { tis = new TransactionInventoryService(); });
  beforeEach(async () => { await clearCollections(); });

  it('bundle_sale uses pool=loose, so looseStock tracks currentStock correctly', async () => {
    const unit = await createTestUnit({ name: 'ml' });
    const unitId = unit._id as mongoose.Types.ObjectId;
    const componentA = await createTestProduct({
      name: 'Component-A',
      unitOfMeasurement: unitId,
      currentStock: 100,
      availableStock: 100,
      sellingPrice: 10,
      costPrice: 5,
      containerCapacity: 100,
    });
    await Product.updateOne(
      { _id: componentA._id },
      { $set: { looseStock: 50 } }, // partially opened
    );

    const bundle = await createTestBundle(
      [{
        productId: componentA._id as mongoose.Types.ObjectId,
        name: 'Component-A',
        quantity: 10,
        productType: 'product',
        unitOfMeasurementId: unitId,
        unitName: 'ml',
        individualPrice: 10,
      }],
      { bundlePrice: 80 },
    );

    const item = createTestTransactionItem({
      productId: String(bundle._id),
      name: bundle.name,
      itemType: 'bundle',
      quantity: 2,
      convertedQuantity: 2,
      unitPrice: 80,
      totalPrice: 160,
    });
    const tx = await Transaction.create(
      createTestTransaction([item], { transactionNumber: 'BUNDLE-POOL-1' }),
    );
    await tis.processTransactionInventory(tx as any, 'stress-user');

    const after = await Product.findById(componentA._id);
    // currentStock decremented by 20 (10 per bundle × 2): 100 - 20 = 80
    expect(after!.currentStock).toBe(80);
    // looseStock was 50, bundle sale drew 20 from loose pool → 30. Proves D7 fix.
    expect(after!.looseStock).toBe(30);
  });
});

// ────────────────────────────────────────────────────────────────────
// Surface 6 — Restock concurrency + analytics race
// ────────────────────────────────────────────────────────────────────
describe('Deduction surface — restock concurrency', () => {
  beforeEach(async () => { await clearCollections(); });

  it('RestockService.restockProduct actually increments stock after the ObjectId fix (D4)', async () => {
    // After D4 — using mongoose.Types.ObjectId instead of Schema.Types.ObjectId —
    // the InventoryMovement now saves successfully and the pipeline updateOne
    // atomically adjusts currentStock.
    const unit = await createTestUnit({ name: 'ml' });
    const product = await createTestProduct({
      unitOfMeasurement: unit._id as mongoose.Types.ObjectId,
      currentStock: 0,
      availableStock: 0,
      costPrice: 10,
      containerCapacity: 1,
    });

    const restockService = new RestockService();
    const N = 10;
    const results = await Promise.all(
      Array.from({ length: N }, () =>
        restockService.restockProduct(
          { productId: String(product._id), quantity: 10 },
          'stress-user',
        ),
      ),
    );

    expect(results.every((r) => r.success === true)).toBe(true);

    const after = await Product.findById(product._id);
    // Atomic $inc via pipeline → exactly N × 10
    expect(after!.currentStock).toBe(N * 10);

    // Ledger rows persisted (the primary one from updateProductStock plus the
    // secondary ledger-only row at the end of restockProduct).
    const movements = await InventoryMovement.countDocuments({ movementType: 'adjustment' });
    expect(movements).toBe(N * 2);
  });

  it('restockCount and averageRestockQuantity survive concurrent restocks (atomic D8 fix)', async () => {
    // After D8 — updateRestockAnalytics uses a pipeline updateOne — counter
    // updates and average recomputation happen in a single atomic write.
    const unit = await createTestUnit({ name: 'ml' });
    const product = await createTestProduct({
      unitOfMeasurement: unit._id as mongoose.Types.ObjectId,
      currentStock: 0,
      availableStock: 0,
      costPrice: 10,
      containerCapacity: 1,
    });

    const restockService = new RestockService();
    const N = 20;
    await Promise.all(
      Array.from({ length: N }, () =>
        restockService.restockProduct(
          { productId: String(product._id), quantity: 1 },
          'stress-user',
        ),
      ),
    );

    const after = await Product.findById(product._id);
    expect(after!.restockCount).toBe(N);
    // All restocks were of quantity 1, so the running average is exactly 1.
    expect(after!.averageRestockQuantity).toBeCloseTo(1, 6);
    expect(after!.lastRestockDate).toBeInstanceOf(Date);
  });
});
