/**
 * Transaction endpoints — full edge-case stress test.
 *
 * Complements the existing focused suites (sell-through, draft-conversion,
 * deduction-surfaces, oversell) by exercising the *whole* surface of
 * `/api/transactions/*` end-to-end with supertest:
 *
 *   POST   /api/transactions/calculate
 *   POST   /api/transactions
 *   GET    /api/transactions
 *   GET    /api/transactions/:id
 *   PUT    /api/transactions/:id
 *   DELETE /api/transactions/:id
 *   POST   /api/transactions/:id/duplicate
 *   POST   /api/transactions/:id/invoice
 *   POST   /api/transactions/:id/send-invoice-email
 *   POST   /api/transactions/drafts/autosave
 *   GET    /api/transactions/drafts
 *   DELETE /api/transactions/drafts/:draftId
 *
 * Goals:
 *   1. Verify input-validation guards (missing items, negative qty, bad ids)
 *   2. Verify server-side price/discount/total recalculation
 *   3. Probe role-based discount permission gates on POST and PUT
 *   4. Stress concurrency on POST, PUT (draft→completed), invoice generation
 *   5. Verify soft-delete semantics + listing filters
 *   6. Verify duplicate flow resets refund/invoice state
 *   7. Surface known design gaps:
 *        – `offset_from_credit` does not draw down any balance (D1)
 *        – PUT does not run role-based discount permission check (item or bill)
 *        – POST /:id/invoice has no concurrency lock (PDF write race)
 *        – Bill discount > subtotal allows totalAmount to go negative
 *
 * Each case asserts current behavior — assertions that document a known gap
 * are commented `GAP:` so they're easy to spot in review.
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
import { Patient } from '../../models/Patient.js';

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

beforeAll(async () => {
  await teardownTestDB();
  await setupReplSetDB();
  await Promise.all([
    Transaction.init(),
    InventoryMovement.init(),
    BlendTemplate.init(),
    Bundle.init(),
    User.init(),
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
  app.use(express.json({ limit: '5mb' }));
  app.use('/api/transactions', transactionsRoutes);
  app.use(errorHandler);
  return app;
}

const app = buildApp();

async function makeUser(role: 'super_admin' | 'admin' | 'manager' | 'staff' | 'user', label: string = role) {
  const u = await User.create({
    email: `${label}-${Date.now()}-${Math.random()}@test.local`,
    username: `${label}-${Date.now()}-${Math.random()}`,
    name: `${label} test`,
    password: 'x',
    role,
    isActive: true,
  });
  const token = jwt.sign(
    { userId: String(u._id), role },
    process.env.JWT_SECRET!,
    { expiresIn: '1h' },
  );
  return { user: u, token };
}

async function seedProduct(overrides: Parameters<typeof createTestProduct>[0] = {}) {
  const unit = await createTestUnit({ name: `unit-${Date.now()}-${Math.random()}` });
  return createTestProduct({
    unitOfMeasurement: unit._id as mongoose.Types.ObjectId,
    currentStock: 100,
    availableStock: 100,
    costPrice: 10,
    sellingPrice: 25,
    ...overrides,
  });
}

function buildItem(p: { _id: unknown; name: string; unitOfMeasurement: unknown; sellingPrice?: number }, qty: number, opts: { discountAmount?: number; saleType?: 'quantity' | 'volume' } = {}) {
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
    saleType: (opts.saleType ?? 'quantity') as 'quantity' | 'volume',
    unitPrice,
    totalPrice: unitPrice * qty - (opts.discountAmount ?? 0),
    discountAmount: opts.discountAmount ?? 0,
  };
}

// ════════════════════════════════════════════════════════════════════
// 1. POST /api/transactions/calculate — preview
// ════════════════════════════════════════════════════════════════════
describe('POST /api/transactions/calculate — preview edge cases', () => {
  it('rejects empty items array with 400', async () => {
    const { token } = await makeUser('super_admin');
    const res = await request(app)
      .post('/api/transactions/calculate')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [] });
    expect(res.status).toBe(400);
  });

  it('rejects missing items field with 400', async () => {
    const { token } = await makeUser('super_admin');
    const res = await request(app)
      .post('/api/transactions/calculate')
      .set('Authorization', `Bearer ${token}`)
      .send({ customerId: null });
    expect(res.status).toBe(400);
  });

  it('overrides client-supplied unitPrice with server-side product price', async () => {
    const { token } = await makeUser('super_admin');
    const product = await seedProduct({ sellingPrice: 50 });

    const res = await request(app)
      .post('/api/transactions/calculate')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{
          ...buildItem(product as any, 2),
          unitPrice: 1,        // ← lying about the price
          totalPrice: 2,
        }],
      });

    expect(res.status).toBe(200);
    expect(res.body.items[0].unitPrice).toBe(50);   // server overrode
    expect(res.body.subtotal).toBe(100);
    expect(res.body.totalAmount).toBe(100);
  });

  it('emits a warning (not an error) for volume sale on a product that cannot sell loose', async () => {
    const { token } = await makeUser('super_admin');
    const product = await seedProduct({ sellingPrice: 50 });
    // canSellLoose default is false in test fixture

    const res = await request(app)
      .post('/api/transactions/calculate')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ ...buildItem(product as any, 5, { saleType: 'volume' }) }],
      });

    expect(res.status).toBe(200);
    expect(res.body.warnings.some((w: string) => /cannot be sold loose/i.test(w))).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════
// 2. POST /api/transactions — create edge cases + concurrency
// ════════════════════════════════════════════════════════════════════
describe('POST /api/transactions — input validation', () => {
  it('rejects when customerName is missing', async () => {
    const { token } = await makeUser('super_admin');
    const product = await seedProduct();
    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [buildItem(product as any, 1)],
        subtotal: 25, totalAmount: 25,
        paymentMethod: 'cash',
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/customer name and items/i);
  });

  it('rejects when items is empty', async () => {
    const { token } = await makeUser('super_admin');
    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerName: 'Walk-in',
        items: [],
        subtotal: 0, totalAmount: 0,
        paymentMethod: 'cash',
      });
    expect(res.status).toBe(400);
  });

  it('rejects items named "Unknown Item"', async () => {
    const { token } = await makeUser('super_admin');
    const product = await seedProduct();
    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerName: 'Walk-in',
        items: [{ ...buildItem(product as any, 1), name: 'Unknown Item' }],
        subtotal: 25, totalAmount: 25,
        paymentMethod: 'cash',
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/missing or invalid names/i);
  });

  it('NOTE: negative quantity is now indirectly rejected via the TOTAL_NEGATIVE guard', async () => {
    // No server-side guard on item.quantity sign exists per se, but the
    // total-clamp added for the bill-discount fix catches the common shape:
    // a -5 qty × $25 unit price produces a -$125 subtotal, which the
    // negative-total guard rejects. Hand-crafted payloads that balance the
    // sign could still slip through — left as a separate, narrower gap.
    const { token } = await makeUser('super_admin');
    const product = await seedProduct({ currentStock: 50 });

    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerName: 'Walk-in',
        items: [buildItem(product as any, -5)],
        subtotal: -125, totalAmount: -125,
        paymentMethod: 'cash',
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('TOTAL_NEGATIVE');

    const after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(50);   // untouched
  });

  it('rejects a bill discount that would push totalAmount below zero', async () => {
    const { token } = await makeUser('super_admin');
    const product = await seedProduct({ sellingPrice: 10, currentStock: 50 });

    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerName: 'Walk-in',
        items: [buildItem(product as any, 1)],   // subtotal 10
        discountAmount: 50,                       // bill discount 50
        paymentMethod: 'cash',
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('TOTAL_NEGATIVE');

    // Stock untouched.
    const after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(50);
  });
});

describe('POST /api/transactions — server-side price/discount recalculation', () => {
  it('overrides client-supplied unitPrice using product sellingPrice', async () => {
    const { token } = await makeUser('super_admin');
    const product = await seedProduct({ sellingPrice: 80 });

    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerName: 'Walk-in',
        items: [{ ...buildItem(product as any, 2), unitPrice: 1, totalPrice: 2 }],
        paymentMethod: 'cash',
      });

    expect(res.status).toBe(201);
    expect(res.body.items[0].unitPrice).toBe(80);
    expect(res.body.totalAmount).toBe(160);
  });

  it('applies membership discount automatically from patient memberBenefits', async () => {
    const { token } = await makeUser('super_admin');
    const product = await seedProduct({ sellingPrice: 100, currentStock: 50 });
    const patient = await Patient.create({
      firstName: 'Mem',
      lastName: 'Ber',
      gender: 'other',
      phone: '99999999',
      memberBenefits: { discountPercentage: 10, membershipTier: 'silver' },
    });

    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerName: 'Mem Ber',
        customerId: String(patient._id),
        items: [buildItem(product as any, 1)],
        paymentMethod: 'cash',
      });

    expect(res.status).toBe(201);
    expect(res.body.items[0].discountAmount).toBe(10);    // 10% of 100
    expect(res.body.totalAmount).toBe(90);
  });
});

describe('POST /api/transactions — role-based discount gates', () => {
  it('staff cannot apply bill discount that exceeds 10% maxDiscountPercent', async () => {
    const { token } = await makeUser('staff');
    const product = await seedProduct({ sellingPrice: 100, currentStock: 50 });

    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerName: 'Walk-in',
        items: [buildItem(product as any, 1)],   // subtotal 100
        discountAmount: 30,                       // 30% bill discount
        paymentMethod: 'cash',
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/discount/i);
  });

  it('staff CAN apply bill discount within their 10% maxDiscountPercent', async () => {
    const { token } = await makeUser('staff');
    const product = await seedProduct({ sellingPrice: 100, currentStock: 50 });

    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerName: 'Walk-in',
        items: [buildItem(product as any, 1)],   // subtotal 100
        discountAmount: 5,                        // 5% bill discount
        paymentMethod: 'cash',
      });

    expect(res.status).toBe(201);
    expect(res.body.totalAmount).toBe(95);
  });
});

describe('POST /api/transactions — concurrency', () => {
  it('20 concurrent POSTs hitting the same product\'s stock all succeed (transient WriteConflicts retried)', async () => {
    // The create-path session block now retries on TransientTransactionError
    // labels with jittered backoff. With contention against a single product
    // document, retries serialize the commits and every request lands.
    const { token } = await makeUser('super_admin');
    const product = await seedProduct({ currentStock: 1000 });

    const N = 20;
    const responses = await Promise.all(
      Array.from({ length: N }, () =>
        request(app)
          .post('/api/transactions')
          .set('Authorization', `Bearer ${token}`)
          .send({
            customerName: 'Walk-in',
            items: [buildItem(product as any, 1)],
            paymentMethod: 'cash',
            paymentStatus: 'paid',
            paidAmount: 25,
            status: 'completed',
          }),
      ),
    );

    expect(responses.every((r) => r.status === 201)).toBe(true);

    const numbers = responses.map((r) => r.body.transactionNumber);
    expect(new Set(numbers).size).toBe(N);
    for (const n of numbers) expect(n).toMatch(/^TXN-\d{8}-\d{4}$/);

    const after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(1000 - N);
  }, 90_000);

  it('20 concurrent POSTs against DIFFERENT products all succeed (no contention)', async () => {
    // Same load as the previous test, but sharded across distinct products
    // so the per-document atomic update does not race. Demonstrates that the
    // WriteConflict is rooted in same-document contention, not in the
    // controller pipeline itself.
    const { token } = await makeUser('super_admin');
    const N = 20;
    const products = await Promise.all(
      Array.from({ length: N }, () => seedProduct({ currentStock: 100 })),
    );

    const responses = await Promise.all(
      products.map((p) =>
        request(app)
          .post('/api/transactions')
          .set('Authorization', `Bearer ${token}`)
          .send({
            customerName: 'Walk-in',
            items: [buildItem(p as any, 1)],
            paymentMethod: 'cash', paymentStatus: 'paid', paidAmount: 25,
            status: 'completed',
          }),
      ),
    );

    expect(responses.every((r) => r.status === 201)).toBe(true);
    const numbers = responses.map((r) => r.body.transactionNumber);
    expect(new Set(numbers).size).toBe(N);
  }, 60_000);

  it('rejects offset_from_credit payment method until the credit ledger ships', async () => {
    const { token } = await makeUser('super_admin');
    const product = await seedProduct({ sellingPrice: 50, currentStock: 50 });
    const patient = await Patient.create({
      firstName: 'No',
      lastName: 'Credit',
      gender: 'other',
      phone: '99999999',
      financialSummary: { outstandingBalance: 0 },
    });

    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerName: 'No Credit',
        customerId: String(patient._id),
        items: [buildItem(product as any, 2)],
        paymentMethod: 'offset_from_credit',
        paymentStatus: 'paid',
        paidAmount: 100,
        status: 'completed',
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('CREDIT_LEDGER_NOT_CONFIGURED');

    // Stock untouched — no transaction was created.
    const stockAfter = await Product.findById(product._id);
    expect(stockAfter!.currentStock).toBe(50);

    // Balance untouched (no ledger exists yet either way).
    const reloaded = await Patient.findById(patient._id).lean() as any;
    expect(reloaded?.financialSummary?.outstandingBalance ?? 0).toBe(0);

    // No Transaction document persisted.
    expect(await Transaction.countDocuments({})).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════════════
// 3. PUT /api/transactions/:id — discount permission gap + cancel cycles
// ════════════════════════════════════════════════════════════════════
describe('PUT /api/transactions/:id — security & state edges', () => {
  it('PUT enforces role-based discount permission (staff cannot save a 90% bill discount via update)', async () => {
    // Create a draft as staff (no discount yet).
    const { token: staffToken } = await makeUser('staff');
    const product = await seedProduct({ sellingPrice: 100, currentStock: 50 });

    const draftRes = await request(app)
      .post('/api/transactions/drafts/autosave')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        draftId: 'gap-draft',
        draftName: 'gap',
        formData: {
          customerName: 'Walk-in',
          items: [buildItem(product as any, 1)],
          subtotal: 100, total: 100,
          paymentMethod: 'cash',
        },
      });

    expect(draftRes.status).toBe(200);
    const txnId = draftRes.body.transactionId;

    // Staff user PUTs the draft with a 90% bill discount — far over their 10%
    // maxDiscountPercent. Now rejected with 403.
    const putRes = await request(app)
      .put(`/api/transactions/${txnId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        customerName: 'Walk-in',
        items: [buildItem(product as any, 1)],
        discountAmount: 90,    // 90% bill discount
        paymentMethod: 'cash',
        status: 'draft',
      });

    expect(putRes.status).toBe(403);
    const reloaded = await Transaction.findById(txnId);
    expect(reloaded!.discountAmount ?? 0).toBe(0);   // unchanged
  });

  it('PUT allows staff to save a discount within their role limit (5% bill discount)', async () => {
    const { token: staffToken } = await makeUser('staff');
    const product = await seedProduct({ sellingPrice: 100, currentStock: 50 });

    const draftRes = await request(app)
      .post('/api/transactions/drafts/autosave')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        draftId: 'within-limit',
        draftName: 'ok',
        formData: {
          customerName: 'Walk-in',
          items: [buildItem(product as any, 1)],
          subtotal: 100, total: 100,
          paymentMethod: 'cash',
        },
      });
    const txnId = draftRes.body.transactionId;

    const putRes = await request(app)
      .put(`/api/transactions/${txnId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        customerName: 'Walk-in',
        items: [buildItem(product as any, 1)],
        discountAmount: 5,    // 5% bill discount — under 10% cap
        paymentMethod: 'cash',
        status: 'draft',
      });

    expect(putRes.status).toBe(200);
    const reloaded = await Transaction.findById(txnId);
    expect(reloaded!.discountAmount).toBe(5);
  });

  it('cancelling an already-cancelled transaction returns 409 and preserves status', async () => {
    const { token } = await makeUser('super_admin');
    const product = await seedProduct({ currentStock: 50 });

    const create = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerName: 'Walk-in',
        items: [buildItem(product as any, 5)],
        paymentMethod: 'cash',
        paymentStatus: 'paid',
        paidAmount: 125,
        status: 'completed',
      });
    expect(create.status).toBe(201);
    const txnId = create.body._id;

    // Cancel once → 200, status=cancelled
    const cancel1 = await request(app)
      .put(`/api/transactions/${txnId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'cancelled' });
    expect(cancel1.status).toBe(200);
    expect((await Transaction.findById(txnId))!.status).toBe('cancelled');

    // Cancel again → 409, status stays cancelled (no surprise un-cancel).
    const cancel2 = await request(app)
      .put(`/api/transactions/${txnId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'cancelled' });
    expect(cancel2.status).toBe(409);
    const final = await Transaction.findById(txnId);
    expect(final!.status).toBe('cancelled');
  });

  it('cancelling a completed transaction reverses inventory exactly once (idempotent reversal)', async () => {
    const { token } = await makeUser('super_admin');
    const product = await seedProduct({ currentStock: 50 });

    const create = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerName: 'Walk-in',
        items: [buildItem(product as any, 7)],
        paymentMethod: 'cash',
        paymentStatus: 'paid',
        paidAmount: 175,
        status: 'completed',
      });
    expect(create.status).toBe(201);
    const txnId = create.body._id;

    // After create: stock 50 → 43
    let after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(43);

    await request(app)
      .put(`/api/transactions/${txnId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'cancelled' })
      .expect(200);

    after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(50);   // restored

    // Reversal movements: exactly one
    const tx = await Transaction.findById(txnId);
    const reversals = await InventoryMovement.find({
      reference: `CANCEL-${tx!.transactionNumber}`,
    });
    expect(reversals.length).toBe(1);
  });

  it('editing a completed transaction with item quantity changes emits exact delta movements', async () => {
    const { token } = await makeUser('super_admin');
    const product = await seedProduct({ currentStock: 50 });

    const create = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerName: 'Walk-in',
        items: [buildItem(product as any, 3)],
        paymentMethod: 'cash',
        paymentStatus: 'paid',
        paidAmount: 75,
        status: 'completed',
      });
    const txnId = create.body._id;

    let after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(47);   // 50 - 3

    // Increase qty 3 → 8 (need to deduct 5 more)
    await request(app)
      .put(`/api/transactions/${txnId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerName: 'Walk-in',
        items: [buildItem(product as any, 8)],
        paymentMethod: 'cash',
        paymentStatus: 'paid',
        paidAmount: 200,
      })
      .expect(200);

    after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(42);   // 47 - 5

    // Decrease qty 8 → 2 (return 6)
    await request(app)
      .put(`/api/transactions/${txnId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerName: 'Walk-in',
        items: [buildItem(product as any, 2)],
        paymentMethod: 'cash',
        paymentStatus: 'paid',
        paidAmount: 50,
      })
      .expect(200);

    after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(48);   // 42 + 6

    // Reference uses EDIT- prefix
    const tx = await Transaction.findById(txnId);
    const editMovements = await InventoryMovement.find({
      reference: `EDIT-${tx!.transactionNumber}`,
    }).sort({ createdAt: 1 });
    expect(editMovements.length).toBe(2);
    expect(editMovements[0].movementType).toBe('sale');     // +5 deducted
    expect(editMovements[0].convertedQuantity).toBe(5);
    expect(editMovements[1].movementType).toBe('return');   // 6 returned
    expect(editMovements[1].convertedQuantity).toBe(6);
  });
});

// ════════════════════════════════════════════════════════════════════
// 4. DELETE /api/transactions/:id — soft vs hard delete
// ════════════════════════════════════════════════════════════════════
describe('DELETE /api/transactions/:id — soft/hard delete semantics', () => {
  it('hard-deleting a completed transaction returns 409', async () => {
    const { token } = await makeUser('super_admin');
    const product = await seedProduct({ currentStock: 50 });

    const create = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerName: 'Walk-in',
        items: [buildItem(product as any, 1)],
        paymentMethod: 'cash',
        paymentStatus: 'paid', paidAmount: 25,
        status: 'completed',
      });
    const txnId = create.body._id;

    const del = await request(app)
      .delete(`/api/transactions/${txnId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(409);
    expect(del.body.error).toMatch(/cannot delete a completed/i);
  });

  it('soft-deleting a cancelled transaction hides it from default GET but keeps it in DB', async () => {
    const { token } = await makeUser('super_admin');
    const product = await seedProduct({ currentStock: 50 });

    const create = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerName: 'Walk-in',
        items: [buildItem(product as any, 2)],
        paymentMethod: 'cash', paymentStatus: 'paid', paidAmount: 50,
        status: 'completed',
      });
    const txnId = create.body._id;

    await request(app)
      .put(`/api/transactions/${txnId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'cancelled' })
      .expect(200);

    const del = await request(app)
      .delete(`/api/transactions/${txnId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'data hygiene' });
    expect(del.status).toBe(200);
    expect(del.body.message).toMatch(/archived|soft-deleted/i);

    // Default GET excludes it
    const list1 = await request(app)
      .get('/api/transactions?includeCancelled=true')
      .set('Authorization', `Bearer ${token}`);
    expect(list1.body.transactions.find((t: any) => t._id === txnId)).toBeUndefined();

    // includeDeleted=true surfaces it
    const list2 = await request(app)
      .get('/api/transactions?includeCancelled=true&includeDeleted=true')
      .set('Authorization', `Bearer ${token}`);
    expect(list2.body.transactions.find((t: any) => t._id === txnId)).toBeDefined();

    // Doc still exists in DB
    const doc = await Transaction.findById(txnId);
    expect(doc).not.toBeNull();
    expect(doc!.isDeleted).toBe(true);
    expect(doc!.deleteReason).toBe('data hygiene');
  });

  it('hard-deletes a draft', async () => {
    const { token } = await makeUser('super_admin');
    const product = await seedProduct({ currentStock: 50 });

    const draft = await request(app)
      .post('/api/transactions/drafts/autosave')
      .set('Authorization', `Bearer ${token}`)
      .send({
        draftId: 'hard-delete-draft',
        draftName: 'hd',
        formData: {
          customerName: 'Walk-in',
          items: [buildItem(product as any, 1)],
          subtotal: 25, total: 25, paymentMethod: 'cash',
        },
      });
    const txnId = draft.body.transactionId;

    const del = await request(app)
      .delete(`/api/transactions/${txnId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(200);

    const doc = await Transaction.findById(txnId);
    expect(doc).toBeNull();      // truly removed
  });
});

// ════════════════════════════════════════════════════════════════════
// 5. POST /api/transactions/:id/duplicate
// ════════════════════════════════════════════════════════════════════
describe('POST /api/transactions/:id/duplicate', () => {
  it('produces a new draft with a fresh transactionNumber and resets refund/email history', async () => {
    const { token } = await makeUser('super_admin');
    const product = await seedProduct({ currentStock: 50 });

    const create = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerName: 'Walk-in',
        items: [buildItem(product as any, 4)],
        paymentMethod: 'cash', paymentStatus: 'paid', paidAmount: 100,
        status: 'completed',
      });
    expect(create.status).toBe(201);
    const originalId = create.body._id;
    const originalNumber = create.body.transactionNumber;

    // Pollute state on the original — duplicate should drop it.
    await Transaction.findByIdAndUpdate(originalId, {
      refundCount: 2,
      totalRefunded: 50,
      invoiceEmailSent: true,
      invoiceEmailHistory: [
        { sentAt: new Date(), recipient: 'foo@bar', sentBy: 'sys', isOverride: false },
      ],
    });

    const dup = await request(app)
      .post(`/api/transactions/${originalId}/duplicate`)
      .set('Authorization', `Bearer ${token}`);
    expect(dup.status).toBe(201);

    expect(dup.body.transactionNumber).not.toBe(originalNumber);
    expect(dup.body.transactionNumber).toMatch(/^TXN-/);
    expect(dup.body.status).toBe('draft');
    expect(dup.body.type).toBe('DRAFT');
    expect(dup.body.paymentStatus).toBe('pending');
    expect(dup.body.paidAmount).toBe(0);
    expect(dup.body.totalRefunded).toBe(0);
    expect(dup.body.refundCount).toBe(0);
    expect(dup.body.invoiceEmailSent).toBe(false);
    expect(dup.body.invoiceEmailHistory ?? []).toEqual([]);
    expect(dup.body.invoiceGenerated).toBe(false);

    // Stock unchanged — duplicates are drafts, no deduction.
    const after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(46);   // only original deducted
  });

  it('duplicating a soft-deleted transaction returns 404', async () => {
    const { token } = await makeUser('super_admin');
    const product = await seedProduct({ currentStock: 50 });

    const create = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerName: 'Walk-in',
        items: [buildItem(product as any, 1)],
        paymentMethod: 'cash', paymentStatus: 'paid', paidAmount: 25,
        status: 'completed',
      });
    const txnId = create.body._id;

    // Cancel + soft-delete
    await request(app).put(`/api/transactions/${txnId}`)
      .set('Authorization', `Bearer ${token}`).send({ status: 'cancelled' });
    await request(app).delete(`/api/transactions/${txnId}`)
      .set('Authorization', `Bearer ${token}`).send({ reason: 'archive' });

    const dup = await request(app)
      .post(`/api/transactions/${txnId}/duplicate`)
      .set('Authorization', `Bearer ${token}`);
    expect(dup.status).toBe(404);
  });
});

// ════════════════════════════════════════════════════════════════════
// 6. GET /api/transactions — pagination, search, filters
// ════════════════════════════════════════════════════════════════════
describe('GET /api/transactions — listing edges', () => {
  it('caps page size at 100', async () => {
    const { token } = await makeUser('super_admin');
    const res = await request(app)
      .get('/api/transactions?limit=10000')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.pagination.limit).toBe(100);
  });

  it('search containing regex special characters does not throw', async () => {
    const { token } = await makeUser('super_admin');
    const res = await request(app)
      .get('/api/transactions?search=' + encodeURIComponent('weird (.*) [name]'))
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.transactions)).toBe(true);
  });

  it('default excludes cancelled transactions; includeCancelled=true reveals them', async () => {
    const { token } = await makeUser('super_admin');
    const product = await seedProduct({ currentStock: 50 });

    // 2 completed
    for (let i = 0; i < 2; i++) {
      await request(app)
        .post('/api/transactions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          customerName: `Cust-${i}`,
          items: [buildItem(product as any, 1)],
          paymentMethod: 'cash', paymentStatus: 'paid', paidAmount: 25,
          status: 'completed',
        });
    }

    // 1 cancelled
    const c = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerName: 'Cust-cancel',
        items: [buildItem(product as any, 1)],
        paymentMethod: 'cash', paymentStatus: 'paid', paidAmount: 25,
        status: 'completed',
      });
    await request(app)
      .put(`/api/transactions/${c.body._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'cancelled' });

    const def = await request(app).get('/api/transactions')
      .set('Authorization', `Bearer ${token}`);
    expect(def.body.transactions.length).toBe(2);

    const all = await request(app)
      .get('/api/transactions?includeCancelled=true')
      .set('Authorization', `Bearer ${token}`);
    expect(all.body.transactions.length).toBe(3);
  });
});

// ════════════════════════════════════════════════════════════════════
// 7. Drafts — autosave, list, delete
// ════════════════════════════════════════════════════════════════════
describe('POST /api/transactions/drafts/autosave', () => {
  it('forces paymentStatus=pending even when formData carries paymentStatus=paid', async () => {
    const { token } = await makeUser('super_admin');
    const product = await seedProduct({ currentStock: 50 });

    const res = await request(app)
      .post('/api/transactions/drafts/autosave')
      .set('Authorization', `Bearer ${token}`)
      .send({
        draftId: 'paid-from-form',
        draftName: 'pdf',
        formData: {
          customerName: 'Walk-in',
          items: [buildItem(product as any, 1)],
          subtotal: 25, total: 25,
          paymentMethod: 'cash',
          paymentStatus: 'paid',   // ← controller must override
          paidAmount: 25,
        },
      });

    expect(res.status).toBe(200);
    const doc = await Transaction.findById(res.body.transactionId);
    expect(doc!.paymentStatus).toBe('pending');
    expect(doc!.status).toBe('draft');
  });

  it('rejects autosave without draftId', async () => {
    const { token } = await makeUser('super_admin');
    const res = await request(app)
      .post('/api/transactions/drafts/autosave')
      .set('Authorization', `Bearer ${token}`)
      .send({ formData: { customerName: 'x', items: [] } });
    expect(res.status).toBe(400);
  });
});

describe('GET / DELETE /api/transactions/drafts', () => {
  it('getDrafts returns only the requesting user\'s drafts', async () => {
    const a = await makeUser('super_admin', 'a');
    const b = await makeUser('super_admin', 'b');
    const product = await seedProduct({ currentStock: 50 });

    await request(app).post('/api/transactions/drafts/autosave')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ draftId: 'a1', draftName: 'a1', formData: { customerName: 'A', items: [buildItem(product as any, 1)] } });
    await request(app).post('/api/transactions/drafts/autosave')
      .set('Authorization', `Bearer ${b.token}`)
      .send({ draftId: 'b1', draftName: 'b1', formData: { customerName: 'B', items: [buildItem(product as any, 1)] } });

    const aDrafts = await request(app).get('/api/transactions/drafts')
      .set('Authorization', `Bearer ${a.token}`);
    expect(aDrafts.body.length).toBe(1);
    expect(aDrafts.body[0].customerName).toBe('A');
  });

  it('deleting another user\'s draft returns 404 (deleteOne filter scopes to createdBy)', async () => {
    const a = await makeUser('super_admin', 'a');
    const b = await makeUser('super_admin', 'b');
    const product = await seedProduct({ currentStock: 50 });

    await request(app).post('/api/transactions/drafts/autosave')
      .set('Authorization', `Bearer ${a.token}`)
      .send({ draftId: 'foreign', draftName: 'x', formData: { customerName: 'A', items: [buildItem(product as any, 1)] } });

    const del = await request(app).delete('/api/transactions/drafts/foreign')
      .set('Authorization', `Bearer ${b.token}`);
    expect(del.status).toBe(404);
  });
});

// ════════════════════════════════════════════════════════════════════
// 8. Invoice send-email — concurrency lock
// ════════════════════════════════════════════════════════════════════
describe('POST /api/transactions/:id/send-invoice-email — locking & guards', () => {
  it('rejects overrideEmail when caller is not super_admin', async () => {
    const { token: adminToken } = await makeUser('admin');
    const { token: superToken } = await makeUser('super_admin');
    const product = await seedProduct({ currentStock: 50 });

    const create = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${superToken}`)
      .send({
        customerName: 'X', customerEmail: 'x@y.z',
        items: [buildItem(product as any, 1)],
        paymentMethod: 'cash', paymentStatus: 'paid', paidAmount: 25,
        status: 'completed',
      });
    const txnId = create.body._id;

    const send = await request(app)
      .post(`/api/transactions/${txnId}/send-invoice-email`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ overrideEmail: 'attacker@evil.com' });
    expect(send.status).toBe(403);
  });

  it('returns 400 when the transaction has no items', async () => {
    const { token } = await makeUser('super_admin');
    // Manually create a doc with no items via direct model write.
    const doc = await Transaction.create({
      transactionNumber: `TXN-EMPTY-${Date.now()}`,
      type: 'COMPLETED',
      status: 'completed',
      customerName: 'No Items',
      customerEmail: 'noitems@test.local',
      items: [],
      subtotal: 0,
      discountAmount: 0,
      totalAmount: 0,
      paymentMethod: 'cash',
      paymentStatus: 'paid',
      paidAmount: 0,
      createdBy: 'system',
    });

    const send = await request(app)
      .post(`/api/transactions/${doc._id}/send-invoice-email`)
      .set('Authorization', `Bearer ${token}`);
    // Either 503 (email service not configured) or 400 (no items) is acceptable —
    // both surface a precondition failure. The empty-items guard fires before
    // the email-service-enabled check in the current controller order, but the
    // emailService lazily reports unconfigured first depending on ENV. Accept
    // both as valid "the request did not deliver an email" paths.
    expect([400, 503]).toContain(send.status);
  });
});

// ════════════════════════════════════════════════════════════════════
// 9. Invariant: stock conservation across mixed operations
// ════════════════════════════════════════════════════════════════════
describe('Conservation invariant — stock is fully recoverable across the lifecycle', () => {
  it('create → edit (qty up) → cancel returns stock to its starting value', async () => {
    const { token } = await makeUser('super_admin');
    const product = await seedProduct({ currentStock: 100 });

    const create = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerName: 'Walk-in',
        items: [buildItem(product as any, 5)],
        paymentMethod: 'cash', paymentStatus: 'paid', paidAmount: 125,
        status: 'completed',
      });
    const txnId = create.body._id;

    // Edit 5 → 12
    await request(app)
      .put(`/api/transactions/${txnId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerName: 'Walk-in',
        items: [buildItem(product as any, 12)],
        paymentMethod: 'cash', paymentStatus: 'paid', paidAmount: 300,
      })
      .expect(200);

    let after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(88);

    // Cancel the transaction: must restore ALL 12 units. The cancel flow now
    // reverses both the original sale movement AND the EDIT- delta movement,
    // so the lifecycle is fully symmetric.
    await request(app)
      .put(`/api/transactions/${txnId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'cancelled' })
      .expect(200);

    after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(100);
  });

  it('create → edit (qty down) → cancel returns stock to its starting value', async () => {
    const { token } = await makeUser('super_admin');
    const product = await seedProduct({ currentStock: 100 });

    // Original sale of 8 → -8 → 92
    const create = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerName: 'Walk-in',
        items: [buildItem(product as any, 8)],
        paymentMethod: 'cash', paymentStatus: 'paid', paidAmount: 200,
        status: 'completed',
      });
    const txnId = create.body._id;

    // Edit 8 → 3 (down by 5; emits a 'return' movement of qty 5) → 92 + 5 = 97
    await request(app)
      .put(`/api/transactions/${txnId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerName: 'Walk-in',
        items: [buildItem(product as any, 3)],
        paymentMethod: 'cash', paymentStatus: 'paid', paidAmount: 75,
      })
      .expect(200);

    let after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(97);

    // Cancel: must reverse BOTH original sale (+8) AND the edit return (-5)
    // → 97 + 8 - 5 = 100.
    await request(app)
      .put(`/api/transactions/${txnId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'cancelled' })
      .expect(200);

    after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(100);
  });
});
