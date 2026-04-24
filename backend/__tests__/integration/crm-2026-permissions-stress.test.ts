/**
 * Permission stress test for the CRM-2026 implementation pass.
 *
 * For every endpoint that was added or modified as part of the fix set, fires
 * real HTTP requests (supertest) against the real routes + auth/permission
 * middleware and asserts the (role → allow/deny) matrix matches the role
 * defaults in PermissionService.getRoleDefaults.
 *
 * Endpoints covered:
 *   #15 POST /api/patients             — DOB missing is accepted per role
 *   #20/#21 POST /api/inventory/categories
 *                                       — defaultUom + defaultCanSellLoose per role
 *   #20    PUT  /api/inventory/categories/:id
 *                                       — updating defaults per role
 *   #23    GET  /api/transactions?customerId=X
 *                                       — patient-scoped listing per role
 *   #26    DELETE /api/transactions/:id — soft-delete per role
 *   #26    GET  /api/transactions?includeDeleted=true
 *                                       — does not leak non-viewable data
 *
 * Also asserts per-user override (`featurePermissions`) wins over role defaults.
 */

// JWT secret must be set before authenticateToken reads it.
process.env.JWT_SECRET = 'test-secret';

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import express, { type Express } from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

import inventoryRoutes from '../../routes/inventory.routes.js';
import transactionsRoutes from '../../routes/transactions.routes.js';
import patientsRoutes from '../../routes/patients.routes.js';
import { errorHandler } from '../../middlewares/errorHandler.middleware.js';
import { clearUserCache } from '../../middlewares/auth.middleware.js';
import { User } from '../../models/User.js';
import { Transaction } from '../../models/Transaction.js';
import { Category } from '../../models/Category.js';
import { Patient } from '../../models/Patient.js';
import { createTestUnit } from '../setup/test-fixtures.js';

import { teardownTestDB } from '../setup/mongodb-memory-server.js';
import {
  setupReplSetDB,
  teardownReplSetDB,
  clearReplSetCollections,
} from '../setup/mongodb-replset-server.js';

beforeAll(async () => {
  await teardownTestDB();
  await setupReplSetDB();
}, 60_000);

afterAll(async () => {
  await teardownReplSetDB();
}, 30_000);

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/inventory', inventoryRoutes);
  app.use('/api/transactions', transactionsRoutes);
  app.use('/api/patients', patientsRoutes);
  app.use(errorHandler);
  return app;
}

const app = buildApp();

type Role = 'super_admin' | 'admin' | 'manager' | 'staff' | 'user';
const ROLES: Role[] = ['super_admin', 'admin', 'manager', 'staff', 'user'];

// Expected allow/deny per role — mirrors PermissionService.getRoleDefaults.
// `user` falls through to the `staff` defaults at the end of that function.
const EXPECTED: Record<Role, {
  canViewTransactions: boolean;
  canDeleteTransactions: boolean;
  canAddCategory: boolean;   // inventory.canAddProducts
  canEditCategory: boolean;  // inventory.canEditProducts
  canCreatePatient: boolean; // patients.canCreatePatients
}> = {
  super_admin: { canViewTransactions: true,  canDeleteTransactions: true,  canAddCategory: true,  canEditCategory: true,  canCreatePatient: true },
  admin:       { canViewTransactions: true,  canDeleteTransactions: false, canAddCategory: true,  canEditCategory: true,  canCreatePatient: true },
  manager:     { canViewTransactions: true,  canDeleteTransactions: false, canAddCategory: true,  canEditCategory: true,  canCreatePatient: true },
  staff:       { canViewTransactions: true,  canDeleteTransactions: false, canAddCategory: false, canEditCategory: false, canCreatePatient: true },
  user:        { canViewTransactions: true,  canDeleteTransactions: false, canAddCategory: false, canEditCategory: false, canCreatePatient: true },
};

let userCounter = 0;

async function createUserWithRole(
  role: Role,
  overrides: Record<string, Record<string, boolean>> = {},
): Promise<{ userId: string; token: string }> {
  userCounter += 1;
  const user = await User.create({
    email: `crm2026-${role}-${userCounter}@test.local`,
    username: `crm2026-${role}-${userCounter}`,
    name: `CRM2026 ${role} ${userCounter}`,
    password: 'not-used-for-tests',
    role,
    isActive: true,
    featurePermissions: overrides,
  });
  const token = jwt.sign(
    { userId: String(user._id), role },
    process.env.JWT_SECRET!,
    { expiresIn: '1h' },
  );
  return { userId: String(user._id), token };
}

async function seedCancelledTransaction(
  overrides: Partial<{ customerId: string; customerName: string }> = {},
): Promise<mongoose.Document & { _id: mongoose.Types.ObjectId }> {
  const t = await Transaction.create({
    transactionNumber: `TXN-${Date.now()}-${userCounter}`,
    type: 'COMPLETED',
    status: 'cancelled',
    customerId: overrides.customerId ?? new mongoose.Types.ObjectId().toString(),
    customerName: overrides.customerName ?? 'Cancelled Customer',
    items: [],
    subtotal: 0,
    discountAmount: 0,
    totalAmount: 0,
    currency: 'SGD',
    paymentMethod: 'cash',
    paymentStatus: 'pending',
    paidAmount: 0,
    changeAmount: 0,
    transactionDate: new Date(),
    invoiceGenerated: false,
    invoiceStatus: 'none',
    createdBy: 'seed-system',
  });
  return t as unknown as mongoose.Document & { _id: mongoose.Types.ObjectId };
}

beforeEach(async () => {
  await clearReplSetCollections();
  clearUserCache();
  userCounter = 0;
});

// ──────────────────────────────────────────────────────────────────────
// #15 — Patient create without DOB; role matrix
// ──────────────────────────────────────────────────────────────────────
describe('#15 POST /api/patients without DOB — role matrix', () => {
  describe.each(ROLES)('role=%s', (role) => {
    it(`${role} with no DOB → ${EXPECTED[role].canCreatePatient ? '201' : '403'}`, async () => {
      const { token } = await createUserWithRole(role);
      const res = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${token}`)
        .send({
          firstName: 'NoDob',
          lastName: `Test-${role}`,
          phone: '+6591234567',
          email: `nodob-${role}@test.local`,
          gender: 'other',
          status: 'active',
          hasConsent: false,
          // No dateOfBirth on purpose
        });
      if (EXPECTED[role].canCreatePatient) {
        expect(res.status).toBe(201);
        expect(res.body.firstName).toBe('NoDob');
        expect(res.body.dateOfBirth).toBeFalsy();
      } else {
        expect(res.status).toBe(403);
      }
    });
  });

  it('future DOB still rejected (schema validation kicks in when provided)', async () => {
    const { token } = await createUserWithRole('staff');
    const future = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
    const res = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${token}`)
      .send({
        firstName: 'Future',
        lastName: 'DOB',
        phone: '+6591234568',
        email: 'future@test.local',
        gender: 'male',
        status: 'active',
        hasConsent: false,
        dateOfBirth: future,
      });
    expect(res.status).toBe(400);
  });
});

// ──────────────────────────────────────────────────────────────────────
// #20/#21 — Category create with defaultUom / defaultCanSellLoose
// ──────────────────────────────────────────────────────────────────────
describe('#20/#21 POST /api/inventory/categories with defaultUom/defaultCanSellLoose', () => {
  describe.each(ROLES)('role=%s', (role) => {
    it(`${role} creating with defaultUom + defaultCanSellLoose → ${EXPECTED[role].canAddCategory ? '201' : '403'}`, async () => {
      const unit = await createTestUnit({ name: `uom-${role}-${Date.now()}` });
      const { token } = await createUserWithRole(role);
      const res = await request(app)
        .post('/api/inventory/categories')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: `Tablets-${role}-${Date.now()}`,
          defaultUom: String(unit._id),
          defaultCanSellLoose: true,
          allowedUomTypes: ['count'],
        });
      if (EXPECTED[role].canAddCategory) {
        expect(res.status).toBe(201);
        const cat = await Category.findById(res.body._id);
        expect(String(cat!.defaultUom)).toBe(String(unit._id));
        expect(cat!.defaultCanSellLoose).toBe(true);
      } else {
        expect(res.status).toBe(403);
        const count = await Category.countDocuments({});
        expect(count).toBe(0);
      }
    });
  });
});

describe('#20 PUT /api/inventory/categories/:id changing defaults', () => {
  describe.each(ROLES)('role=%s', (role) => {
    it(`${role} updating defaultCanSellLoose → ${EXPECTED[role].canEditCategory ? '200' : '403'}`, async () => {
      const unit = await createTestUnit({ name: `uom-put-${role}-${Date.now()}` });
      const cat = await Category.create({
        name: `Cat-${role}-${Date.now()}`,
        level: 1,
        isActive: true,
        defaultCanSellLoose: false,
      });
      const { token } = await createUserWithRole(role);
      const res = await request(app)
        .put(`/api/inventory/categories/${cat._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ defaultUom: String(unit._id), defaultCanSellLoose: true });

      if (EXPECTED[role].canEditCategory) {
        expect(res.status).toBe(200);
        const after = await Category.findById(cat._id);
        expect(after!.defaultCanSellLoose).toBe(true);
        expect(String(after!.defaultUom)).toBe(String(unit._id));
      } else {
        expect(res.status).toBe(403);
        const after = await Category.findById(cat._id);
        expect(after!.defaultCanSellLoose).toBe(false); // unchanged
      }
    });
  });
});

// ──────────────────────────────────────────────────────────────────────
// #23 — GET /api/transactions?customerId=X
// ──────────────────────────────────────────────────────────────────────
describe('#23 GET /api/transactions?customerId filter — role matrix', () => {
  describe.each(ROLES)('role=%s', (role) => {
    it(`${role} listing by customerId → ${EXPECTED[role].canViewTransactions ? '200 with filter applied' : '403'}`, async () => {
      const customerA = new mongoose.Types.ObjectId().toString();
      const customerB = new mongoose.Types.ObjectId().toString();
      await seedCancelledTransaction({ customerId: customerA, customerName: 'A' });
      await seedCancelledTransaction({ customerId: customerA, customerName: 'A' });
      await seedCancelledTransaction({ customerId: customerB, customerName: 'B' });

      const { token } = await createUserWithRole(role);
      const res = await request(app)
        .get(`/api/transactions?customerId=${customerA}&includeCancelled=true`)
        .set('Authorization', `Bearer ${token}`);

      if (EXPECTED[role].canViewTransactions) {
        expect(res.status).toBe(200);
        // Should only see customer A's two cancelled transactions
        expect(res.body.transactions).toHaveLength(2);
        expect(res.body.transactions.every((t: { customerId: string }) => t.customerId === customerA)).toBe(true);
      } else {
        expect(res.status).toBe(403);
      }
    });
  });
});

// ──────────────────────────────────────────────────────────────────────
// #26 — DELETE /api/transactions/:id soft-delete
// ──────────────────────────────────────────────────────────────────────
describe('#26 DELETE /api/transactions/:id — role matrix + soft-delete behaviour', () => {
  describe.each(ROLES)('role=%s', (role) => {
    it(`${role} archiving a cancelled transaction → ${EXPECTED[role].canDeleteTransactions ? '200 soft-delete' : '403'}`, async () => {
      const t = await seedCancelledTransaction();
      const { token } = await createUserWithRole(role);

      const res = await request(app)
        .delete(`/api/transactions/${t._id}`)
        .set('Authorization', `Bearer ${token}`);

      const after = await Transaction.findById(t._id);

      if (EXPECTED[role].canDeleteTransactions) {
        expect(res.status).toBe(200);
        expect(res.body.message).toMatch(/archived|soft-delete/i);
        expect(after).not.toBeNull();              // record preserved
        expect(after!.isDeleted).toBe(true);
        expect(after!.deletedAt).toBeInstanceOf(Date);
      } else {
        expect(res.status).toBe(403);
        expect(after).not.toBeNull();              // untouched
        expect(after!.isDeleted).toBeFalsy();
      }
    });
  });

  it('super_admin: completed transaction cannot be soft-deleted (must cancel first)', async () => {
    const t = await Transaction.create({
      transactionNumber: `TXN-COMPLETED-${Date.now()}`,
      type: 'COMPLETED',
      status: 'completed',
      customerName: 'Paying Customer',
      items: [],
      subtotal: 0,
      discountAmount: 0,
      totalAmount: 0,
      currency: 'SGD',
      paymentMethod: 'cash',
      paymentStatus: 'paid',
      paidAmount: 0,
      changeAmount: 0,
      transactionDate: new Date(),
      invoiceGenerated: false,
      invoiceStatus: 'none',
      createdBy: 'seed-system',
    });
    const { token } = await createUserWithRole('super_admin');
    const res = await request(app)
      .delete(`/api/transactions/${t._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);
    const after = await Transaction.findById(t._id);
    expect(after).not.toBeNull();
    expect(after!.isDeleted).toBeFalsy();
  });

  it('super_admin: draft transaction is hard-deleted (ephemeral — no audit value)', async () => {
    const t = await Transaction.create({
      transactionNumber: `TXN-DRAFT-${Date.now()}`,
      type: 'DRAFT',
      status: 'draft',
      customerName: 'Draft Customer',
      items: [],
      subtotal: 0,
      discountAmount: 0,
      totalAmount: 0,
      currency: 'SGD',
      paymentMethod: 'cash',
      paymentStatus: 'pending',
      paidAmount: 0,
      changeAmount: 0,
      transactionDate: new Date(),
      invoiceGenerated: false,
      invoiceStatus: 'none',
      createdBy: 'seed-system',
    });
    const { token } = await createUserWithRole('super_admin');
    const res = await request(app)
      .delete(`/api/transactions/${t._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/draft/i);
    const after = await Transaction.findById(t._id);
    expect(after).toBeNull(); // genuinely removed
  });
});

// ──────────────────────────────────────────────────────────────────────
// #26 — default listing excludes soft-deleted, ?includeDeleted=true shows them
// ──────────────────────────────────────────────────────────────────────
describe('#26 GET /api/transactions default filter excludes soft-deleted', () => {
  async function archive(txn: { _id: mongoose.Types.ObjectId }) {
    await Transaction.findByIdAndUpdate(txn._id, {
      $set: { isDeleted: true, deletedAt: new Date(), deletedBy: 'test' },
    });
  }

  it('super_admin default listing omits archived rows', async () => {
    const live = await seedCancelledTransaction({ customerName: 'Live' });
    const archived = await seedCancelledTransaction({ customerName: 'Archived' });
    await archive(archived);

    const { token } = await createUserWithRole('super_admin');
    const res = await request(app)
      .get('/api/transactions?includeCancelled=true')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const ids = res.body.transactions.map((t: { _id: string }) => t._id);
    expect(ids).toContain(String(live._id));
    expect(ids).not.toContain(String(archived._id));
  });

  it('super_admin ?includeDeleted=true brings archived rows back', async () => {
    const archived = await seedCancelledTransaction({ customerName: 'Archived' });
    await archive(archived);

    const { token } = await createUserWithRole('super_admin');
    const res = await request(app)
      .get('/api/transactions?includeCancelled=true&includeDeleted=true')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const ids = res.body.transactions.map((t: { _id: string }) => t._id);
    expect(ids).toContain(String(archived._id));
  });

  it('staff with ?includeDeleted=true sees archived rows too (same view-level gate)', async () => {
    // Documenting current behaviour: ?includeDeleted is gated by the same
    // permission as the list endpoint (canViewTransactions). If the client
    // later wants this restricted to admins, add a separate permission.
    const archived = await seedCancelledTransaction({ customerName: 'Archived' });
    await archive(archived);

    const { token } = await createUserWithRole('staff');
    const res = await request(app)
      .get('/api/transactions?includeCancelled=true&includeDeleted=true')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const ids = res.body.transactions.map((t: { _id: string }) => t._id);
    expect(ids).toContain(String(archived._id));
  });
});

// ──────────────────────────────────────────────────────────────────────
// Per-user overrides — featurePermissions trump role defaults
// ──────────────────────────────────────────────────────────────────────
describe('Per-user permission overrides', () => {
  it('staff with transactions.canDeleteTransactions=true override CAN soft-delete', async () => {
    const t = await seedCancelledTransaction();
    const { token } = await createUserWithRole('staff', {
      transactions: { canDeleteTransactions: true },
    });
    const res = await request(app)
      .delete(`/api/transactions/${t._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const after = await Transaction.findById(t._id);
    expect(after!.isDeleted).toBe(true);
  });

  it('super_admin with transactions.canDeleteTransactions=false override STILL CAN (super ignores overrides)', async () => {
    const t = await seedCancelledTransaction();
    const { token } = await createUserWithRole('super_admin', {
      transactions: { canDeleteTransactions: false },
    });
    const res = await request(app)
      .delete(`/api/transactions/${t._id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('admin with inventory.canAddProducts=false override CANNOT create category', async () => {
    const { token } = await createUserWithRole('admin', {
      inventory: { canAddProducts: false },
    });
    const res = await request(app)
      .post('/api/inventory/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Denied-${Date.now()}` });

    expect(res.status).toBe(403);
    expect(await Category.countDocuments({})).toBe(0);
  });

  it('user (lowest role) with patients.canCreatePatients=false override CANNOT create patient', async () => {
    const { token } = await createUserWithRole('user', {
      patients: { canCreatePatients: false },
    });
    const res = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${token}`)
      .send({
        firstName: 'Denied',
        lastName: 'User',
        phone: '+6599998888',
        email: 'denied@test.local',
        gender: 'female',
        status: 'active',
        hasConsent: false,
      });

    expect(res.status).toBe(403);
    expect(await Patient.countDocuments({})).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────────
// Auth failures
// ──────────────────────────────────────────────────────────────────────
describe('Authentication gate on the new endpoints', () => {
  it('DELETE /api/transactions/:id without token → 401', async () => {
    const t = await seedCancelledTransaction();
    const res = await request(app).delete(`/api/transactions/${t._id}`);
    expect(res.status).toBe(401);
  });

  it('GET /api/transactions?customerId=X without token → 401', async () => {
    const res = await request(app).get('/api/transactions?customerId=abc');
    expect(res.status).toBe(401);
  });

  it('POST /api/inventory/categories without token → 401', async () => {
    const res = await request(app).post('/api/inventory/categories').send({ name: 'x' });
    expect(res.status).toBe(401);
  });
});
