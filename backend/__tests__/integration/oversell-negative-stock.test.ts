/**
 * Stock-availability policy: SELL-THROUGH-PERMISSIVE.
 *
 * Sales never block on stock. A sale of 5 against stock 0 succeeds and
 * leaves currentStock at -5 ("stock owed"). Reports clamp valuation to
 * non-negative; admin reconciles deficits when convenient.
 *
 * The atomic $add pipeline inside `InventoryMovement.updateProductStock`
 * still runs in a single round trip, so concurrent oversells stay
 * race-consistent — they just no longer race-fail.
 */

process.env.JWT_SECRET = 'test-secret';

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import express, { type Express } from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

import inventoryRoutes from '../../routes/inventory.routes.js';
import { errorHandler } from '../../middlewares/errorHandler.middleware.js';
import { clearUserCache } from '../../middlewares/auth.middleware.js';
import { User } from '../../models/User.js';

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

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/inventory', inventoryRoutes);
  app.use(errorHandler);
  return app;
}

// ────────────────────────────────────────────────────────────────────
// 1. Sale path — oversells succeed, stock can go negative
// ────────────────────────────────────────────────────────────────────
describe('Sell-through policy: sale path allows oversell', () => {
  let tis: TransactionInventoryService;
  beforeAll(() => { tis = new TransactionInventoryService(); });

  it('selling 5 when currentStock=0 succeeds and leaves stock at -5', async () => {
    const unit = await createTestUnit({ name: 'ml' });
    const product = await createTestProduct({
      unitOfMeasurement: unit._id as mongoose.Types.ObjectId,
      currentStock: 0,
      availableStock: 0,
      sellingPrice: 25,
      costPrice: 10,
    });

    const item = createTestTransactionItem({
      productId: String(product._id),
      name: product.name,
      quantity: 5,
      convertedQuantity: 5,
      unitPrice: 25,
      totalPrice: 125,
    });
    const tx = await Transaction.create(
      createTestTransaction([item], { transactionNumber: 'OVERSELL-ZERO-1' }),
    );

    const result = await tis.processTransactionInventory(tx as any, 'stress-user');
    expect(result.errors).toEqual([]);
    expect(result.movements.length).toBe(1);

    const after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(-5);

    const movements = await InventoryMovement.countDocuments({ reference: 'OVERSELL-ZERO-1' });
    expect(movements).toBe(1);
  });

  it('selling 10 when currentStock=3 succeeds and leaves stock at -7', async () => {
    const unit = await createTestUnit({ name: 'ml' });
    const product = await createTestProduct({
      unitOfMeasurement: unit._id as mongoose.Types.ObjectId,
      currentStock: 3,
      availableStock: 3,
      sellingPrice: 25,
      costPrice: 10,
    });

    const item = createTestTransactionItem({
      productId: String(product._id),
      name: product.name,
      quantity: 10,
      convertedQuantity: 10,
      unitPrice: 25,
      totalPrice: 250,
    });
    const tx = await Transaction.create(
      createTestTransaction([item], { transactionNumber: 'OVERSELL-SHORT-1' }),
    );

    const result = await tis.processTransactionInventory(tx as any, 'stress-user');
    expect(result.errors).toEqual([]);

    const after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(-7);
  });

  it('selling exactly currentStock succeeds and leaves stock at 0', async () => {
    const unit = await createTestUnit({ name: 'ml' });
    const product = await createTestProduct({
      unitOfMeasurement: unit._id as mongoose.Types.ObjectId,
      currentStock: 5,
      availableStock: 5,
      sellingPrice: 10,
      costPrice: 5,
    });

    const item = createTestTransactionItem({
      productId: String(product._id),
      name: product.name,
      quantity: 5,
      convertedQuantity: 5,
      unitPrice: 10,
      totalPrice: 50,
    });
    const tx = await Transaction.create(
      createTestTransaction([item], { transactionNumber: 'EXACT-1' }),
    );

    const result = await tis.processTransactionInventory(tx as any, 'stress-user');
    expect(result.errors).toEqual([]);

    const after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(0);
  });

  it('10 concurrent sales of 1 on stock=5: all 10 succeed, stock lands at -5 (race-consistent)', async () => {
    const unit = await createTestUnit({ name: 'ml' });
    const product = await createTestProduct({
      unitOfMeasurement: unit._id as mongoose.Types.ObjectId,
      currentStock: 5,
      availableStock: 5,
      sellingPrice: 10,
      costPrice: 5,
    });

    const SALES = 10;
    const outcomes = await Promise.all(
      Array.from({ length: SALES }, async (_, i) => {
        const item = createTestTransactionItem({
          productId: String(product._id),
          name: product.name,
          quantity: 1,
          convertedQuantity: 1,
          unitPrice: 10,
          totalPrice: 10,
        });
        const tx = await Transaction.create(
          createTestTransaction([item], { transactionNumber: `RACE-${i}` }),
        );
        const result = await tis.processTransactionInventory(tx as any, 'stress-user');
        return result.errors.length === 0 ? 'ok' : 'failed';
      }),
    );

    expect(outcomes.filter((o) => o === 'ok').length).toBe(SALES);

    const after = await Product.findById(product._id);
    // Atomic pipeline: every sale decrements by exactly 1, so stock = 5 - 10 = -5.
    expect(after!.currentStock).toBe(-5);
  });
});

// ────────────────────────────────────────────────────────────────────
// 2. Blend + bundle paths — oversells succeed component-by-component
// ────────────────────────────────────────────────────────────────────
describe('Sell-through policy: blends and bundles oversell partially', () => {
  let tis: TransactionInventoryService;
  beforeAll(() => { tis = new TransactionInventoryService(); });

  it('fixed_blend with one short ingredient succeeds; both ingredients deducted', async () => {
    const unit = await createTestUnit({ name: 'ml' });
    const unitId = unit._id as mongoose.Types.ObjectId;
    const a = await createTestProduct({ name: 'A', unitOfMeasurement: unitId, currentStock: 100, availableStock: 100, containerCapacity: 100 });
    const b = await createTestProduct({ name: 'B', unitOfMeasurement: unitId, currentStock: 5, availableStock: 5, containerCapacity: 100 });
    await Product.updateMany(
      { _id: { $in: [a._id, b._id] } },
      { $set: { canSellLoose: true } },
    );
    await Product.updateOne({ _id: a._id }, { $set: { looseStock: 100 } });
    await Product.updateOne({ _id: b._id }, { $set: { looseStock: 5 } });

    const template = await createTestBlendTemplate(
      [
        { productId: a._id as mongoose.Types.ObjectId, name: 'A', quantity: 10, unitOfMeasurementId: unitId, unitName: 'ml' },
        { productId: b._id as mongoose.Types.ObjectId, name: 'B', quantity: 10, unitOfMeasurementId: unitId, unitName: 'ml' },
      ],
      { unitOfMeasurementId: unitId, unitName: 'ml' },
    );

    const item = createTestTransactionItem({
      productId: String(template._id),
      name: template.name,
      itemType: 'fixed_blend',
      quantity: 1,
      convertedQuantity: 1,
      unitPrice: 40,
      totalPrice: 40,
    });
    const tx = await Transaction.create(
      createTestTransaction([item], { transactionNumber: 'BLEND-OVERSELL-1' }),
    );

    const result = await tis.processTransactionInventory(tx as any, 'stress-user');
    expect(result.errors).toEqual([]);

    const afterA = await Product.findById(a._id);
    const afterB = await Product.findById(b._id);
    expect(afterA!.currentStock).toBe(90);    // 100 - 10
    expect(afterB!.currentStock).toBe(-5);    // 5 - 10 (oversold)
    expect(await InventoryMovement.countDocuments({ reference: 'BLEND-OVERSELL-1' })).toBe(2);
  });

  it('bundle with one short component succeeds; all components deducted', async () => {
    const unit = await createTestUnit({ name: 'ml' });
    const unitId = unit._id as mongoose.Types.ObjectId;
    const comp1 = await createTestProduct({ name: 'C1', unitOfMeasurement: unitId, currentStock: 100, availableStock: 100, containerCapacity: 100 });
    const comp2 = await createTestProduct({ name: 'C2', unitOfMeasurement: unitId, currentStock: 3, availableStock: 3, containerCapacity: 100 });
    await Product.updateMany(
      { _id: { $in: [comp1._id, comp2._id] } },
      { $set: { canSellLoose: true } },
    );
    await Product.updateOne({ _id: comp1._id }, { $set: { looseStock: 100 } });
    await Product.updateOne({ _id: comp2._id }, { $set: { looseStock: 3 } });

    const bundle = await createTestBundle(
      [
        { productId: comp1._id as mongoose.Types.ObjectId, name: 'C1', quantity: 2, productType: 'product', unitOfMeasurementId: unitId, unitName: 'ml', individualPrice: 10 },
        { productId: comp2._id as mongoose.Types.ObjectId, name: 'C2', quantity: 5, productType: 'product', unitOfMeasurementId: unitId, unitName: 'ml', individualPrice: 10 },
      ],
      { bundlePrice: 50 },
    );

    const item = createTestTransactionItem({
      productId: String(bundle._id),
      name: bundle.name,
      itemType: 'bundle',
      quantity: 1,
      convertedQuantity: 1,
      unitPrice: 50,
      totalPrice: 50,
    });
    const tx = await Transaction.create(
      createTestTransaction([item], { transactionNumber: 'BUNDLE-OVERSELL-1' }),
    );

    const result = await tis.processTransactionInventory(tx as any, 'stress-user');
    expect(result.errors).toEqual([]);

    const afterC1 = await Product.findById(comp1._id);
    const afterC2 = await Product.findById(comp2._id);
    expect(afterC1!.currentStock).toBe(98);   // 100 - 2
    expect(afterC2!.currentStock).toBe(-2);   // 3 - 5 (oversold)
  });
});

// ────────────────────────────────────────────────────────────────────
// 3. Refunds and restocks still work and recover from negative
// ────────────────────────────────────────────────────────────────────
describe('Recovery from negative stock', () => {
  let tis: TransactionInventoryService;
  beforeAll(() => { tis = new TransactionInventoryService(); });

  it('refund of an oversold transaction restores stock toward zero', async () => {
    const unit = await createTestUnit({ name: 'ml' });
    const product = await createTestProduct({
      unitOfMeasurement: unit._id as mongoose.Types.ObjectId,
      currentStock: 0,
      availableStock: 0,
      containerCapacity: 1,
    });

    const item = createTestTransactionItem({
      productId: String(product._id),
      name: product.name,
      quantity: 5,
      convertedQuantity: 5,
      unitPrice: 10,
      totalPrice: 50,
    });
    const tx = await Transaction.create(
      createTestTransaction([item], { transactionNumber: 'OVERSOLD-REV-1' }),
    );
    await tis.processTransactionInventory(tx as any, 'stress-user');

    let after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(-5);

    const reversal = await tis.reverseTransactionInventory('OVERSOLD-REV-1', 'stress-user');
    expect(reversal.errors).toEqual([]);
    expect(reversal.reversedCount).toBe(1);

    after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(0);
  });

  it('adjustment (restock) brings negative stock back positive', async () => {
    const unit = await createTestUnit({ name: 'ml' });
    const product = await createTestProduct({
      unitOfMeasurement: unit._id as mongoose.Types.ObjectId,
      currentStock: -5,
      availableStock: -5,
      containerCapacity: 1,
    });
    const movement = new InventoryMovement({
      productId: product._id,
      movementType: 'adjustment',
      quantity: 50,
      convertedQuantity: 50,
      unitOfMeasurementId: unit._id,
      baseUnit: 'ml',
      reference: 'RESTOCK-1',
      createdBy: 'stress-user',
      pool: 'any',
    });
    await movement.save();
    await (movement as any).updateProductStock();

    const after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(45);  // -5 + 50
  });
});

// ────────────────────────────────────────────────────────────────────
// 4. Schema accepts negative stock values
// ────────────────────────────────────────────────────────────────────
describe('Schema permits negative stock', () => {
  it('Product.currentStock can persist as negative', async () => {
    const unit = await createTestUnit({ name: 'ml' });
    const product = await createTestProduct({
      unitOfMeasurement: unit._id as mongoose.Types.ObjectId,
      currentStock: 0,
    });
    product.currentStock = -10;
    await expect(product.save()).resolves.toBeTruthy();
    const after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(-10);
  });

  it('Product.availableStock can persist as negative', async () => {
    const unit = await createTestUnit({ name: 'ml' });
    const product = await createTestProduct({
      unitOfMeasurement: unit._id as mongoose.Types.ObjectId,
      availableStock: 0,
    });
    product.availableStock = -3;
    await expect(product.save()).resolves.toBeTruthy();
  });

  it('looseStock collapses to 0 when currentStock goes negative (pre-save clamp)', async () => {
    const unit = await createTestUnit({ name: 'ml' });
    const product = await createTestProduct({
      unitOfMeasurement: unit._id as mongoose.Types.ObjectId,
      currentStock: 100,
      availableStock: 100,
      containerCapacity: 100,
    });
    await Product.updateOne({ _id: product._id }, { $set: { canSellLoose: true, looseStock: 50 } });
    const refreshed = await Product.findById(product._id);
    refreshed!.currentStock = -5;
    refreshed!.looseStock = 50;
    await refreshed!.save();

    const after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(-5);
    // looseStock is bounded by [0, max(0, currentStock)] = 0 here.
    expect(after!.looseStock).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────────────
// 5. Pool transfer still validates (separate code path)
// ────────────────────────────────────────────────────────────────────
describe('Pool transfer guards (regression)', () => {
  const app = buildApp();

  async function createSuperAdminToken(): Promise<string> {
    const u = await User.create({
      email: `pool-admin-${Date.now()}@test.local`,
      username: `pool-admin-${Date.now()}`,
      name: 'Pool Admin',
      password: 'x',
      role: 'super_admin',
      isActive: true,
    });
    return jwt.sign({ userId: String(u._id), role: 'super_admin' }, process.env.JWT_SECRET!, { expiresIn: '1h' });
  }

  it('open 500ml when sealed stock is 0 → 400 (StockPoolService still validates)', async () => {
    const unit = await createTestUnit({ name: 'ml' });
    const product = await createTestProduct({
      unitOfMeasurement: unit._id as mongoose.Types.ObjectId,
      currentStock: 0,
      availableStock: 0,
      containerCapacity: 500,
    });
    await Product.updateOne({ _id: product._id }, { $set: { canSellLoose: true, looseStock: 0 } });

    const token = await createSuperAdminToken();
    const res = await request(app)
      .post(`/api/inventory/products/${product._id}/pool`)
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'open', amount: 500 });

    expect(res.status).toBe(400);
    const after = await Product.findById(product._id);
    expect(after!.looseStock ?? 0).toBe(0);
  });
});
