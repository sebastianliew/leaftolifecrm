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

async function makeToken(
  role: 'super_admin' | 'admin' | 'manager' | 'staff' = 'admin',
  featurePermissions?: Record<string, Record<string, boolean | number>>
) {
  const u = await User.create({
    email: `${role}-${Date.now()}-${Math.random()}@test.local`,
    username: `${role}-${Date.now()}-${Math.random()}`,
    name: `${role} test`,
    password: 'x',
    role,
    featurePermissions,
    isActive: true,
  });
  return jwt.sign({ userId: String(u._id), role }, process.env.JWT_SECRET!, { expiresIn: '1h' });
}

const makeAdminToken = () => makeToken('admin');
const makeSuperAdminToken = () => makeToken('super_admin');
const makeUnlimitedDiscountToken = () => makeToken('admin', {
  discounts: {
    canApplyDiscounts: true,
    canApplyProductDiscounts: true,
    canApplyBillDiscounts: true,
    unlimitedDiscounts: true,
    maxDiscountPercent: 100,
    maxDiscountAmount: 999999,
  },
});

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

  it('super_admin can apply a full bill discount across non-eligible lines', async () => {
    const token = await makeSuperAdminToken();
    const blocked = await seedProduct(
      { name: 'Blocked Book', sellingPrice: 100, currentStock: 10 },
      { discountableForAll: false }
    );
    const unitId = String((blocked as any).unitOfMeasurement);
    const items = [
      buildItem(blocked as any, 1),
      {
        productId: `custom_blend_${Date.now()}`,
        name: 'Custom blend',
        quantity: 1,
        convertedQuantity: 1,
        unitOfMeasurementId: unitId,
        baseUnit: 'unit',
        itemType: 'custom_blend' as const,
        saleType: 'quantity' as const,
        unitPrice: 50,
        totalPrice: 50,
        discountAmount: 0,
      },
      {
        productId: 'consultation-fee',
        name: 'Consultation Fee',
        quantity: 1,
        convertedQuantity: 1,
        unitOfMeasurementId: unitId,
        baseUnit: 'unit',
        itemType: 'consultation' as const,
        saleType: 'quantity' as const,
        unitPrice: 25,
        totalPrice: 25,
        discountAmount: 0,
        isService: true,
      },
    ];

    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerName: 'Walk-in',
        items,
        discountAmount: 175,
        paymentMethod: 'cash',
        paymentStatus: 'paid',
        paidAmount: 0,
        status: 'completed',
      });

    expect(res.status).toBe(201);
    expect(res.body.totalAmount).toBe(0);
    expect(res.body.discountAmount).toBe(175);
    expect((await Product.findById(blocked._id))!.currentStock).toBe(9);
  });

  it('explicit unlimited discount user can complete a draft with bill discount across credit, consultation, custom blend, and blocked product lines', async () => {
    const token = await makeUnlimitedDiscountToken();
    const blocked = await seedProduct(
      { name: 'Virita Fennel Tab', sellingPrice: 660, currentStock: 10 },
      { discountableForAll: false }
    );
    const unitId = String((blocked as any).unitOfMeasurement);
    const items = [
      {
        productId: `credit_${Date.now()}`,
        name: 'Credit: Credit',
        description: 'Complimentary books 3 pcs',
        quantity: 1,
        convertedQuantity: 1,
        unitOfMeasurementId: unitId,
        baseUnit: 'unit',
        itemType: 'miscellaneous' as const,
        miscellaneousCategory: 'credit',
        saleType: 'quantity' as const,
        unitPrice: -75,
        totalPrice: -75,
        discountAmount: 0,
      },
      buildItem(blocked as any, 1),
      {
        productId: `custom_blend_${Date.now()}`,
        name: 'herb dampness',
        quantity: 1,
        convertedQuantity: 1,
        unitOfMeasurementId: unitId,
        baseUnit: 'Milliliter',
        itemType: 'custom_blend' as const,
        saleType: 'quantity' as const,
        unitPrice: 31.25,
        totalPrice: 31.25,
        discountAmount: 0,
      },
      {
        productId: 'consultation-fee',
        name: 'Consultation Fee',
        quantity: 1,
        convertedQuantity: 1,
        unitOfMeasurementId: unitId,
        baseUnit: 'unit',
        itemType: 'consultation' as const,
        saleType: 'quantity' as const,
        unitPrice: 80,
        totalPrice: 80,
        discountAmount: 0,
        isService: true,
      },
    ];

    const draft = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerName: 'Walk-in',
        items,
        discountAmount: 0,
        paymentMethod: 'cash',
        paymentStatus: 'pending',
        paidAmount: 0,
        status: 'draft',
      });

    expect(draft.status).toBe(201);

    const completed = await request(app)
      .put(`/api/transactions/${draft.body._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        items,
        discountAmount: 69.63,
        subtotal: 696.25,
        totalAmount: 626.62,
        paymentMethod: 'cash',
        paymentStatus: 'paid',
        paidAmount: 626.62,
        status: 'completed',
      });

    expect(completed.status).toBe(200);
    expect(completed.body.status).toBe('completed');
    expect(completed.body.discountAmount).toBe(69.63);
    expect(completed.body.totalAmount).toBe(626.62);
    expect((await Product.findById(blocked._id))!.currentStock).toBe(9);
  });

  it('super_admin can gift a product line while still deducting stock', async () => {
    const token = await makeSuperAdminToken();
    const book = await seedProduct({ name: 'Gift Book', sellingPrice: 40, currentStock: 10 });

    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerName: 'Walk-in',
        items: [{
          ...buildItem(book as any, 2, { discountAmount: 80 }),
          discountSource: 'gift',
          discountReason: 'Gift / free of charge',
        }],
        paymentMethod: 'cash',
        paymentStatus: 'paid',
        paidAmount: 0,
        status: 'completed',
      });

    expect(res.status).toBe(201);
    expect(res.body.totalAmount).toBe(0);
    expect(res.body.items[0].discountAmount).toBe(80);
    expect(res.body.items[0].discountSource).toBe('gift');
    expect(res.body.items[0].totalPrice).toBe(0);
    expect((await Product.findById(book._id))!.currentStock).toBe(8);
  });

  it('gifted drafts complete once, stay free, and deduct stock on completion', async () => {
    const token = await makeSuperAdminToken();
    const book = await seedProduct({ name: 'Gift Draft Book', sellingPrice: 40, currentStock: 10 });

    const draft = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerName: 'Walk-in',
        items: [{
          ...buildItem(book as any, 2, { discountAmount: 80 }),
          discountSource: 'gift',
          discountReason: 'Gift / free of charge',
        }],
        paymentMethod: 'cash',
        paymentStatus: 'pending',
        paidAmount: 0,
        status: 'draft',
      });

    expect(draft.status).toBe(201);
    expect((await Product.findById(book._id))!.currentStock).toBe(10);

    const completed = await request(app)
      .put(`/api/transactions/${draft.body._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        ...draft.body,
        status: 'completed',
        paymentStatus: 'paid',
        paidAmount: 0,
      });

    expect(completed.status).toBe(200);
    expect(completed.body.totalAmount).toBe(0);
    expect(completed.body.items[0].discountSource).toBe('gift');
    expect(completed.body.items[0].discountAmount).toBe(80);
    expect(completed.body.items[0].totalPrice).toBe(0);
    expect((await Product.findById(book._id))!.currentStock).toBe(8);
  });

  it('editing a completed gifted transaction preserves free pricing and applies only inventory delta', async () => {
    const token = await makeSuperAdminToken();
    const book = await seedProduct({ name: 'Completed Gift Book', sellingPrice: 40, currentStock: 10 });

    const created = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerName: 'Walk-in',
        items: [{
          ...buildItem(book as any, 1, { discountAmount: 40 }),
          discountSource: 'gift',
          discountReason: 'Gift / free of charge',
        }],
        paymentMethod: 'cash',
        paymentStatus: 'paid',
        paidAmount: 0,
        status: 'completed',
      });

    expect(created.status).toBe(201);
    expect((await Product.findById(book._id))!.currentStock).toBe(9);

    const editedItem = {
      ...created.body.items[0],
      quantity: 3,
      convertedQuantity: 3,
    };
    const edited = await request(app)
      .put(`/api/transactions/${created.body._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        ...created.body,
        items: [editedItem],
        subtotal: 120,
        totalAmount: 0,
        paymentStatus: 'paid',
        paidAmount: 0,
      });

    expect(edited.status).toBe(200);
    expect(edited.body.totalAmount).toBe(0);
    expect(edited.body.items[0].discountSource).toBe('gift');
    expect(edited.body.items[0].discountAmount).toBe(120);
    expect(edited.body.items[0].totalPrice).toBe(0);
    expect((await Product.findById(book._id))!.currentStock).toBe(7);
  });

  it('non-super-admin cannot smuggle a gift source with zero client discount', async () => {
    const token = await makeAdminToken();
    const book = await seedProduct({ name: 'Not A Gift Book', sellingPrice: 40, currentStock: 10 });

    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerName: 'Walk-in',
        items: [{
          ...buildItem(book as any, 1, { discountAmount: 0 }),
          discountSource: 'gift',
          discountReason: 'Gift / free of charge',
        }],
        paymentMethod: 'cash',
        paymentStatus: 'paid',
        paidAmount: 40,
        status: 'completed',
    });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MANUAL_OVERRIDE_FORBIDDEN');
    expect(String(res.body.allErrors?.[0]?.code || '')).toBe('MANUAL_OVERRIDE_FORBIDDEN');
    expect((await Product.findById(book._id))!.currentStock).toBe(10);
  });

  it('POST /api/transactions/calculate rejects non-super gift metadata', async () => {
    const token = await makeAdminToken();
    const book = await seedProduct({ name: 'Preview Gift Book', sellingPrice: 40, currentStock: 10 });

    const res = await request(app)
      .post('/api/transactions/calculate')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{
          ...buildItem(book as any, 1),
          discountSource: 'gift',
          discountReason: 'Gift / free of charge',
        }],
        discountAmount: 0,
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MANUAL_OVERRIDE_FORBIDDEN');
  });

  it('POST /api/transactions/drafts/autosave rejects non-super gift metadata', async () => {
    const token = await makeAdminToken();
    const book = await seedProduct({ name: 'Draft Gift Book', sellingPrice: 40, currentStock: 10 });

    const res = await request(app)
      .post('/api/transactions/drafts/autosave')
      .set('Authorization', `Bearer ${token}`)
      .send({
        draftId: `draft-${Date.now()}`,
        draftName: 'Gift draft',
        formData: {
          customerName: 'Walk-in',
          items: [{
            ...buildItem(book as any, 1),
            discountSource: 'gift',
            discountReason: 'Gift / free of charge',
          }],
          subtotal: 40,
          discount: 0,
          total: 40,
          paymentMethod: 'cash',
        },
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MANUAL_OVERRIDE_FORBIDDEN');
  });

  it('PUT /api/transactions/:id rejects non-super gift metadata on update', async () => {
    const token = await makeAdminToken();
    const book = await seedProduct({ name: 'Update Gift Book', sellingPrice: 40, currentStock: 10 });

    const created = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerName: 'Walk-in',
        items: [buildItem(book as any, 1)],
        paymentMethod: 'cash',
        paymentStatus: 'paid',
        paidAmount: 40,
        status: 'completed',
      });

    expect(created.status).toBe(201);
    expect((await Product.findById(book._id))!.currentStock).toBe(9);

    const res = await request(app)
      .put(`/api/transactions/${created.body._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        ...created.body,
        items: [{
          ...created.body.items[0],
          discountSource: 'gift',
          discountReason: 'Gift / free of charge',
        }],
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MANUAL_OVERRIDE_FORBIDDEN');
    expect((await Product.findById(book._id))!.currentStock).toBe(9);
  });

  it('super_admin cannot gift custom blends but can manually override them', async () => {
    const token = await makeSuperAdminToken();
    const product = await seedProduct({ name: 'Manual Anchor', sellingPrice: 100 });
    const unitId = String((product as any).unitOfMeasurement);
    const customBlend = {
      productId: `custom_blend_${Date.now()}`,
      name: 'Manual blend',
      quantity: 1,
      convertedQuantity: 1,
      unitOfMeasurementId: unitId,
      baseUnit: 'unit',
      itemType: 'custom_blend' as const,
      saleType: 'quantity' as const,
      unitPrice: 80,
      totalPrice: 80,
      discountAmount: 80,
    };

    const giftRes = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerName: 'Walk-in',
        items: [{ ...customBlend, discountSource: 'gift', discountReason: 'Gift / free of charge' }],
        paymentMethod: 'cash',
        paymentStatus: 'paid',
        paidAmount: 0,
        status: 'completed',
      });

    expect(giftRes.status).toBe(400);
    expect(giftRes.body.code).toBe('GIFT_ITEM_NOT_ELIGIBLE');

    const manualRes = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerName: 'Walk-in',
        items: [{ ...customBlend, discountSource: 'manual_override', discountReason: 'VIP override' }],
        paymentMethod: 'cash',
        paymentStatus: 'paid',
        paidAmount: 0,
        status: 'completed',
      });

    expect(manualRes.status).toBe(201);
    expect(manualRes.body.totalAmount).toBe(0);
    expect(manualRes.body.items[0].discountSource).toBe('manual_override');
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
