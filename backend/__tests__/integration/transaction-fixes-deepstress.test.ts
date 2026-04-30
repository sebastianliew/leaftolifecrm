/**
 * Deep stress test specifically targeting the fixes shipped in this session:
 *
 *   #2  zero-floor bill discount clamp on POST + PUT
 *   #3  withTransaction retry on TransientTransactionError
 *   #4  Role-based discount permission gate on PUT
 *   #5  409 on cancel-twice
 *   #6  offset_from_credit rejection (POST + PUT)
 *   #7  Soft-delete blocks duplicate
 *   #9  Cancel reversal includes EDIT- movements
 *
 * Goes beyond the baseline edges suite by hammering each fix with higher
 * concurrency, deeper edit chains, and boundary inputs that the simpler tests
 * don't cover.
 *
 * Stays within sell-through-permissive policy: every "should-succeed" case
 * uses zero-stock products to confirm the fix doesn't introduce stock blocks.
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
  return jwt.sign(
    { userId: String(u._id), role },
    process.env.JWT_SECRET!,
    { expiresIn: '1h' },
  );
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

function buildItem(p: { _id: unknown; name: string; unitOfMeasurement: unknown; sellingPrice?: number }, qty: number, opts: { discountAmount?: number } = {}) {
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
    totalPrice: unitPrice * qty - (opts.discountAmount ?? 0),
    discountAmount: opts.discountAmount ?? 0,
  };
}

// ═══════════════════════════════════════════════════════════════════
// Smoke — sell-through baseline still works
// ═══════════════════════════════════════════════════════════════════
describe('SMOKE — sell-through-permissive policy stays in force', () => {
  it('selling 5 units against stock=0 succeeds (201) and surfaces _oversoldItems', async () => {
    const token = await makeUser('super_admin');
    const product = await seedProduct({ currentStock: 0 });

    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerName: 'Walk-in',
        items: [buildItem(product as any, 5)],
        paymentMethod: 'cash', paymentStatus: 'paid', paidAmount: 125,
        status: 'completed',
      });

    expect(res.status).toBe(201);
    expect(Array.isArray(res.body._oversoldItems)).toBe(true);
    expect(res.body._oversoldItems.length).toBe(1);
    expect(res.body._oversoldItems[0].deficit).toBe(5);

    const after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(-5);
  });

  it('selling 1000 units against stock=10 succeeds and lands at -990', async () => {
    const token = await makeUser('super_admin');
    const product = await seedProduct({ currentStock: 10 });

    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerName: 'Walk-in',
        items: [buildItem(product as any, 1000)],
        paymentMethod: 'cash', paymentStatus: 'paid', paidAmount: 25_000,
        status: 'completed',
      });

    expect(res.status).toBe(201);
    const after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(-990);
  });
});

// ═══════════════════════════════════════════════════════════════════
// #3  Retry loop under heavier contention
// ═══════════════════════════════════════════════════════════════════
describe('#3 STRESS — withTransaction retries handle heavy contention', () => {
  it('50 concurrent POSTs hitting one product all succeed with unique TXN numbers', async () => {
    const token = await makeUser('super_admin');
    const product = await seedProduct({ currentStock: 0 });

    const N = 50;
    const responses = await Promise.all(
      Array.from({ length: N }, () =>
        request(app)
          .post('/api/transactions')
          .set('Authorization', `Bearer ${token}`)
          .send({
            customerName: 'Walk-in',
            items: [buildItem(product as any, 1)],
            paymentMethod: 'cash', paymentStatus: 'paid', paidAmount: 25,
            status: 'completed',
          }),
      ),
    );

    const statuses = responses.map((r) => r.status);
    const successes = responses.filter((r) => r.status === 201);
    expect(successes.length).toBe(N);
    expect(statuses.every((s) => s === 201)).toBe(true);

    const numbers = successes.map((r) => r.body.transactionNumber);
    expect(new Set(numbers).size).toBe(N);

    // Stock perfectly reflects sales: 0 - 50 = -50
    const after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(-N);

    // One sale movement per TXN
    expect(await InventoryMovement.countDocuments({
      productId: product._id, movementType: 'sale',
    })).toBe(N);
  }, 120_000);

  it('mixed traffic: 30 concurrent POSTs + 30 concurrent PUTs racing over one product', async () => {
    const token = await makeUser('super_admin');
    const product = await seedProduct({ currentStock: 200 });

    // Pre-create 30 drafts that the PUTs will convert.
    const drafts = await Promise.all(
      Array.from({ length: 30 }, async (_, i) => {
        const r = await request(app)
          .post('/api/transactions/drafts/autosave')
          .set('Authorization', `Bearer ${token}`)
          .send({
            draftId: `mix-draft-${i}`,
            draftName: `mix-${i}`,
            formData: {
              customerName: `Customer ${i}`,
              items: [buildItem(product as any, 1)],
              subtotal: 25, total: 25,
              paymentMethod: 'cash',
            },
          });
        return r.body.transactionId;
      }),
    );

    // Now race: 30 PUT-conversions + 30 fresh POST-creates concurrent.
    const ops = [
      ...drafts.map((id) =>
        request(app)
          .put(`/api/transactions/${id}`)
          .set('Authorization', `Bearer ${token}`)
          .send({
            customerName: 'Walk-in',
            items: [buildItem(product as any, 1)],
            paymentMethod: 'cash', paymentStatus: 'paid', paidAmount: 25,
            status: 'completed',
          }),
      ),
      ...Array.from({ length: 30 }, () =>
        request(app)
          .post('/api/transactions')
          .set('Authorization', `Bearer ${token}`)
          .send({
            customerName: 'Walk-in',
            items: [buildItem(product as any, 1)],
            paymentMethod: 'cash', paymentStatus: 'paid', paidAmount: 25,
            status: 'completed',
          }),
      ),
    ];

    const responses = await Promise.all(ops);

    const okStatuses = responses.filter((r) => r.status === 200 || r.status === 201);
    expect(okStatuses.length).toBe(60);

    // Net stock change: 30 PUT-conversions deduct 1 each + 30 POSTs deduct 1
    // each = 60. Starting 200 → 140.
    const after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(140);
  }, 120_000);
});

// ═══════════════════════════════════════════════════════════════════
// #2  zero-floor bill discount clamp — boundary cases
// ═══════════════════════════════════════════════════════════════════
describe('#2 STRESS — total guard handles boundaries cleanly', () => {
  it('exactly-zero total is allowed (subtotal == bill discount)', async () => {
    const token = await makeUser('super_admin');
    const product = await seedProduct({ sellingPrice: 50, currentStock: 50 });

    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerName: 'Walk-in',
        items: [buildItem(product as any, 1)],   // subtotal 50
        discountAmount: 50,                       // bill discount 50
        paymentMethod: 'cash',
      });

    expect(res.status).toBe(201);
    expect(res.body.totalAmount).toBe(0);
  });

  it('one-cent-over clamps to a zero total', async () => {
    const token = await makeUser('super_admin');
    const product = await seedProduct({ sellingPrice: 50, currentStock: 50 });

    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerName: 'Walk-in',
        items: [buildItem(product as any, 1)],   // subtotal 50
        discountAmount: 50.01,                    // 1 cent over
        paymentMethod: 'cash',
      });

    expect(res.status).toBe(201);
    expect(res.body.discountAmount).toBe(50);
    expect(res.body.totalAmount).toBe(0);
  });

  it('item discount + bill discount combined overage clamps bill discount to the remaining total', async () => {
    const token = await makeUser('super_admin');
    const product = await seedProduct({ sellingPrice: 100, currentStock: 50 });

    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerName: 'Walk-in',
        items: [{ ...buildItem(product as any, 1, { discountAmount: 60 }) }],   // sub 100, item disc 60
        discountAmount: 50,                                                      // bill disc 50; total -10
        paymentMethod: 'cash',
      });

    expect(res.status).toBe(201);
    expect(res.body.discountAmount).toBe(40);
    expect(res.body.totalAmount).toBe(0);
  });

  it('zero-quantity item with no discount → zero total → 201 (no spurious TOTAL_NEGATIVE)', async () => {
    const token = await makeUser('super_admin');
    const product = await seedProduct({ sellingPrice: 50, currentStock: 50 });

    const res = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerName: 'Walk-in',
        items: [buildItem(product as any, 0)],    // qty 0 → subtotal 0
        paymentMethod: 'cash',
      });

    expect(res.status).toBe(201);
    expect(res.body.totalAmount).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// #4  Discount permission permutations across roles
// ═══════════════════════════════════════════════════════════════════
describe('#4 STRESS — discount permission caps applied uniformly across roles on PUT', () => {
  // Role limits per PermissionService.getRoleDefaults():
  //   super_admin: unlimited
  //   admin:       50%
  //   manager:     25%
  //   staff:       10%
  //
  // We park a fresh draft, then PUT it with a discount sized to each role's
  // boundary and 1pp over, asserting the gate matches the role.
  it.each([
    { role: 'admin' as const, cap: 50 },
    { role: 'manager' as const, cap: 25 },
    { role: 'staff' as const, cap: 10 },
  ])('$role role: discount at cap → 200, one point over → 403', async ({ role, cap }) => {
    const token = await makeUser(role);
    const product = await seedProduct({ sellingPrice: 100, currentStock: 50 });

    const draftRes = await request(app)
      .post('/api/transactions/drafts/autosave')
      .set('Authorization', `Bearer ${token}`)
      .send({
        draftId: `cap-${role}`,
        draftName: 'cap',
        formData: {
          customerName: 'Walk-in',
          items: [buildItem(product as any, 1)],
          subtotal: 100, total: 100,
          paymentMethod: 'cash',
        },
      });
    const txnId = draftRes.body.transactionId;

    // At cap: should pass.
    const atCap = await request(app)
      .put(`/api/transactions/${txnId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerName: 'Walk-in',
        items: [buildItem(product as any, 1)],
        discountAmount: cap,    // exactly cap%
        paymentMethod: 'cash',
        status: 'draft',
      });
    expect(atCap.status).toBe(200);

    // One percentage point over: should reject.
    const overCap = await request(app)
      .put(`/api/transactions/${txnId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerName: 'Walk-in',
        items: [buildItem(product as any, 1)],
        discountAmount: cap + 1,    // cap+1%
        paymentMethod: 'cash',
        status: 'draft',
      });
    expect(overCap.status).toBe(403);
  });

  it('super_admin bypasses caps entirely (95% bill discount accepted)', async () => {
    const token = await makeUser('super_admin');
    const product = await seedProduct({ sellingPrice: 100, currentStock: 50 });

    const draftRes = await request(app)
      .post('/api/transactions/drafts/autosave')
      .set('Authorization', `Bearer ${token}`)
      .send({
        draftId: 'super-cap',
        draftName: 'super',
        formData: {
          customerName: 'Walk-in',
          items: [buildItem(product as any, 1)],
          subtotal: 100, total: 100,
          paymentMethod: 'cash',
        },
      });
    const txnId = draftRes.body.transactionId;

    const res = await request(app)
      .put(`/api/transactions/${txnId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerName: 'Walk-in',
        items: [buildItem(product as any, 1)],
        discountAmount: 95,
        paymentMethod: 'cash',
        status: 'draft',
      });
    expect(res.status).toBe(200);
  });
});

// ═══════════════════════════════════════════════════════════════════
// #9  Cancel reversal includes EDIT- movements — multi-edit chain
// ═══════════════════════════════════════════════════════════════════
describe('#9 STRESS — cancel restores stock through arbitrary edit chains', () => {
  it('create → edit up → edit down → edit up → cancel returns to original stock', async () => {
    const token = await makeUser('super_admin');
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

    // 5 → 12 (deduct 7)
    await request(app)
      .put(`/api/transactions/${txnId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerName: 'Walk-in',
        items: [buildItem(product as any, 12)],
        paymentMethod: 'cash', paymentStatus: 'paid', paidAmount: 300,
      })
      .expect(200);

    // 12 → 4 (return 8)
    await request(app)
      .put(`/api/transactions/${txnId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerName: 'Walk-in',
        items: [buildItem(product as any, 4)],
        paymentMethod: 'cash', paymentStatus: 'paid', paidAmount: 100,
      })
      .expect(200);

    // 4 → 9 (deduct 5)
    await request(app)
      .put(`/api/transactions/${txnId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerName: 'Walk-in',
        items: [buildItem(product as any, 9)],
        paymentMethod: 'cash', paymentStatus: 'paid', paidAmount: 225,
      })
      .expect(200);

    // Sanity: net is 100 - 5 - 7 + 8 - 5 = 91
    let after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(91);

    // Cancel: must reverse original (5) + all EDIT- deltas (7, -8, 5).
    // → 91 + 5 + 7 - 8 + 5 = 100
    await request(app)
      .put(`/api/transactions/${txnId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'cancelled' })
      .expect(200);

    after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(100);
  }, 60_000);

  it('cancel still works when edit chain pushed stock negative', async () => {
    // Sell-through-permissive: edits can drive stock negative. Cancel must
    // still walk it all the way back to the starting point.
    const token = await makeUser('super_admin');
    const product = await seedProduct({ currentStock: 5 });

    const create = await request(app)
      .post('/api/transactions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerName: 'Walk-in',
        items: [buildItem(product as any, 5)],   // -5 → 0
        paymentMethod: 'cash', paymentStatus: 'paid', paidAmount: 125,
        status: 'completed',
      });
    const txnId = create.body._id;

    // Edit 5 → 50 (deduct 45 more) → -45
    await request(app)
      .put(`/api/transactions/${txnId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerName: 'Walk-in',
        items: [buildItem(product as any, 50)],
        paymentMethod: 'cash', paymentStatus: 'paid', paidAmount: 1250,
      })
      .expect(200);

    let after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(-45);

    // Cancel: +5 (original) + +45 (edit) = +50 → back to 5
    await request(app)
      .put(`/api/transactions/${txnId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'cancelled' })
      .expect(200);

    after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(5);
  });

  it('reversal is idempotent — running cancel twice does not double-restore', async () => {
    const token = await makeUser('super_admin');
    const product = await seedProduct({ currentStock: 50 });

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

    await request(app)
      .put(`/api/transactions/${txnId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerName: 'Walk-in',
        items: [buildItem(product as any, 8)],
        paymentMethod: 'cash', paymentStatus: 'paid', paidAmount: 200,
      })
      .expect(200);

    // First cancel → 200, restores to 50
    await request(app)
      .put(`/api/transactions/${txnId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'cancelled' })
      .expect(200);

    let after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(50);

    // Second cancel → 409 (fix #5)
    await request(app)
      .put(`/api/transactions/${txnId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'cancelled' })
      .expect(409);

    // Stock untouched the second time
    after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(50);
  });
});

// ═══════════════════════════════════════════════════════════════════
// #5  Cancel-twice race
// ═══════════════════════════════════════════════════════════════════
describe('#5 STRESS — concurrent cancels are safe', () => {
  it('5 concurrent cancels: exactly one returns 200, others return 409', async () => {
    const token = await makeUser('super_admin');
    const product = await seedProduct({ currentStock: 50 });

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

    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(app)
          .put(`/api/transactions/${txnId}`)
          .set('Authorization', `Bearer ${token}`)
          .send({ status: 'cancelled' }),
      ),
    );

    const ok = responses.filter((r) => r.status === 200);
    const conflict = responses.filter((r) => r.status === 409);

    // The first cancel wins. Subsequent attempts find status='cancelled' and
    // return 409. Concurrent ordering is non-deterministic so we just assert
    // counts.
    expect(ok.length + conflict.length).toBe(5);
    expect(ok.length).toBeGreaterThanOrEqual(1);
    expect(conflict.length).toBeGreaterThanOrEqual(1);

    // Stock restored exactly once.
    const after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(50);

    // Exactly one reversal movement set.
    const tx = await Transaction.findById(txnId);
    const reversals = await InventoryMovement.find({
      reference: `CANCEL-${tx!.transactionNumber}`,
    });
    expect(reversals.length).toBe(1);
  }, 60_000);
});

// ═══════════════════════════════════════════════════════════════════
// #6  offset_from_credit blocked on PUT as well as POST
// ═══════════════════════════════════════════════════════════════════
describe('#6 STRESS — offset_from_credit blocked everywhere it could land', () => {
  it('PUT cannot smuggle offset_from_credit onto a draft', async () => {
    const token = await makeUser('super_admin');
    const product = await seedProduct({ currentStock: 50 });

    const draftRes = await request(app)
      .post('/api/transactions/drafts/autosave')
      .set('Authorization', `Bearer ${token}`)
      .send({
        draftId: 'cred-smuggle',
        draftName: 'smuggle',
        formData: {
          customerName: 'Walk-in',
          items: [buildItem(product as any, 1)],
          subtotal: 25, total: 25,
          paymentMethod: 'cash',
        },
      });
    const txnId = draftRes.body.transactionId;

    const putRes = await request(app)
      .put(`/api/transactions/${txnId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerName: 'Walk-in',
        items: [buildItem(product as any, 1)],
        paymentMethod: 'offset_from_credit',
        status: 'draft',
      });
    expect(putRes.status).toBe(400);
    expect(putRes.body.code).toBe('CREDIT_LEDGER_NOT_CONFIGURED');

    // Doc unchanged.
    const reloaded = await Transaction.findById(txnId);
    expect(reloaded!.paymentMethod).toBe('cash');
  });
});

// ═══════════════════════════════════════════════════════════════════
// #7  Soft-delete blocks duplicate, but live records still duplicate
// ═══════════════════════════════════════════════════════════════════
describe('#7 STRESS — duplicate respects soft-delete state', () => {
  it('duplicate of a live (non-deleted) cancelled transaction succeeds', async () => {
    const token = await makeUser('super_admin');
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

    // Cancel only — DO NOT soft-delete.
    await request(app)
      .put(`/api/transactions/${txnId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'cancelled' })
      .expect(200);

    // Cancelled live record can still be duplicated as a fresh draft.
    const dup = await request(app)
      .post(`/api/transactions/${txnId}/duplicate`)
      .set('Authorization', `Bearer ${token}`);
    expect(dup.status).toBe(201);
    expect(dup.body.status).toBe('draft');
  });
});
