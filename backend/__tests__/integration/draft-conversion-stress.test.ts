/**
 * End-to-end stress test for the draft → completed conversion path.
 *
 * Reproduces the bug where saving a draft and then submitting in the same
 * modal session created TWO transactions (one draft, one completed). The
 * fix routes the second click through PUT /:id with status='completed'
 * instead of creating a fresh record.
 *
 * Covers:
 *   1.  Save draft + PUT to completed → exactly 1 transaction exists
 *   2.  Inventory unchanged after save-draft; deducted after PUT
 *   3.  Idempotency: replay PUT does not double-deduct
 *   4.  Edits between save and PUT pass through to the final transaction
 *   5.  transactionNumber persists across the conversion
 *   6.  Concurrent PUTs do not yield two completed copies
 *   7.  Oversold items on conversion surface in _oversoldItems
 *   8.  Direct create path (no prior draft) still works exactly once
 */

process.env.JWT_SECRET = 'test-secret';

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import express, { type Express } from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

import transactionsRoutes from '../../routes/transactions.routes.js';
import { errorHandler } from '../../middlewares/errorHandler.middleware.js';
import { clearUserCache } from '../../middlewares/auth.middleware.js';
import { User } from '../../models/User.js';

import {
  createTestProduct,
  createTestUnit,
  Product,
  InventoryMovement,
} from '../setup/test-fixtures.js';
import { teardownTestDB } from '../setup/mongodb-memory-server.js';
import {
  setupReplSetDB,
  teardownReplSetDB,
  clearReplSetCollections,
} from '../setup/mongodb-replset-server.js';

import { Transaction } from '../../models/Transaction.js';
import { BlendTemplate } from '../../models/BlendTemplate.js';
import { Bundle } from '../../models/Bundle.js';
import { User as UserModel } from '../../models/User.js';

beforeAll(async () => {
  await teardownTestDB();
  await setupReplSetDB();
  // Force-create all indexes up front. Without this, the first transactional
  // write hits a "catalog changes" race when mongoose creates indexes lazily
  // — easy to trip when a different test file ran first in the same process.
  // Note: Product.init() is intentionally skipped — its sku partial index uses
  // a $ne expression that mongo refuses (a pre-existing schema quirk noted in
  // wiki/blend-infrastructure.md). The collection still works in practice.
  await Promise.all([
    Transaction.init(),
    InventoryMovement.init(),
    BlendTemplate.init(),
    Bundle.init(),
    UserModel.init(),
  ]);
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
  app.use('/api/transactions', transactionsRoutes);
  app.use(errorHandler);
  return app;
}

const app = buildApp();

async function createSuperAdminToken(label = 'admin'): Promise<string> {
  const u = await User.create({
    email: `${label}-${Date.now()}-${Math.random()}@test.local`,
    username: `${label}-${Date.now()}-${Math.random()}`,
    name: 'Super Admin',
    password: 'x',
    role: 'super_admin',
    isActive: true,
  });
  return jwt.sign(
    { userId: String(u._id), role: 'super_admin' },
    process.env.JWT_SECRET!,
    { expiresIn: '1h' },
  );
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

function buildItem(p: { _id: unknown; name: string; unitOfMeasurement: unknown; sellingPrice?: number }, qty: number) {
  const unitId = typeof p.unitOfMeasurement === 'object' && p.unitOfMeasurement !== null
    ? String((p.unitOfMeasurement as { _id?: unknown })._id ?? p.unitOfMeasurement)
    : String(p.unitOfMeasurement ?? '');
  const unitPrice = p.sellingPrice ?? 25;
  return {
    productId: String(p._id),
    name: p.name,
    quantity: qty,
    convertedQuantity: qty,
    unitOfMeasurementId: unitId,
    baseUnit: 'unit',
    itemType: 'product' as const,
    saleType: 'quantity' as const,
    unitPrice,
    totalPrice: unitPrice * qty,
  };
}

// ────────────────────────────────────────────────────────────────────
// 1. Save draft + convert to completed → exactly one transaction
// ────────────────────────────────────────────────────────────────────
describe('Draft conversion stress — duplicate prevention', () => {
  it('save draft + PUT status=completed yields exactly 1 Transaction (the original bug)', async () => {
    const token = await createSuperAdminToken();
    const product = await seedProduct({ currentStock: 50 });

    // Step 1: save draft
    const draftRes = await request(app)
      .post('/api/transactions/drafts/autosave')
      .set('Authorization', `Bearer ${token}`)
      .send({
        draftId: `client-draft-${Date.now()}-${Math.random()}`,
        draftName: 'Test Draft',
        formData: {
          customerName: 'Walk-in',
          items: [buildItem(product as any, 5)],
          subtotal: 125,
          total: 125,
          paymentMethod: 'cash',
        },
      });

    expect(draftRes.status).toBe(200);
    expect(draftRes.body.success).toBe(true);
    expect(draftRes.body.transactionId).toBeDefined();
    const draftTxnId = draftRes.body.transactionId;

    // After draft: stock unchanged (no deduction for drafts).
    let after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(50);

    // Step 2: convert to completed via PUT (the fixed Pay path).
    const convertRes = await request(app)
      .put(`/api/transactions/${draftTxnId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerName: 'Walk-in',
        items: [buildItem(product as any, 5)],
        subtotal: 125,
        totalAmount: 125,
        paymentMethod: 'cash',
        status: 'completed',
      });

    expect(convertRes.status).toBe(200);

    // Exactly one Transaction in the DB — no duplicate.
    const all = await Transaction.find({});
    expect(all.length).toBe(1);
    expect(String(all[0]._id)).toBe(String(draftTxnId));
    expect(all[0].status).toBe('completed');

    // Stock deducted once.
    after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(45);

    // Movements: exactly one sale movement for this transaction.
    const movements = await InventoryMovement.find({
      reference: all[0].transactionNumber,
      movementType: 'sale',
    });
    expect(movements.length).toBe(1);
    expect(movements[0].convertedQuantity).toBe(5);
  });

  it('idempotent: replaying the PUT does not double-deduct', async () => {
    const token = await createSuperAdminToken();
    const product = await seedProduct({ currentStock: 50 });

    const draftRes = await request(app)
      .post('/api/transactions/drafts/autosave')
      .set('Authorization', `Bearer ${token}`)
      .send({
        draftId: 'client-draft-idem',
        draftName: 'Idem',
        formData: {
          customerName: 'Walk-in',
          items: [buildItem(product as any, 7)],
          subtotal: 175,
          total: 175,
          paymentMethod: 'cash',
        },
      });

    const draftTxnId = draftRes.body.transactionId;

    const body = {
      customerName: 'Walk-in',
      items: [buildItem(product as any, 7)],
      subtotal: 175,
      totalAmount: 175,
      paymentMethod: 'cash',
      status: 'completed',
    };

    // First PUT: deducts.
    await request(app)
      .put(`/api/transactions/${draftTxnId}`)
      .set('Authorization', `Bearer ${token}`)
      .send(body)
      .expect(200);

    let after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(43);

    // Second PUT with the same body: still 'completed', no further deduction.
    await request(app)
      .put(`/api/transactions/${draftTxnId}`)
      .set('Authorization', `Bearer ${token}`)
      .send(body)
      .expect(200);

    after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(43); // unchanged

    // One sale movement exists, not two.
    const tx = await Transaction.findById(draftTxnId);
    const movements = await InventoryMovement.find({
      reference: tx!.transactionNumber,
      movementType: 'sale',
    });
    expect(movements.length).toBe(1);
  });

  it('edits made between save and PUT are reflected in the final transaction', async () => {
    const token = await createSuperAdminToken();
    const productA = await seedProduct({ name: 'Product A', currentStock: 50, sellingPrice: 10 });
    const productB = await seedProduct({ name: 'Product B', currentStock: 50, sellingPrice: 30 });

    // Draft saves Product A x 2.
    const draftRes = await request(app)
      .post('/api/transactions/drafts/autosave')
      .set('Authorization', `Bearer ${token}`)
      .send({
        draftId: 'client-draft-edit',
        draftName: 'Edit',
        formData: {
          customerName: 'Walk-in',
          items: [buildItem(productA as any, 2)],
          subtotal: 20,
          total: 20,
          paymentMethod: 'cash',
        },
      });

    const draftTxnId = draftRes.body.transactionId;

    // User changes their mind: removes A, adds 3x B.
    await request(app)
      .put(`/api/transactions/${draftTxnId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerName: 'Edited Customer',
        items: [buildItem(productB as any, 3)],
        subtotal: 90,
        totalAmount: 90,
        paymentMethod: 'cash',
        status: 'completed',
      })
      .expect(200);

    const final = await Transaction.findById(draftTxnId);
    expect(final!.customerName).toBe('Edited Customer');
    expect(final!.items.length).toBe(1);
    expect(final!.items[0].productId).toBe(String(productB._id));
    expect(final!.items[0].quantity).toBe(3);

    // Stock: A untouched (was never deducted), B decremented by 3.
    const afterA = await Product.findById(productA._id);
    const afterB = await Product.findById(productB._id);
    expect(afterA!.currentStock).toBe(50);
    expect(afterB!.currentStock).toBe(47);
  });

  it('regression: PUT body with transactionNumber="" does NOT wipe the saved number', async () => {
    // Reproduces the symptom where a completed transaction came back with an
    // empty transactionNumber after draft → completed conversion. Root cause:
    // the form initializes transactionNumber to '' and that empty value was
    // overwriting the server-assigned TXN-... on the PUT.
    const token = await createSuperAdminToken();
    const product = await seedProduct({ currentStock: 50 });

    const draftRes = await request(app)
      .post('/api/transactions/drafts/autosave')
      .set('Authorization', `Bearer ${token}`)
      .send({
        draftId: `client-draft-empty-num-${Date.now()}-${Math.random()}`,
        draftName: 'Empty Number',
        formData: {
          customerName: 'Walk-in',
          items: [buildItem(product as any, 1)],
          subtotal: 25,
          total: 25,
          paymentMethod: 'cash',
        },
      });

    const draftTxnId = draftRes.body.transactionId;
    const before = await Transaction.findById(draftTxnId);
    const originalNumber = before!.transactionNumber;
    expect(originalNumber).toMatch(/^TXN-/);

    // Simulate the real frontend payload — `transactionNumber: ''` from the
    // form, plus the rest of the data.
    await request(app)
      .put(`/api/transactions/${draftTxnId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerName: 'Walk-in',
        items: [buildItem(product as any, 1)],
        subtotal: 25,
        totalAmount: 25,
        paymentMethod: 'cash',
        status: 'completed',
        transactionNumber: '',  // ← the bug bait
      })
      .expect(200);

    const after = await Transaction.findById(draftTxnId);
    expect(after!.transactionNumber).toBe(originalNumber);
    expect(after!.transactionNumber).toMatch(/^TXN-/);
    expect(after!.status).toBe('completed');
  });

  it('transactionNumber assigned on draft persists through conversion', async () => {
    const token = await createSuperAdminToken();
    const product = await seedProduct({ currentStock: 50 });

    const draftRes = await request(app)
      .post('/api/transactions/drafts/autosave')
      .set('Authorization', `Bearer ${token}`)
      .send({
        draftId: 'client-draft-num',
        draftName: 'Num',
        formData: {
          customerName: 'Walk-in',
          items: [buildItem(product as any, 1)],
          subtotal: 25,
          total: 25,
          paymentMethod: 'cash',
        },
      });

    const draftTxnId = draftRes.body.transactionId;
    const draftDoc = await Transaction.findById(draftTxnId);
    const originalNumber = draftDoc!.transactionNumber;
    expect(originalNumber).toMatch(/^TXN-/);

    await request(app)
      .put(`/api/transactions/${draftTxnId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerName: 'Walk-in',
        items: [buildItem(product as any, 1)],
        subtotal: 25,
        totalAmount: 25,
        paymentMethod: 'cash',
        status: 'completed',
      })
      .expect(200);

    const completedDoc = await Transaction.findById(draftTxnId);
    expect(completedDoc!.transactionNumber).toBe(originalNumber);
    expect(completedDoc!.status).toBe('completed');
  });
});

// ────────────────────────────────────────────────────────────────────
// 2. Concurrent submits — no duplicate completed copies
// ────────────────────────────────────────────────────────────────────
describe('Draft conversion stress — concurrency', () => {
  it('5 concurrent PUTs on the same draft yield one completed Transaction with one deduction', async () => {
    const token = await createSuperAdminToken();
    const product = await seedProduct({ currentStock: 100 });

    const draftRes = await request(app)
      .post('/api/transactions/drafts/autosave')
      .set('Authorization', `Bearer ${token}`)
      .send({
        draftId: 'client-draft-race',
        draftName: 'Race',
        formData: {
          customerName: 'Walk-in',
          items: [buildItem(product as any, 4)],
          subtotal: 100,
          total: 100,
          paymentMethod: 'cash',
        },
      });

    const draftTxnId = draftRes.body.transactionId;

    const body = {
      customerName: 'Walk-in',
      items: [buildItem(product as any, 4)],
      subtotal: 100,
      totalAmount: 100,
      paymentMethod: 'cash',
      status: 'completed',
    };

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(app)
          .put(`/api/transactions/${draftTxnId}`)
          .set('Authorization', `Bearer ${token}`)
          .send(body)
          .then((r) => r.status),
      ),
    );

    // All 5 PUTs return 200 (idempotent at the inventory layer).
    expect(results.every((s) => s === 200)).toBe(true);

    // Still exactly one transaction document.
    const all = await Transaction.find({});
    expect(all.length).toBe(1);
    expect(all[0].status).toBe('completed');

    // Stock decremented exactly once: 100 - 4 = 96.
    const after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(96);

    // Exactly one sale movement.
    const movements = await InventoryMovement.find({
      reference: all[0].transactionNumber,
      movementType: 'sale',
    });
    expect(movements.length).toBe(1);
  }, 30_000);
});

// ────────────────────────────────────────────────────────────────────
// 3. Oversold items surface on conversion
// ────────────────────────────────────────────────────────────────────
describe('Draft conversion stress — oversold reporting', () => {
  it('PUT response includes _oversoldItems when conversion drives stock negative', async () => {
    const token = await createSuperAdminToken();
    const product = await seedProduct({ currentStock: 2 });

    const draftRes = await request(app)
      .post('/api/transactions/drafts/autosave')
      .set('Authorization', `Bearer ${token}`)
      .send({
        draftId: 'client-draft-oversell',
        draftName: 'Oversell',
        formData: {
          customerName: 'Walk-in',
          items: [buildItem(product as any, 10)],
          subtotal: 250,
          total: 250,
          paymentMethod: 'cash',
        },
      });

    const draftTxnId = draftRes.body.transactionId;

    const convertRes = await request(app)
      .put(`/api/transactions/${draftTxnId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerName: 'Walk-in',
        items: [buildItem(product as any, 10)],
        subtotal: 250,
        totalAmount: 250,
        paymentMethod: 'cash',
        status: 'completed',
      });

    expect(convertRes.status).toBe(200);

    // Conversion succeeds (sell-through-permissive) and the oversold item
    // surfaces in the response so the toast can fire.
    expect(Array.isArray(convertRes.body._oversoldItems)).toBe(true);
    expect(convertRes.body._oversoldItems.length).toBe(1);
    expect(convertRes.body._oversoldItems[0].productId).toBe(String(product._id));
    expect(convertRes.body._oversoldItems[0].deficit).toBe(8);  // |2 - 10| = 8
    expect(convertRes.body._oversoldItems[0].currentStock).toBe(-8);

    const after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(-8);
  });
});

// ────────────────────────────────────────────────────────────────────
// 4. Direct create path remains intact
// ────────────────────────────────────────────────────────────────────
describe('Draft conversion stress — direct create unaffected', () => {
  it('POST /transactions (no prior draft) still creates exactly one completed Transaction', async () => {
    const token = await createSuperAdminToken();
    const product = await seedProduct({ currentStock: 50 });

    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerName: 'Walk-in',
        items: [buildItem(product as any, 6)],
        subtotal: 150,
        totalAmount: 150,
        paymentMethod: 'cash',
        paymentStatus: 'paid',
        paidAmount: 150,
        status: 'completed',
      });

    expect(res.status).toBe(201);

    const all = await Transaction.find({});
    expect(all.length).toBe(1);
    expect(all[0].status).toBe('completed');

    const after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(44);  // 50 - 6
  });
});

// ────────────────────────────────────────────────────────────────────
// 5. Repeated draft saves — still upsert, never duplicates
// ────────────────────────────────────────────────────────────────────
describe('Draft conversion stress — repeated autosave is upsert', () => {
  it('saving the same draftId twice updates rather than duplicates', async () => {
    const token = await createSuperAdminToken();
    const product = await seedProduct({ currentStock: 50 });

    const body1 = {
      draftId: 'same-draft',
      draftName: 'First',
      formData: {
        customerName: 'Customer A',
        items: [buildItem(product as any, 1)],
        subtotal: 25,
        total: 25,
        paymentMethod: 'cash',
      },
    };
    const body2 = {
      draftId: 'same-draft',
      draftName: 'Second',
      formData: {
        customerName: 'Customer B',
        items: [buildItem(product as any, 3)],
        subtotal: 75,
        total: 75,
        paymentMethod: 'cash',
      },
    };

    const r1 = await request(app)
      .post('/api/transactions/drafts/autosave')
      .set('Authorization', `Bearer ${token}`)
      .send(body1);
    const r2 = await request(app)
      .post('/api/transactions/drafts/autosave')
      .set('Authorization', `Bearer ${token}`)
      .send(body2);

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    // Same transactionId across both saves.
    expect(r2.body.transactionId).toBe(r1.body.transactionId);

    const all = await Transaction.find({});
    expect(all.length).toBe(1);
    expect(all[0].customerName).toBe('Customer B');  // latest wins
    expect(all[0].items[0].quantity).toBe(3);

    // Drafts still don't deduct stock.
    const after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(50);
  });
});
