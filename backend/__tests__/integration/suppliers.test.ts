import { describe, it, expect, beforeAll, beforeEach } from '@jest/globals';
import express, { Express } from 'express';
import request from 'supertest';
import mongoose from 'mongoose';

import { Supplier } from '../../models/Supplier.js';
import { Product } from '../../models/Product.js';
import {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from '../../controllers/suppliers.controller.js';
import { errorHandler } from '../../middlewares/errorHandler.middleware.js';
import { clearCollections } from '../setup/mongodb-memory-server.js';

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.get('/api/suppliers', getSuppliers);
  app.get('/api/suppliers/:id', getSupplierById);
  app.post('/api/suppliers', createSupplier);
  app.put('/api/suppliers/:id', updateSupplier);
  app.delete('/api/suppliers/:id', deleteSupplier);
  app.use(errorHandler);
  return app;
}

async function createProductForSupplier(
  supplierId: mongoose.Types.ObjectId,
  opts: { isDeleted?: boolean } = {}
) {
  return Product.create({
    name: `P-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    sku: `SKU-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    category: new mongoose.Types.ObjectId(),
    unitOfMeasurement: new mongoose.Types.ObjectId(),
    supplierId,
    quantity: 0,
    currentStock: 0,
    reorderPoint: 10,
    isActive: true,
    isDeleted: opts.isDeleted ?? false,
    status: 'active',
  });
}

describe('Supplier endpoints (CRUD + behaviors)', () => {
  let app: Express;

  beforeAll(async () => {
    app = buildApp();
    await Supplier.init();
  });

  beforeEach(async () => {
    await clearCollections();
  });

  // ── CREATE ──
  describe('POST /api/suppliers', () => {
    it('creates a supplier with minimal payload and auto-generates a code', async () => {
      const res = await request(app).post('/api/suppliers').send({ name: 'Acme Supplies' });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Acme Supplies');
      expect(res.body.id).toBeDefined();
      expect(res.body.code).toMatch(/^ACM\d{4}$/);
      expect(res.body.isActive).toBe(true);
      expect(res.body.status).toBe('active');
      expect(res.body._id).toBeUndefined();
      expect(res.body.__v).toBeUndefined();
    });

    it('falls back to SUP prefix when name has no letters', async () => {
      const res = await request(app).post('/api/suppliers').send({ name: '123 Ltd' });
      expect(res.status).toBe(201);
      expect(res.body.code).toMatch(/^SUP\d{4}$/);
    });

    it('rejects missing name (400)', async () => {
      const res = await request(app).post('/api/suppliers').send({});
      expect(res.status).toBe(400);
    });

    it('rejects duplicate name case-insensitively (409)', async () => {
      await request(app).post('/api/suppliers').send({ name: 'Acme' });
      const res = await request(app).post('/api/suppliers').send({ name: 'ACME' });
      expect(res.status).toBe(409);
    });

    it('rejects duplicate explicit code case-insensitively (409)', async () => {
      await request(app).post('/api/suppliers').send({ name: 'A', code: 'ACM0001' });
      const res = await request(app).post('/api/suppliers').send({ name: 'B', code: 'acm0001' });
      expect(res.status).toBe(409);
    });

    it('strips HTML from name, description, notes', async () => {
      const res = await request(app).post('/api/suppliers').send({
        name: '<script>alert(1)</script>Clean',
        description: '<b>bold</b>',
        notes: '<i>noted</i>',
      });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe('alert(1)Clean');
      expect(res.body.description).toBe('bold');
      expect(res.body.notes).toBe('noted');
    });

    it('cleans tag array (strip HTML, drop non-strings/empties)', async () => {
      const res = await request(app).post('/api/suppliers').send({
        name: 'T',
        tags: ['<b>herbs</b>', '', '   ', 42, 'oils'],
      });
      expect(res.status).toBe(201);
      expect(res.body.tags).toEqual(['herbs', 'oils']);
    });

    it('rejects mass-assignment of server-managed fields (silently drops them)', async () => {
      const res = await request(app).post('/api/suppliers').send({
        name: 'Greedy',
        totalOrders: 9999,
        totalSpent: 1_000_000,
        rating: 5,
        productCount: 500,
        createdBy: 'attacker',
        legacyId: 'hacked',
      });
      expect(res.status).toBe(201);
      expect(res.body.totalOrders).toBe(0);
      expect(res.body.totalSpent).toBe(0);
      expect(res.body.rating).toBe(0);
      expect(res.body.productCount).toBe(0);
      expect(res.body.createdBy).toBe('system');
      expect(res.body.legacyId).toBeUndefined();
    });

    it('applies status coherence: status=suspended forces isActive=false', async () => {
      const res = await request(app).post('/api/suppliers').send({
        name: 'Sus', status: 'suspended', isActive: true,
      });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('suspended');
      expect(res.body.isActive).toBe(false);
    });

    it('applies status coherence: isActive=false only → status=inactive', async () => {
      const res = await request(app).post('/api/suppliers').send({ name: 'X', isActive: false });
      expect(res.status).toBe(201);
      expect(res.body.isActive).toBe(false);
      expect(res.body.status).toBe('inactive');
    });

    it('rejects invalid businessType enum', async () => {
      const res = await request(app).post('/api/suppliers').send({
        name: 'BT', businessType: 'spaceship',
      });
      expect(res.status).toBe(400);
    });

    it('rejects invalid paymentTerms enum', async () => {
      const res = await request(app).post('/api/suppliers').send({
        name: 'PT', paymentTerms: 'when_ready',
      });
      expect(res.status).toBe(400);
    });

    it('rejects negative creditLimit', async () => {
      const res = await request(app).post('/api/suppliers').send({
        name: 'C', creditLimit: -1,
      });
      expect(res.status).toBe(400);
    });

    it('accepts valid email with long TLD (e.g. .museum)', async () => {
      const res = await request(app).post('/api/suppliers').send({
        name: 'E', email: 'contact@british.museum',
      });
      expect(res.status).toBe(201);
      expect(res.body.email).toBe('contact@british.museum');
    });

    it('rejects malformed email', async () => {
      const res = await request(app).post('/api/suppliers').send({
        name: 'E', email: 'not-an-email',
      });
      expect(res.status).toBe(400);
    });
  });

  // ── CODE GENERATION ──
  describe('Auto-generated code sequence', () => {
    it('increments past the highest existing suffix (handles deletions)', async () => {
      // Seed three ACM codes directly, then delete the middle one.
      await Supplier.create({ name: 'First', code: 'ACM0001', createdBy: 'seed' });
      await Supplier.create({ name: 'Second', code: 'ACM0002', createdBy: 'seed' });
      await Supplier.create({ name: 'Third', code: 'ACM0003', createdBy: 'seed' });
      await Supplier.deleteOne({ code: 'ACM0002' });

      const res = await request(app).post('/api/suppliers').send({ name: 'Acme Four' });
      expect(res.status).toBe(201);
      // Regression: old count-based code would have produced ACM0003 (collision).
      expect(res.body.code).toBe('ACM0004');
    });
  });

  // ── LIST ──
  describe('GET /api/suppliers', () => {
    it('returns empty list + pagination', async () => {
      const res = await request(app).get('/api/suppliers');
      expect(res.status).toBe(200);
      expect(res.body.suppliers).toEqual([]);
      expect(res.body.pagination.page).toBe(1);
    });

    it('searches across name, code, description, contactPerson, email', async () => {
      await request(app).post('/api/suppliers').send({ name: 'Alpha', code: 'ALP0001' });
      await request(app).post('/api/suppliers').send({ name: 'Beta', contactPerson: 'Jane Alphaic' });
      await request(app).post('/api/suppliers').send({ name: 'Gamma', email: 'contact@example.com' });

      const res = await request(app).get('/api/suppliers').query({ search: 'alpha' });
      expect(res.body.suppliers.map((s: { name: string }) => s.name).sort()).toEqual(['Alpha', 'Beta']);
    });

    it('filters by status', async () => {
      await request(app).post('/api/suppliers').send({ name: 'Act', status: 'active' });
      await request(app).post('/api/suppliers').send({ name: 'Sus', status: 'suspended' });

      const res = await request(app).get('/api/suppliers').query({ status: 'suspended' });
      expect(res.body.suppliers.map((s: { name: string }) => s.name)).toEqual(['Sus']);
    });

    it('filters by isActive independently of status', async () => {
      await request(app).post('/api/suppliers').send({ name: 'On', status: 'active' });
      await request(app).post('/api/suppliers').send({ name: 'Off', status: 'inactive' });
      await request(app).post('/api/suppliers').send({ name: 'Hold', status: 'suspended' });

      const active = await request(app).get('/api/suppliers').query({ isActive: 'true' });
      expect(active.body.suppliers.map((s: { name: string }) => s.name)).toEqual(['On']);

      const inactive = await request(app).get('/api/suppliers').query({ isActive: 'false' });
      expect(inactive.body.suppliers.map((s: { name: string }) => s.name).sort()).toEqual(['Hold', 'Off']);
    });

    it('paginates', async () => {
      for (let i = 0; i < 5; i++) {
        await request(app).post('/api/suppliers').send({ name: `S${i}` });
      }
      const res = await request(app).get('/api/suppliers').query({ page: '1', limit: '2' });
      expect(res.body.suppliers).toHaveLength(2);
      expect(res.body.pagination.limit).toBe(2);
    });

    it('treats regex chars in search as literal (no injection)', async () => {
      await request(app).post('/api/suppliers').send({ name: 'Plain' });
      const res = await request(app).get('/api/suppliers').query({ search: '.*' });
      expect(res.body.suppliers).toEqual([]);
    });
  });

  // ── READ ──
  describe('GET /api/suppliers/:id', () => {
    it('returns a supplier by id', async () => {
      const { body } = await request(app).post('/api/suppliers').send({ name: 'R' });
      const res = await request(app).get(`/api/suppliers/${body.id}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(body.id);
      expect(res.body.name).toBe('R');
    });

    it('returns 404 for unknown id', async () => {
      const res = await request(app).get(`/api/suppliers/${new mongoose.Types.ObjectId()}`);
      expect(res.status).toBe(404);
    });

    it('returns 400 for malformed id', async () => {
      const res = await request(app).get('/api/suppliers/not-an-id');
      expect(res.status).toBe(400);
    });
  });

  // ── UPDATE ──
  describe('PUT /api/suppliers/:id', () => {
    it('updates allowed fields', async () => {
      const { body } = await request(app).post('/api/suppliers').send({ name: 'Old' });
      const res = await request(app).put(`/api/suppliers/${body.id}`).send({
        name: 'New', description: 'desc', city: 'SG',
      });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('New');
      expect(res.body.description).toBe('desc');
      expect(res.body.city).toBe('SG');
    });

    it('rejects mass-assignment of server-managed fields', async () => {
      const { body } = await request(app).post('/api/suppliers').send({ name: 'MM' });
      const res = await request(app).put(`/api/suppliers/${body.id}`).send({
        totalOrders: 9999,
        createdBy: 'attacker',
        rating: 5,
      });
      expect(res.status).toBe(200);
      expect(res.body.totalOrders).toBe(0);
      expect(res.body.createdBy).toBe('system');
      expect(res.body.rating).toBe(0);
    });

    it('strips HTML from updated fields', async () => {
      const { body } = await request(app).post('/api/suppliers').send({ name: 'X' });
      const res = await request(app).put(`/api/suppliers/${body.id}`).send({
        name: '<b>Y</b>', notes: '<script>n</script>',
      });
      expect(res.body.name).toBe('Y');
      expect(res.body.notes).toBe('n');
    });

    it('allows keeping the same name (self-exclusion)', async () => {
      const { body } = await request(app).post('/api/suppliers').send({ name: 'Same' });
      const res = await request(app).put(`/api/suppliers/${body.id}`).send({ name: 'Same' });
      expect(res.status).toBe(200);
    });

    it('rejects renaming to an existing name (409)', async () => {
      await request(app).post('/api/suppliers').send({ name: 'Taken' });
      const { body: other } = await request(app).post('/api/suppliers').send({ name: 'Other' });
      const res = await request(app).put(`/api/suppliers/${other.id}`).send({ name: 'TAKEN' });
      expect(res.status).toBe(409);
    });

    it('rejects empty name after sanitization', async () => {
      const { body } = await request(app).post('/api/suppliers').send({ name: 'Ok' });
      const res = await request(app).put(`/api/suppliers/${body.id}`).send({ name: '   ' });
      expect(res.status).toBe(400);
    });

    it('clears code when null is sent (via $unset)', async () => {
      const { body } = await request(app).post('/api/suppliers').send({ name: 'C', code: 'CUS0001' });
      const res = await request(app).put(`/api/suppliers/${body.id}`).send({ code: null });
      expect(res.status).toBe(200);
      expect(res.body.code).toBeUndefined();
    });

    it('clears code when empty string is sent (via $unset)', async () => {
      const { body } = await request(app).post('/api/suppliers').send({ name: 'C2', code: 'CUS0002' });
      const res = await request(app).put(`/api/suppliers/${body.id}`).send({ code: '' });
      expect(res.status).toBe(200);
      expect(res.body.code).toBeUndefined();
    });

    it('syncs isActive when status is changed', async () => {
      const { body } = await request(app).post('/api/suppliers').send({ name: 'Sync' });
      const res = await request(app).put(`/api/suppliers/${body.id}`).send({ status: 'blacklisted' });
      expect(res.body.status).toBe('blacklisted');
      expect(res.body.isActive).toBe(false);
    });

    it('syncs status when isActive is toggled', async () => {
      const { body } = await request(app).post('/api/suppliers').send({ name: 'Toggle' });
      const res = await request(app).put(`/api/suppliers/${body.id}`).send({ isActive: false });
      expect(res.body.isActive).toBe(false);
      expect(res.body.status).toBe('inactive');
    });

    it('returns 404 for unknown id (before duplicate checks)', async () => {
      await request(app).post('/api/suppliers').send({ name: 'Existing' });
      const res = await request(app)
        .put(`/api/suppliers/${new mongoose.Types.ObjectId()}`)
        .send({ name: 'Existing' });
      expect(res.status).toBe(404);
    });

    it('returns 400 for malformed id', async () => {
      const res = await request(app).put('/api/suppliers/bad-id').send({ name: 'Whatever' });
      expect(res.status).toBe(400);
    });
  });

  // ── DELETE ──
  describe('DELETE /api/suppliers/:id', () => {
    it('deletes a supplier with no products', async () => {
      const { body } = await request(app).post('/api/suppliers').send({ name: 'Gone' });
      const res = await request(app).delete(`/api/suppliers/${body.id}`);
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/deleted/i);
    });

    it('blocks deletion when active products reference the supplier (regression for wrong-field bug)', async () => {
      const { body } = await request(app).post('/api/suppliers').send({ name: 'Used' });
      await createProductForSupplier(new mongoose.Types.ObjectId(body.id));
      await createProductForSupplier(new mongoose.Types.ObjectId(body.id));

      const res = await request(app).delete(`/api/suppliers/${body.id}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/2 products/);
      expect(await Supplier.findById(body.id)).not.toBeNull();
    });

    it('allows deletion when the only references are soft-deleted products', async () => {
      const { body } = await request(app).post('/api/suppliers').send({ name: 'Soft' });
      await createProductForSupplier(new mongoose.Types.ObjectId(body.id), { isDeleted: true });

      const res = await request(app).delete(`/api/suppliers/${body.id}`);
      expect(res.status).toBe(200);
    });

    it('returns 404 for unknown id', async () => {
      const res = await request(app).delete(`/api/suppliers/${new mongoose.Types.ObjectId()}`);
      expect(res.status).toBe(404);
    });

    it('returns 400 for malformed id', async () => {
      const res = await request(app).delete('/api/suppliers/not-an-id');
      expect(res.status).toBe(400);
    });
  });
});
