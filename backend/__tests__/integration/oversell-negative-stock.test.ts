/**
 * Stock-availability policy: reject sales that would take stock to zero or
 * below, and reject any sale quantity greater than available stock.
 *
 * The authoritative guard is the conditional updateOne filter inside
 * `InventoryMovement.updateProductStock` (atomic, race-safe). This file
 * exercises it end-to-end alongside the controller-level pre-check and the
 * schema-level belt-and-suspenders (`min: 0`).
 */

process.env.JWT_SECRET = 'test-secret';

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import express, { type Express } from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

import inventoryRoutes from '../../routes/inventory.routes.js';
import { errorHandler, InsufficientStockError } from '../../middlewares/errorHandler.middleware.js';
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
// 1. Sale path — insufficient stock is rejected, stock never goes negative
// ────────────────────────────────────────────────────────────────────
describe('Oversell policy: sale path rejects insufficient stock', () => {
  let tis: TransactionInventoryService;
  beforeAll(() => { tis = new TransactionInventoryService(); });

  it('selling 5 when currentStock=0 throws InsufficientStockError and leaves stock at 0', async () => {
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
      createTestTransaction([item], { transactionNumber: 'BLOCK-ZERO-1' }),
    );

    await expect(tis.processTransactionInventory(tx as any, 'stress-user'))
      .rejects.toBeInstanceOf(InsufficientStockError);

    const after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(0);
    expect(after!.availableStock).toBe(0);

    // No movement recorded.
    const movements = await InventoryMovement.countDocuments({ reference: 'BLOCK-ZERO-1' });
    expect(movements).toBe(0);
  });

  it('selling 10 when currentStock=3 throws and leaves stock at 3 (no partial)', async () => {
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
      createTestTransaction([item], { transactionNumber: 'BLOCK-SHORT-1' }),
    );

    const err = await tis.processTransactionInventory(tx as any, 'stress-user').catch((e) => e);
    expect(err).toBeInstanceOf(InsufficientStockError);
    const details = (err as InsufficientStockError).items[0];
    expect(details.productId).toBe(String(product._id));
    expect(details.requested).toBe(10);
    expect(details.available).toBe(3);

    const after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(3);
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

  it('10 concurrent sales of 1 on stock=5: exactly 5 succeed, 5 rejected, stock lands at 0 (TOCTOU-safe)', async () => {
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
        try {
          await tis.processTransactionInventory(tx as any, 'stress-user');
          return 'ok' as const;
        } catch (e) {
          if (e instanceof InsufficientStockError) return 'rejected' as const;
          throw e;
        }
      }),
    );

    const ok = outcomes.filter((o) => o === 'ok').length;
    const rejected = outcomes.filter((o) => o === 'rejected').length;

    expect(ok).toBe(5);
    expect(rejected).toBe(5);

    const after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────────────
// 2. Blend + bundle paths — all-or-nothing pre-check
// ────────────────────────────────────────────────────────────────────
describe('Oversell policy: blends and bundles reject when any component is short', () => {
  let tis: TransactionInventoryService;
  beforeAll(() => { tis = new TransactionInventoryService(); });

  it('fixed_blend rejects when any ingredient is short, neither ingredient is deducted', async () => {
    const unit = await createTestUnit({ name: 'ml' });
    const unitId = unit._id as mongoose.Types.ObjectId;
    const a = await createTestProduct({ name: 'A', unitOfMeasurement: unitId, currentStock: 100, availableStock: 100, containerCapacity: 100 });
    const b = await createTestProduct({ name: 'B', unitOfMeasurement: unitId, currentStock: 5, availableStock: 5, containerCapacity: 100 });
    // Allow loose-pool deduction on both ingredients.
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

    // One blend requires 10 of B; only 5 available.
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
      createTestTransaction([item], { transactionNumber: 'BLEND-SHORT-1' }),
    );

    await expect(tis.processTransactionInventory(tx as any, 'stress-user'))
      .rejects.toBeInstanceOf(InsufficientStockError);

    // A was not touched even though it had plenty.
    const afterA = await Product.findById(a._id);
    const afterB = await Product.findById(b._id);
    expect(afterA!.currentStock).toBe(100);
    expect(afterB!.currentStock).toBe(5);
    expect(await InventoryMovement.countDocuments({ reference: 'BLEND-SHORT-1' })).toBe(0);
  });

  it('bundle rejects when any component is short, no component is deducted', async () => {
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
      createTestTransaction([item], { transactionNumber: 'BUNDLE-SHORT-1' }),
    );

    await expect(tis.processTransactionInventory(tx as any, 'stress-user'))
      .rejects.toBeInstanceOf(InsufficientStockError);

    const afterC1 = await Product.findById(comp1._id);
    const afterC2 = await Product.findById(comp2._id);
    expect(afterC1!.currentStock).toBe(100);
    expect(afterC2!.currentStock).toBe(3);
  });
});

// ────────────────────────────────────────────────────────────────────
// 3. Paths that must REMAIN unblocked
// ────────────────────────────────────────────────────────────────────
describe('Paths that are exempt from the availability guard', () => {
  let tis: TransactionInventoryService;
  beforeAll(() => { tis = new TransactionInventoryService(); });

  it('refund/return movements add stock without triggering the availability guard', async () => {
    const unit = await createTestUnit({ name: 'ml' });
    const product = await createTestProduct({
      unitOfMeasurement: unit._id as mongoose.Types.ObjectId,
      currentStock: 10,
      availableStock: 10,
      containerCapacity: 1,
    });

    // Sell 5 first so there's something to reverse.
    const item = createTestTransactionItem({
      productId: String(product._id),
      name: product.name,
      quantity: 5,
      convertedQuantity: 5,
      unitPrice: 10,
      totalPrice: 50,
    });
    const tx = await Transaction.create(
      createTestTransaction([item], { transactionNumber: 'REV-1' }),
    );
    await tis.processTransactionInventory(tx as any, 'stress-user');

    let after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(5);

    // Reverse it — returns add stock back, should never be blocked.
    const reversal = await tis.reverseTransactionInventory('REV-1', 'stress-user');
    expect(reversal.errors).toEqual([]);
    expect(reversal.reversedCount).toBe(1);

    after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(10);
  });

  it('adjustment movements (restock) add stock and are not blocked', async () => {
    const unit = await createTestUnit({ name: 'ml' });
    const product = await createTestProduct({
      unitOfMeasurement: unit._id as mongoose.Types.ObjectId,
      currentStock: 0,
      availableStock: 0,
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
    expect(after!.currentStock).toBe(50);
  });
});

// ────────────────────────────────────────────────────────────────────
// 4. Schema-level belt-and-suspenders
// ────────────────────────────────────────────────────────────────────
describe('Schema-level stock guards', () => {
  it('GUARD: Product.currentStock has min:0 — direct save of negative is rejected', async () => {
    const unit = await createTestUnit({ name: 'ml' });
    const product = await createTestProduct({
      unitOfMeasurement: unit._id as mongoose.Types.ObjectId,
      currentStock: 0,
    });
    product.currentStock = -1;
    await expect(product.save()).rejects.toThrow(/currentStock|min/i);
  });

  it('GUARD: Product.availableStock has min:0 — direct save of negative is rejected', async () => {
    const unit = await createTestUnit({ name: 'ml' });
    const product = await createTestProduct({
      unitOfMeasurement: unit._id as mongoose.Types.ObjectId,
      availableStock: 0,
    });
    product.availableStock = -1;
    await expect(product.save()).rejects.toThrow(/availableStock|min/i);
  });

  it('GUARD: Product.looseStock has min:0 — direct save of negative is rejected', async () => {
    const unit = await createTestUnit({ name: 'ml' });
    const product = await createTestProduct({
      unitOfMeasurement: unit._id as mongoose.Types.ObjectId,
      currentStock: 100,
      availableStock: 100,
      containerCapacity: 100,
    });
    await Product.updateOne({ _id: product._id }, { $set: { canSellLoose: true, looseStock: 0 } });
    const refreshed = await Product.findById(product._id);
    refreshed!.looseStock = -10;
    await expect(refreshed!.save()).rejects.toThrow(/looseStock|min/i);
  });
});

// ────────────────────────────────────────────────────────────────────
// 5. Pool transfer — still guarded (regression)
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

  it('open 500ml when sealed stock is 0 → 400', async () => {
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
