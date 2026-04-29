/**
 * HTTP-level smoke + stress for the discountFlags work shipped 2026-04-28.
 *
 * Drives the actual /api/transactions and /api/inventory/products endpoints
 * end-to-end so we catch regressions at the route + middleware layer, not
 * just at the service. Replica-set Mongo because transaction creation opens
 * sessions.
 */

process.env.JWT_SECRET = 'test-secret';

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import express, { type Express } from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

import transactionsRoutes from '../../routes/transactions.routes.js';
import inventoryRoutes from '../../routes/inventory.routes.js';
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

beforeAll(async () => {
  await teardownTestDB();
  await setupReplSetDB();
  await Promise.all([
    Transaction.init(),
    InventoryMovement.init(),
    User.init(),
  ]);
}, 60_000);

afterAll(async () => { await teardownReplSetDB(); }, 30_000);

beforeEach(async () => {
  await clearReplSetCollections();
  clearUserCache();
});

function buildApp(): Express {
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use('/api/transactions', transactionsRoutes);
  app.use('/api/inventory', inventoryRoutes);
  app.use(errorHandler);
  return app;
}
const app = buildApp();

async function makeAdminToken() {
  const u = await User.create({
    email: `admin-${Date.now()}-${Math.random()}@test.local`,
    username: `admin-${Date.now()}-${Math.random()}`,
    name: 'admin test',
    password: 'x',
    role: 'super_admin',
    isActive: true,
  });
  return jwt.sign({ userId: String(u._id), role: 'super_admin' }, process.env.JWT_SECRET!, { expiresIn: '1h' });
}

async function seedProduct(overrides: Parameters<typeof createTestProduct>[0] = {}, flags?: { discountableForAll?: boolean; discountableForMembers?: boolean; discountableInBlends?: boolean }) {
  const unit = await createTestUnit({ name: `unit-${Date.now()}-${Math.random()}` });
  const product = await createTestProduct({
    unitOfMeasurement: unit._id as mongoose.Types.ObjectId,
    currentStock: 100,
    availableStock: 100,
    costPrice: 40,
    sellingPrice: 100,
    ...overrides,
  });
  if (flags) {
    await Product.updateOne({ _id: product._id }, { $set: { discountFlags: flags } });
  }
  return product;
}

async function seedMemberPatient(discountPercentage = 10) {
  const Patient = mongoose.models.Patient || mongoose.model(
    'Patient',
    new mongoose.Schema({
      firstName: String,
      lastName: String,
      memberBenefits: { membershipTier: String, discountPercentage: Number },
    }, { strict: false }),
  );
  return Patient.create({
    firstName: 'Member',
    lastName: 'Test',
    memberBenefits: { membershipTier: 'gold', discountPercentage },
  });
}

function buildItem(p: { _id: unknown; name: string; unitOfMeasurement: unknown; sellingPrice?: number }, qty: number, opts: { discountAmount?: number } = {}) {
  const unitId = typeof p.unitOfMeasurement === 'object' && p.unitOfMeasurement !== null
    ? String((p.unitOfMeasurement as { _id?: unknown })._id ?? p.unitOfMeasurement)
    : String(p.unitOfMeasurement ?? '');
  const unitPrice = p.sellingPrice ?? 100;
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
    totalPrice: unitPrice * qty - (opts.discountAmount ?? 0),
    discountAmount: opts.discountAmount ?? 0,
  };
}

// ═══════════════════════════════════════════════════════════════════
// SMOKE — basic flag enforcement at HTTP boundary
// ═══════════════════════════════════════════════════════════════════
describe('SMOKE — discountFlags at the HTTP boundary', () => {
  it('POST /api/transactions with a line discount on a flagged product → 400', async () => {
    const token = await makeAdminToken();
    const blocked = await seedProduct({ name: 'BIOMA Test', sellingPrice: 390 }, { discountableForAll: false, discountableForMembers: true });

    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerName: 'Walk-in',
        items: [buildItem(blocked as any, 1, { discountAmount: 39 })],
        paymentMethod: 'cash', paymentStatus: 'paid', paidAmount: 351,
        status: 'completed',
      });

    expect(res.status).toBe(400);
    expect(res.body.code || res.body.error).toMatch(/PRODUCT_NOT_DISCOUNTABLE|non-discountable/i);
  });

  it('POST /api/transactions with bill discount when one item is flagged → 400', async () => {
    const token = await makeAdminToken();
    const ok = await seedProduct({ name: 'OK', sellingPrice: 100 });
    const blocked = await seedProduct({ name: 'Blocked', sellingPrice: 200 }, { discountableForAll: false });

    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerName: 'Walk-in',
        items: [buildItem(ok as any, 1), buildItem(blocked as any, 1)],
        discountAmount: 30, // bill-level
        paymentMethod: 'cash', paymentStatus: 'paid', paidAmount: 270,
        status: 'completed',
      });

    expect(res.status).toBe(400);
    expect(String(res.body.error || res.body.message || '')).toMatch(/Blocked|non-discountable|not eligible/i);
  });

  it('POST /api/transactions with no discount on a flagged product → 201', async () => {
    const token = await makeAdminToken();
    const blocked = await seedProduct({ name: 'BIOMA Test', sellingPrice: 390 }, { discountableForAll: false });

    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerName: 'Walk-in',
        items: [buildItem(blocked as any, 1)], // no discount
        paymentMethod: 'cash', paymentStatus: 'paid', paidAmount: 390,
        status: 'completed',
      });

    expect(res.status).toBe(201);
    expect(res.body.totalAmount).toBe(390);
    expect(res.body.items[0].discountAmount).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// SMOKE — member-tier auto-apply skips flagged products
// ═══════════════════════════════════════════════════════════════════
describe('SMOKE — member discount auto-apply respects discountFlags', () => {
  it('member customer with a flagged item gets discount on others, not on the flagged one', async () => {
    const token = await makeAdminToken();
    const patient = await seedMemberPatient(10);
    const ok = await seedProduct({ name: 'Discountable', sellingPrice: 100 });
    const blocked = await seedProduct({ name: 'BIOMA Test', sellingPrice: 390 }, { discountableForAll: false, discountableForMembers: true });

    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerId: String(patient._id),
        customerName: 'Member',
        items: [buildItem(ok as any, 1), buildItem(blocked as any, 1)],
        paymentMethod: 'cash', paymentStatus: 'paid',
        paidAmount: 480, // 90 + 390
        status: 'completed',
      });

    expect(res.status).toBe(201);

    const okItem = res.body.items.find((i: { name: string }) => i.name === 'Discountable');
    const blockedItem = res.body.items.find((i: { name: string }) => i.name === 'BIOMA Test');

    expect(okItem.discountAmount).toBeCloseTo(10, 2);   // 10% of $100
    expect(blockedItem.discountAmount).toBe(0);          // flag honored
    expect(res.body.totalAmount).toBeCloseTo(480, 2);   // 90 + 390
  });
});

// ═══════════════════════════════════════════════════════════════════
// SMOKE — products endpoint round-trip on discountFlags
// ═══════════════════════════════════════════════════════════════════
describe('SMOKE — PUT /api/inventory/products/:id persists discountFlags', () => {
  it('flips discountableForAll via PUT and the next transaction honors it', async () => {
    const token = await makeAdminToken();
    const patient = await seedMemberPatient(10); // 10% tier so the "before" call has a valid discount
    const product = await seedProduct({ name: 'Toggle Target', sellingPrice: 100 });

    // Sanity: starts as default (discountable). The 10% discount fits the tier.
    const before = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerId: String(patient._id),
        customerName: 'Member',
        items: [buildItem(product as any, 1, { discountAmount: 10 })],
        paymentMethod: 'cash', paymentStatus: 'paid', paidAmount: 90,
        status: 'completed',
      });
    expect(before.status).toBe(201);

    // Flip the flag via PUT.
    const put = await request(app)
      .put(`/api/inventory/products/${product._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ discountFlags: { discountableForAll: false, discountableForMembers: true, discountableInBlends: false } });
    expect(put.status).toBe(200);
    expect(put.body.discountFlags.discountableForAll).toBe(false);

    // Re-fetch from DB to confirm persistence (not just the response echo).
    const dbCopy = await Product.findById(product._id).lean() as { discountFlags?: { discountableForAll?: boolean } };
    expect(dbCopy.discountFlags?.discountableForAll).toBe(false);

    // Next transaction with a discount on this product → 400.
    const after = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerId: String(patient._id),
        customerName: 'Member',
        items: [buildItem(product as any, 1, { discountAmount: 10 })],
        paymentMethod: 'cash', paymentStatus: 'paid', paidAmount: 90,
        status: 'completed',
      });
    expect(after.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════════
// SMOKE — PUT /api/transactions/:id (update path) also enforces flags
// ═══════════════════════════════════════════════════════════════════
describe('SMOKE — PUT /api/transactions/:id rejects discount on flagged product', () => {
  it('cannot smuggle a discount onto a flagged product by editing a draft', async () => {
    const token = await makeAdminToken();
    const blocked = await seedProduct({ name: 'BIOMA Test', sellingPrice: 390 }, { discountableForAll: false });

    // Create a draft with no discount.
    const created = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerName: 'Walk-in',
        items: [buildItem(blocked as any, 1)],
        paymentMethod: 'cash', paymentStatus: 'pending', paidAmount: 0,
        status: 'draft',
      });
    expect(created.status).toBe(201);
    const id = created.body._id;

    // Try to PUT a discount onto it.
    const putRes = await request(app)
      .put(`/api/transactions/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [buildItem(blocked as any, 1, { discountAmount: 39 })],
      });

    expect(putRes.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════════
// STRESS — high concurrency on flagged products
// ═══════════════════════════════════════════════════════════════════
describe('STRESS — 30 concurrent transactions on a flagged product', () => {
  it('all 30 succeed with no discount applied (sell-permissive policy)', async () => {
    const token = await makeAdminToken();
    const blocked = await seedProduct({ name: 'BIOMA Test', sellingPrice: 100, currentStock: 1000 }, { discountableForAll: false });

    const calls = Array.from({ length: 30 }, () =>
      request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          customerName: 'Walk-in',
          items: [buildItem(blocked as any, 1)],
          paymentMethod: 'cash', paymentStatus: 'paid', paidAmount: 100,
          status: 'completed',
        }),
    );

    const results = await Promise.all(calls);
    const successes = results.filter(r => r.status === 201);
    expect(successes.length).toBe(30);
    for (const r of successes) {
      expect(r.body.items[0].discountAmount).toBe(0);
      expect(r.body.totalAmount).toBe(100);
    }
  }, 60_000);

  it('20 concurrent transactions for a member customer all skip the flagged item', async () => {
    const token = await makeAdminToken();
    const patient = await seedMemberPatient(15);
    const ok = await seedProduct({ name: 'Discountable', sellingPrice: 100, currentStock: 1000 });
    const blocked = await seedProduct({ name: 'BIOMA Test', sellingPrice: 390, currentStock: 1000 }, { discountableForAll: false });

    const calls = Array.from({ length: 20 }, () =>
      request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          customerId: String(patient._id),
          customerName: 'Member',
          items: [buildItem(ok as any, 1), buildItem(blocked as any, 1)],
          paymentMethod: 'cash', paymentStatus: 'paid',
          paidAmount: 475, // 100*0.85 + 390
          status: 'completed',
        }),
    );

    const results = await Promise.all(calls);
    const successes = results.filter(r => r.status === 201);
    expect(successes.length).toBe(20);

    for (const r of successes) {
      const okItem = r.body.items.find((i: { name: string }) => i.name === 'Discountable');
      const blockedItem = r.body.items.find((i: { name: string }) => i.name === 'BIOMA Test');
      expect(okItem.discountAmount).toBeCloseTo(15, 2);
      expect(blockedItem.discountAmount).toBe(0);
    }
  }, 60_000);
});

// ═══════════════════════════════════════════════════════════════════
// EDGE — custom blend at margin=0 (the herb dampness root cause)
// ═══════════════════════════════════════════════════════════════════
describe('EDGE — custom blend at margin=0 uses ingredient selling-price sum', () => {
  it('corrects legacy cost-priced custom blend payloads to the ingredient selling-price sum', async () => {
    const token = await makeAdminToken();
    const ing1 = await seedProduct({ name: 'Burdock', sellingPrice: 260, costPrice: 120, containerCapacity: 1000, currentStock: 5000 });
    const ing2 = await seedProduct({ name: 'Oregon Grape', sellingPrice: 480, costPrice: 160, containerCapacity: 1000, currentStock: 5000 });
    const ing3 = await seedProduct({ name: 'Blessed thistle', sellingPrice: 250, costPrice: 80, containerCapacity: 1000, currentStock: 5000 });

    // Mirror the herb-dampness payload: 50ml + 25ml + 25ml at cost = $12,
    // sum-of-selling = $31.25. Frontend (pre-fix) saved unitPrice = cost.
    const customBlendItem = {
      productId: `custom_blend_${Date.now()}`,
      name: 'herb dampness',
      quantity: 1,
      convertedQuantity: 1,
      unitOfMeasurementId: String((ing1 as any).unitOfMeasurement),
      baseUnit: 'Milliliter',
      itemType: 'custom_blend' as const,
      saleType: 'quantity' as const,
      unitPrice: 12,
      totalPrice: 12,
      discountAmount: 0,
      customBlendData: {
        name: 'herb dampness',
        ingredients: [
          { productId: String(ing1._id), name: 'Burdock', quantity: 50, unitOfMeasurementId: String((ing1 as any).unitOfMeasurement), unitName: 'Milliliter', costPerUnit: 0.12, sellingPricePerUnit: 0.26 },
          { productId: String(ing2._id), name: 'Oregon Grape', quantity: 25, unitOfMeasurementId: String((ing2 as any).unitOfMeasurement), unitName: 'Milliliter', costPerUnit: 0.16, sellingPricePerUnit: 0.48 },
          { productId: String(ing3._id), name: 'Blessed thistle', quantity: 25, unitOfMeasurementId: String((ing3 as any).unitOfMeasurement), unitName: 'Milliliter', costPerUnit: 0.08, sellingPricePerUnit: 0.25 },
        ],
        totalIngredientCost: 12,
        marginPercent: 0,
        mixedBy: 'test-user',
        mixedAt: new Date(),
      },
    };

    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerName: 'Walk-in',
        items: [customBlendItem],
        paymentMethod: 'cash', paymentStatus: 'paid', paidAmount: 12,
        status: 'completed',
      });

    expect(res.status).toBe(201);
    const saved = await Transaction.findById(res.body._id).lean() as { items: Array<{ unitPrice?: number; totalPrice?: number; itemType?: string; customBlendData?: { totalIngredientCost?: number } }> };
    const blend = saved.items.find(i => i.itemType === 'custom_blend')!;
    expect(blend.unitPrice).toBe(31.25);
    expect(blend.totalPrice).toBe(31.25);
    expect(blend.customBlendData?.totalIngredientCost).toBe(12);
  });

  it('custom blend with unitPrice=31.25 (sum-of-selling-prices) saves at 31.25', async () => {
    const token = await makeAdminToken();
    const ing = await seedProduct({ name: 'Single', sellingPrice: 250, costPrice: 80, containerCapacity: 1000, currentStock: 5000 });

    const customBlendItem = {
      productId: `custom_blend_${Date.now()}`,
      name: 'sum-priced blend',
      quantity: 1,
      convertedQuantity: 1,
      unitOfMeasurementId: String((ing as any).unitOfMeasurement),
      baseUnit: 'Milliliter',
      itemType: 'custom_blend' as const,
      saleType: 'quantity' as const,
      unitPrice: 31.25,
      totalPrice: 31.25,
      discountAmount: 0,
      customBlendData: {
        name: 'sum-priced blend',
        ingredients: [
          { productId: String(ing._id), name: 'Single', quantity: 100, unitOfMeasurementId: String((ing as any).unitOfMeasurement), unitName: 'Milliliter', costPerUnit: 0.08, sellingPricePerUnit: 0.3125 },
        ],
        totalIngredientCost: 8,
        marginPercent: 0,
        mixedBy: 'test-user',
        mixedAt: new Date(),
      },
    };

    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerName: 'Walk-in',
        items: [customBlendItem],
        paymentMethod: 'cash', paymentStatus: 'paid', paidAmount: 31.25,
        status: 'completed',
      });

    expect(res.status).toBe(201);
    const saved = await Transaction.findById(res.body._id).lean() as { items: Array<{ unitPrice?: number; totalPrice?: number; itemType?: string }> };
    const blend = saved.items.find(i => i.itemType === 'custom_blend')!;
    expect(blend.unitPrice).toBe(31.25);
    expect(blend.totalPrice).toBe(31.25);
  });
});
