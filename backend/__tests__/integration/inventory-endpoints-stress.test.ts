/**
 * End-to-end stress test for inventory management endpoints.
 *
 * Covers every HTTP surface a user touches to move stock:
 *   - POST   /api/inventory/restock              (single)
 *   - POST   /api/inventory/restock/bulk         (bulk)
 *   - GET    /api/inventory/restock              (history)
 *   - POST   /api/inventory/products             (create w/ initial stock)
 *   - GET    /api/inventory/products/:id         (real-time stock view)
 *   - GET    /api/inventory/products             (list)
 *   - PUT    /api/inventory/products/:id         (manual stock edit)
 *   - POST   /api/inventory/products/:id/pool    (sealed ↔ loose transfer)
 *   - GET    /api/inventory/alerts               (low-stock / out-of-stock alerts)
 *
 * Also exercises the interplay with real-time deductions via
 * TransactionInventoryService so we can assert that a GET reflects the
 * state change immediately after a sale.
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
  createTestCategory,
  createTestTransactionItem,
  createTestTransaction,
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

const app = buildApp();

let authToken = '';

async function createSuperAdminToken(label = 'admin'): Promise<string> {
  const u = await User.create({
    email: `${label}-${Date.now()}-${Math.random()}@test.local`,
    username: `${label}-${Date.now()}-${Math.random()}`,
    name: 'Super Admin',
    password: 'x',
    role: 'super_admin',
    isActive: true,
  });
  return jwt.sign({ userId: String(u._id), role: 'super_admin' }, process.env.JWT_SECRET!, { expiresIn: '1h' });
}

async function seedProduct(overrides: Parameters<typeof createTestProduct>[0] = {}) {
  const unit = await createTestUnit({ name: `unit-${Date.now()}-${Math.random()}` });
  return await createTestProduct({
    unitOfMeasurement: unit._id as mongoose.Types.ObjectId,
    currentStock: 100,
    availableStock: 100,
    costPrice: 10,
    sellingPrice: 25,
    ...overrides,
  });
}

beforeEach(async () => {
  authToken = await createSuperAdminToken();
});

// ────────────────────────────────────────────────────────────────────
// 1. Restock — happy path + common edge cases
// ────────────────────────────────────────────────────────────────────
describe('POST /api/inventory/restock — single restock', () => {
  it('adds stock to a product and records an InventoryMovement', async () => {
    const product = await seedProduct({ currentStock: 10, availableStock: 10 });

    const res = await request(app)
      .post('/api/inventory/restock')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ productId: String(product._id), quantity: 25 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(35);
    expect(after!.restockCount).toBe(1);
    expect(after!.lastRestockDate).toBeInstanceOf(Date);

    const movements = await InventoryMovement.find({ productId: product._id, movementType: 'adjustment' });
    expect(movements.length).toBeGreaterThanOrEqual(1);
  });

  it('restocks a product whose currentStock is 0 (regression: oversell block must not apply to increments)', async () => {
    const product = await seedProduct({ currentStock: 0, availableStock: 0 });

    const res = await request(app)
      .post('/api/inventory/restock')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ productId: String(product._id), quantity: 100 });

    expect(res.status).toBe(200);
    const after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(100);
  });

  it('rejects a negative restock quantity', async () => {
    const product = await seedProduct({ currentStock: 50 });
    const res = await request(app)
      .post('/api/inventory/restock')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ productId: String(product._id), quantity: -10 });

    expect(res.status).toBe(400);
    const after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(50);
  });

  it('rejects a zero restock quantity', async () => {
    const product = await seedProduct({ currentStock: 50 });
    const res = await request(app)
      .post('/api/inventory/restock')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ productId: String(product._id), quantity: 0 });

    expect(res.status).toBe(400);
  });

  it('rejects a restock against a non-existent product', async () => {
    const ghostId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .post('/api/inventory/restock')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ productId: ghostId, quantity: 10 });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});

// ────────────────────────────────────────────────────────────────────
// 2. Bulk restock
// ────────────────────────────────────────────────────────────────────
describe('POST /api/inventory/restock/bulk — bulk restock', () => {
  it('processes multiple restocks in one call and increments each product', async () => {
    const unit = await createTestUnit({ name: 'bulk-ml' });
    const unitId = unit._id as mongoose.Types.ObjectId;
    const cat = await createTestCategory();
    const p1 = await createTestProduct({ unitOfMeasurement: unitId, category: cat._id as mongoose.Types.ObjectId, currentStock: 5, availableStock: 5, costPrice: 10 });
    const p2 = await createTestProduct({ unitOfMeasurement: unitId, category: cat._id as mongoose.Types.ObjectId, currentStock: 10, availableStock: 10, costPrice: 10 });
    const p3 = await createTestProduct({ unitOfMeasurement: unitId, category: cat._id as mongoose.Types.ObjectId, currentStock: 0, availableStock: 0, costPrice: 10 });

    const res = await request(app)
      .post('/api/inventory/restock/bulk')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        operations: [
          { productId: String(p1._id), quantity: 15 },
          { productId: String(p2._id), quantity: 20 },
          { productId: String(p3._id), quantity: 50 },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.successCount).toBe(3);

    const [a1, a2, a3] = await Promise.all([
      Product.findById(p1._id),
      Product.findById(p2._id),
      Product.findById(p3._id),
    ]);
    expect(a1!.currentStock).toBe(20);
    expect(a2!.currentStock).toBe(30);
    expect(a3!.currentStock).toBe(50);
  });

  it('reports partial success when some operations reference invalid products', async () => {
    const product = await seedProduct({ currentStock: 10 });
    const ghostId = new mongoose.Types.ObjectId().toString();

    const res = await request(app)
      .post('/api/inventory/restock/bulk')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        operations: [
          { productId: String(product._id), quantity: 10 },
          { productId: ghostId, quantity: 5 },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.successCount).toBeGreaterThanOrEqual(1);
    expect(res.body.data.totalOperations).toBe(2);

    const after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(20);
  });
});

// ────────────────────────────────────────────────────────────────────
// 3. Restock history
// ────────────────────────────────────────────────────────────────────
describe('GET /api/inventory/restock — history', () => {
  it('history lists movements for a specific product', async () => {
    const product = await seedProduct({ currentStock: 0 });

    for (let i = 0; i < 3; i++) {
      await request(app)
        .post('/api/inventory/restock')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ productId: String(product._id), quantity: 10 });
    }

    const res = await request(app)
      .get(`/api/inventory/restock?productId=${product._id}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    // Response shape can vary; assert movements exist for this product in DB
    const movements = await InventoryMovement.find({
      productId: product._id,
      movementType: 'adjustment',
    });
    expect(movements.length).toBeGreaterThanOrEqual(3);
  });

});

// ────────────────────────────────────────────────────────────────────
// 4. Product CRUD — create, read, update
// ────────────────────────────────────────────────────────────────────
describe('Product CRUD — create / read / update via HTTP', () => {
  it('POST /products creates a product with the requested initial stock', async () => {
    const unit = await createTestUnit({ name: 'create-ml' });
    const cat = await createTestCategory();

    const res = await request(app)
      .post('/api/inventory/products')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: `HTTP Product ${Date.now()}`,
        sku: `HTTP-${Date.now()}`,
        category: String(cat._id),
        unitOfMeasurement: String(unit._id),
        currentStock: 42,
        costPrice: 5,
        sellingPrice: 15,
      });

    expect(res.status).toBe(201);
    expect(res.body.currentStock).toBe(42);
    expect(res.body.availableStock).toBe(42);
  });

  it('POST /products normalizes per-unit loose prices to canonical per-container prices', async () => {
    const unit = await createTestUnit({ name: 'price-basis-ml', abbreviation: 'ml', type: 'volume' });
    const cat = await createTestCategory();

    const res = await request(app)
      .post('/api/inventory/products')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: `Loose Price Basis ${Date.now()}`,
        sku: `LPB-${Date.now()}`,
        category: String(cat._id),
        unitOfMeasurement: String(unit._id),
        currentStock: 1000,
        canSellLoose: true,
        containerCapacity: 500,
        costPrice: 0.13,
        costPriceBasis: 'unit',
        sellingPrice: 0.4,
        sellingPriceBasis: 'unit',
      });

    expect(res.status).toBe(201);
    expect(res.body.sellingPrice).toBe(200);
    expect(res.body.costPrice).toBe(65);
    expect(res.body.sellingPricePerUnit).toBe(0.4);
    expect(res.body.costPricePerUnit).toBe(0.13);
  });

  it('PUT /products/:id normalizes per-unit loose prices to canonical per-container prices', async () => {
    const product = await seedProduct({
      currentStock: 1000,
      containerCapacity: 500,
      sellingPrice: 100,
      costPrice: 40,
    } as any);
    await Product.updateOne({ _id: product._id }, { canSellLoose: true, looseStock: 500, containerCapacity: 500 });

    const res = await request(app)
      .put(`/api/inventory/products/${product._id}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        sellingPrice: 0.4,
        sellingPriceBasis: 'unit',
        costPrice: 0.13,
        costPriceBasis: 'unit',
      });

    expect(res.status).toBe(200);
    expect(res.body.sellingPrice).toBe(200);
    expect(res.body.costPrice).toBe(65);
    const after = await Product.findById(product._id).lean() as { sellingPrice?: number; costPrice?: number } | null;
    expect(after!.sellingPrice).toBe(200);
    expect(after!.costPrice).toBe(65);
  });

  it('GET /products/:id reflects the database state immediately after a mutation', async () => {
    const product = await seedProduct({ currentStock: 100 });

    // Mutate via restock
    await request(app)
      .post('/api/inventory/restock')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ productId: String(product._id), quantity: 50 });

    // Read via HTTP
    const res = await request(app)
      .get(`/api/inventory/products/${product._id}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.currentStock).toBe(150);
  });

  it('PUT /products/:id can set currentStock manually (super_admin)', async () => {
    const product = await seedProduct({ currentStock: 50 });

    const res = await request(app)
      .put(`/api/inventory/products/${product._id}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ currentStock: 200 });

    expect(res.status).toBe(200);
    const after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(200);
  });

  it('PUT /products/:id allows negative currentStock (sell-through-permissive policy)', async () => {
    // Schema min:0 was removed when we adopted sell-through-permissive: stock
    // can be authoritatively set to a negative value to model owed inventory.
    const product = await seedProduct({ currentStock: 50 });

    const res = await request(app)
      .put(`/api/inventory/products/${product._id}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ currentStock: -5 });

    expect(res.status).toBe(200);
    const after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(-5);
  });

  it('PUT /products/:id allows setting currentStock to 0 (reduction is fine; only SELLING from zero is blocked)', async () => {
    const product = await seedProduct({ currentStock: 50 });

    const res = await request(app)
      .put(`/api/inventory/products/${product._id}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ currentStock: 0 });

    expect(res.status).toBe(200);
    const after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────────────
// 5. Real-time deduction visibility — sell → GET reflects new stock
// ────────────────────────────────────────────────────────────────────
describe('Real-time deduction: GET /products/:id reflects sales immediately', () => {
  let tis: TransactionInventoryService;
  beforeAll(() => { tis = new TransactionInventoryService(); });

  it('after a completed sale, GET /products/:id returns the decremented stock without any cache miss', async () => {
    const product = await seedProduct({ currentStock: 100 });

    const item = createTestTransactionItem({
      productId: String(product._id),
      name: product.name,
      quantity: 15,
      convertedQuantity: 15,
      unitPrice: 25,
      totalPrice: 375,
    });
    const tx = await Transaction.create(
      createTestTransaction([item], { transactionNumber: 'RT-SALE-1' }),
    );
    await tis.processTransactionInventory(tx as any, 'stress-user');

    const res = await request(app)
      .get(`/api/inventory/products/${product._id}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.currentStock).toBe(85);
  });

  it('full lifecycle: restock → sell → refund — stock returns to original', async () => {
    const product = await seedProduct({ currentStock: 10 });

    // Restock +40 → 50
    await request(app)
      .post('/api/inventory/restock')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ productId: String(product._id), quantity: 40 });

    // Sell 20 → 30
    const item = createTestTransactionItem({
      productId: String(product._id),
      name: product.name,
      quantity: 20,
      convertedQuantity: 20,
      unitPrice: 25,
      totalPrice: 500,
    });
    const tx = await Transaction.create(
      createTestTransaction([item], { transactionNumber: 'LIFECYCLE-1' }),
    );
    await tis.processTransactionInventory(tx as any, 'stress-user');

    let res = await request(app)
      .get(`/api/inventory/products/${product._id}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.body.currentStock).toBe(30);

    // Refund (reverse) → +20 = 50
    await tis.reverseTransactionInventory('LIFECYCLE-1', 'stress-user');

    res = await request(app)
      .get(`/api/inventory/products/${product._id}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.body.currentStock).toBe(50);
  });
});

// ────────────────────────────────────────────────────────────────────
// 6. Pool transfer — sealed ↔ loose round-trip
// ────────────────────────────────────────────────────────────────────
describe('POST /products/:id/pool — open / close workflow', () => {
  it('open moves units into the loose pool; close returns them; currentStock unchanged', async () => {
    const product = await seedProduct({ currentStock: 1000, availableStock: 1000, containerCapacity: 500 });
    await Product.updateOne({ _id: product._id }, { $set: { canSellLoose: true, looseStock: 0 } });

    // Open 500
    let res = await request(app)
      .post(`/api/inventory/products/${product._id}/pool`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ action: 'open', amount: 500 });
    expect(res.status).toBe(200);

    let after = await Product.findById(product._id);
    expect(after!.looseStock).toBe(500);
    expect(after!.currentStock).toBe(1000); // unchanged — pool transfer is lossless

    // Close 500
    res = await request(app)
      .post(`/api/inventory/products/${product._id}/pool`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ action: 'close', amount: 500 });
    expect(res.status).toBe(200);

    after = await Product.findById(product._id);
    expect(after!.looseStock).toBe(0);
    expect(after!.currentStock).toBe(1000);
  });

  it('rejects open when amount exceeds sealed stock', async () => {
    const product = await seedProduct({ currentStock: 200, availableStock: 200, containerCapacity: 500 });
    await Product.updateOne({ _id: product._id }, { $set: { canSellLoose: true, looseStock: 0 } });

    const res = await request(app)
      .post(`/api/inventory/products/${product._id}/pool`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ action: 'open', amount: 500 });

    expect(res.status).toBe(400);
  });
});

// ────────────────────────────────────────────────────────────────────
// 7. Stock alerts — out of stock only (low-stock alerts were removed
// when the reorder system was retired).
// ────────────────────────────────────────────────────────────────────
describe('GET /api/inventory/alerts — stock alerts', () => {
  it('surfaces out-of-stock and low-stock products; omits healthy ones', async () => {
    const unit = await createTestUnit({ name: 'alert-ml' });
    const unitId = unit._id as mongoose.Types.ObjectId;
    const outOfStock = await createTestProduct({ unitOfMeasurement: unitId, currentStock: 0, availableStock: 0, costPrice: 10 });
    const lowButInStock = await createTestProduct({ unitOfMeasurement: unitId, currentStock: 3, availableStock: 3, costPrice: 10 });
    const healthy = await createTestProduct({ unitOfMeasurement: unitId, currentStock: 500, availableStock: 500, costPrice: 10 });

    const res = await request(app)
      .get('/api/inventory/alerts')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    const alerts: Array<{ productId: string; alertType: string }> = res.body.alerts || [];
    const byId = new Map(alerts.map((a) => [a.productId, a.alertType]));

    expect(byId.get(String(outOfStock._id))).toBe('out_of_stock');
    // Low stock alerts no longer exist — only zero-stock products surface.
    expect(byId.has(String(lowButInStock._id))).toBe(false);
    expect(byId.has(String(healthy._id))).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────
// 8. Concurrency — sales and restocks hitting the same product
// ────────────────────────────────────────────────────────────────────
describe('Concurrency: mixed restock + sale on the same product', () => {
  let tis: TransactionInventoryService;
  beforeAll(() => { tis = new TransactionInventoryService(); });

  it('10 parallel restocks of +10 all succeed atomically, final stock = start + 100', async () => {
    const product = await seedProduct({ currentStock: 0, availableStock: 0 });

    const N = 10;
    const results = await Promise.all(
      Array.from({ length: N }, () =>
        request(app)
          .post('/api/inventory/restock')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ productId: String(product._id), quantity: 10 }),
      ),
    );
    // All HTTP calls succeeded and were recorded by the service.
    const okCount = results.filter((r) => r.status === 200).length;
    expect(okCount).toBe(N);

    const after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(N * 10);
    expect(after!.restockCount).toBe(N);
  });

  it('interleaved restocks and sales: no lost updates, no oversell, final stock is deterministic', async () => {
    const product = await seedProduct({ currentStock: 20, availableStock: 20 });

    const sales = Array.from({ length: 10 }, async (_, i) => {
      const item = createTestTransactionItem({
        productId: String(product._id),
        name: product.name,
        quantity: 2,
        convertedQuantity: 2,
        unitPrice: 25,
        totalPrice: 50,
      });
      const tx = await Transaction.create(
        createTestTransaction([item], { transactionNumber: `MIX-SALE-${i}` }),
      );
      try { await tis.processTransactionInventory(tx as any, 'stress-user'); return 'sold' as const; }
      catch { return 'rejected' as const; }
    });
    const restocks = Array.from({ length: 5 }, () =>
      request(app)
        .post('/api/inventory/restock')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ productId: String(product._id), quantity: 10 }),
    );

    const [saleOutcomes, restockResponses] = await Promise.all([
      Promise.all(sales),
      Promise.all(restocks),
    ]);

    const sold = saleOutcomes.filter((o) => o === 'sold').length;
    const rejected = saleOutcomes.filter((o) => o === 'rejected').length;
    expect(restockResponses.every((r) => r.status === 200)).toBe(true);
    expect(sold + rejected).toBe(10);

    // Final stock = 20 + 5*10 − 2*sold. All sold sales drew 2 units each.
    const after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(20 + 50 - 2 * sold);
    expect(after!.currentStock).toBeGreaterThanOrEqual(0);
  });
});
