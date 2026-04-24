/**
 * Stress test: which roles can mutate stock via the HTTP API?
 *
 * Fires real HTTP requests (supertest) against a minimal Express app that
 * mounts the real inventory routes, auth middleware, and permission
 * middleware. For each (role, endpoint) pair we assert allow/deny matches
 * the PermissionService role defaults, then exercise per-user overrides
 * and a concurrency burst.
 */

// JWT secret must be set before authenticateToken reads it.
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
import { Product } from '../../models/Product.js';
import { createTestProduct, createTestUnit } from '../setup/test-fixtures.js';

import { teardownTestDB } from '../setup/mongodb-memory-server.js';
import {
  setupReplSetDB,
  teardownReplSetDB,
  clearReplSetCollections,
} from '../setup/mongodb-replset-server.js';

// Replica set is required — RestockService + updateProductStock open sessions.
beforeAll(async () => {
  await teardownTestDB();
  await setupReplSetDB();
}, 60_000);

afterAll(async () => {
  await teardownReplSetDB();
}, 30_000);

// Build the minimal app once. Real inventory routes, real auth, real perm middleware.
function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/inventory', inventoryRoutes);
  app.use(errorHandler);
  return app;
}

const app = buildApp();

type Role = 'super_admin' | 'admin' | 'manager' | 'staff' | 'user';

const ROLES: Role[] = ['super_admin', 'admin', 'manager', 'staff', 'user'];

// Expected allow/deny from PermissionService.getRoleDefaults (backend/lib/permissions/PermissionService.ts:433).
// `user` role falls through to the `staff` default block.
const EXPECTED: Record<Role, { canRestock: boolean; canEdit: boolean }> = {
  super_admin: { canRestock: true,  canEdit: true  },
  admin:       { canRestock: true,  canEdit: true  },
  manager:     { canRestock: true,  canEdit: true  },
  staff:       { canRestock: false, canEdit: false },
  user:        { canRestock: false, canEdit: false },
};

let userCounter = 0;

async function createUserWithRole(
  role: Role,
  overrides: Record<string, Record<string, boolean>> = {},
): Promise<{ userId: string; token: string }> {
  userCounter += 1;
  const user = await User.create({
    email: `perm-${role}-${userCounter}@test.local`,
    username: `perm-${role}-${userCounter}`,
    name: `Perm ${role} ${userCounter}`,
    // Middleware uses .lean() and doesn't verify the password, so a non-hashed
    // string is fine — we sign a JWT directly.
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

async function seedProduct(overrides: Parameters<typeof createTestProduct>[0] = {}) {
  const unit = await createTestUnit({ name: `ml-${Date.now()}-${Math.random()}` });
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
  await clearReplSetCollections();
  clearUserCache();
  userCounter = 0;
});

// ────────────────────────────────────────────────────────────────────
// 1. Role matrix — role defaults vs. HTTP response
// ────────────────────────────────────────────────────────────────────
describe('Inventory stock-mutation endpoints — role default matrix', () => {
  describe.each(ROLES)('role=%s', (role) => {
    it('POST /api/inventory/restock enforces canCreateRestockOrders', async () => {
      const product = await seedProduct();
      const { token } = await createUserWithRole(role);

      const res = await request(app)
        .post('/api/inventory/restock')
        .set('Authorization', `Bearer ${token}`)
        .send({ productId: String(product._id), quantity: 10 });

      if (EXPECTED[role].canRestock) {
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        const after = await Product.findById(product._id);
        expect(after!.currentStock).toBe(110);
      } else {
        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/permission denied/i);
        const after = await Product.findById(product._id);
        expect(after!.currentStock).toBe(100); // unchanged
      }
    });

    it('PUT /api/inventory/products/:id enforces canEditProducts', async () => {
      const product = await seedProduct();
      const { token } = await createUserWithRole(role);

      const res = await request(app)
        .put(`/api/inventory/products/${product._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ currentStock: 200 });

      if (EXPECTED[role].canEdit) {
        expect(res.status).toBe(200);
        const after = await Product.findById(product._id);
        expect(after!.currentStock).toBe(200);
      } else {
        expect(res.status).toBe(403);
        const after = await Product.findById(product._id);
        expect(after!.currentStock).toBe(100);
      }
    });

    it('POST /api/inventory/products/:id/pool enforces canEditProducts', async () => {
      const product = await seedProduct({
        currentStock: 1000,
        availableStock: 1000,
        containerCapacity: 1000,
      });
      // Fixture Partial<> doesn't expose canSellLoose — set it directly.
      await Product.updateOne(
        { _id: product._id },
        { $set: { canSellLoose: true, looseStock: 0 } },
      );

      const { token } = await createUserWithRole(role);

      const res = await request(app)
        .post(`/api/inventory/products/${product._id}/pool`)
        .set('Authorization', `Bearer ${token}`)
        .send({ action: 'open', amount: 500 });

      if (EXPECTED[role].canEdit) {
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      } else {
        expect(res.status).toBe(403);
        const after = await Product.findById(product._id);
        expect(after!.looseStock ?? 0).toBe(0);
      }
    });
  });
});

// ────────────────────────────────────────────────────────────────────
// 2. Per-user overrides — featurePermissions should trump role defaults
// ────────────────────────────────────────────────────────────────────
describe('Per-user permission overrides', () => {
  it('staff with inventory.canCreateRestockOrders=true override CAN restock', async () => {
    const product = await seedProduct();
    const { token } = await createUserWithRole('staff', {
      inventory: { canCreateRestockOrders: true },
    });

    const res = await request(app)
      .post('/api/inventory/restock')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: String(product._id), quantity: 25 });

    expect(res.status).toBe(200);
    const after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(125);
  });

  it('admin with inventory.canEditProducts=false override CANNOT edit product', async () => {
    const product = await seedProduct();
    const { token } = await createUserWithRole('admin', {
      inventory: { canEditProducts: false },
    });

    const res = await request(app)
      .put(`/api/inventory/products/${product._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ currentStock: 999 });

    expect(res.status).toBe(403);
    const after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(100);
  });

  it('super_admin ignores overrides (always allowed even with explicit false)', async () => {
    const product = await seedProduct();
    // Even if someone writes a false override to a super_admin, hasPermission
    // short-circuits on role === 'super_admin' before reading overrides.
    const { token } = await createUserWithRole('super_admin', {
      inventory: { canCreateRestockOrders: false, canEditProducts: false },
    });

    const res = await request(app)
      .post('/api/inventory/restock')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: String(product._id), quantity: 5 });

    expect(res.status).toBe(200);
    const after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(105);
  });
});

// ────────────────────────────────────────────────────────────────────
// 3. Auth failures — no token, bad token, unknown user
// ────────────────────────────────────────────────────────────────────
describe('Authentication failures on stock endpoints', () => {
  it('missing Authorization header → 401', async () => {
    const product = await seedProduct();
    const res = await request(app)
      .post('/api/inventory/restock')
      .send({ productId: String(product._id), quantity: 1 });
    expect(res.status).toBe(401);
  });

  it('malformed JWT → 401', async () => {
    const product = await seedProduct();
    const res = await request(app)
      .post('/api/inventory/restock')
      .set('Authorization', 'Bearer not-a-real-jwt')
      .send({ productId: String(product._id), quantity: 1 });
    expect(res.status).toBe(401);
  });

  it('JWT signed with wrong secret → 401', async () => {
    const product = await seedProduct();
    const badToken = jwt.sign(
      { userId: new mongoose.Types.ObjectId().toString(), role: 'super_admin' },
      'some-other-secret',
      { expiresIn: '1h' },
    );
    const res = await request(app)
      .post('/api/inventory/restock')
      .set('Authorization', `Bearer ${badToken}`)
      .send({ productId: String(product._id), quantity: 1 });
    expect(res.status).toBe(401);
  });

  it('JWT for a deleted user → 401', async () => {
    const product = await seedProduct();
    const ghostId = new mongoose.Types.ObjectId().toString();
    const token = jwt.sign(
      { userId: ghostId, role: 'super_admin' },
      process.env.JWT_SECRET!,
      { expiresIn: '1h' },
    );
    const res = await request(app)
      .post('/api/inventory/restock')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: String(product._id), quantity: 1 });
    expect(res.status).toBe(401);
  });
});

// ────────────────────────────────────────────────────────────────────
// 4. Concurrency burst — mixed roles slamming the restock endpoint
// ────────────────────────────────────────────────────────────────────
describe('Concurrency: mixed-role restock burst', () => {
  it('only authorized roles increment stock; denied roles get 403 and do not move stock', async () => {
    const product = await seedProduct({ currentStock: 0, availableStock: 0 });

    // 5 users per role, each fires one restock of +10.
    const USERS_PER_ROLE = 5;
    const RESTOCK_AMOUNT = 10;

    const tokens: { role: Role; token: string }[] = [];
    for (const role of ROLES) {
      for (let i = 0; i < USERS_PER_ROLE; i++) {
        const { token } = await createUserWithRole(role);
        tokens.push({ role, token });
      }
    }

    const responses = await Promise.all(
      tokens.map(({ token }) =>
        request(app)
          .post('/api/inventory/restock')
          .set('Authorization', `Bearer ${token}`)
          .send({ productId: String(product._id), quantity: RESTOCK_AMOUNT }),
      ),
    );

    const successCount = responses.filter((r) => r.status === 200).length;
    const deniedCount = responses.filter((r) => r.status === 403).length;

    const expectedAllowed = ROLES.filter((r) => EXPECTED[r].canRestock).length * USERS_PER_ROLE;
    const expectedDenied = ROLES.filter((r) => !EXPECTED[r].canRestock).length * USERS_PER_ROLE;

    expect(successCount).toBe(expectedAllowed);
    expect(deniedCount).toBe(expectedDenied);

    // Every allowed request atomically added RESTOCK_AMOUNT; denied requests added nothing.
    const after = await Product.findById(product._id);
    expect(after!.currentStock).toBe(expectedAllowed * RESTOCK_AMOUNT);
  }, 30_000);

  it('denied roles firing the pool endpoint in parallel cannot move looseStock', async () => {
    const product = await seedProduct({
      currentStock: 1000,
      availableStock: 1000,
      containerCapacity: 1000,
    });
    await Product.updateOne(
      { _id: product._id },
      { $set: { canSellLoose: true, looseStock: 0 } },
    );

    const deniedRoles: Role[] = ['staff', 'user'];
    const tokens: string[] = [];
    for (const role of deniedRoles) {
      for (let i = 0; i < 5; i++) {
        const { token } = await createUserWithRole(role);
        tokens.push(token);
      }
    }

    const responses = await Promise.all(
      tokens.map((t) =>
        request(app)
          .post(`/api/inventory/products/${product._id}/pool`)
          .set('Authorization', `Bearer ${t}`)
          .send({ action: 'open', amount: 100 }),
      ),
    );

    expect(responses.every((r) => r.status === 403)).toBe(true);

    const after = await Product.findById(product._id);
    expect(after!.looseStock ?? 0).toBe(0);
    expect(after!.currentStock).toBe(1000);
  }, 30_000);
});
