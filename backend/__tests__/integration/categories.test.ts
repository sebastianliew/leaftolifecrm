import { describe, it, expect, beforeAll, beforeEach } from '@jest/globals';
import express, { Express } from 'express';
import request from 'supertest';
import mongoose from 'mongoose';

import { Category } from '../../models/Category.js';
import { Product } from '../../models/Product.js';
import { Bundle } from '../../models/Bundle.js';
import { BlendTemplate } from '../../models/BlendTemplate.js';
import {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../../controllers/categories.controller.js';
import { errorHandler } from '../../middlewares/errorHandler.middleware.js';
import { clearCollections } from '../setup/mongodb-memory-server.js';

// ── Test app (routes only, auth bypassed — auth is a separate concern) ──
function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.get('/api/inventory/categories', getCategories);
  app.get('/api/inventory/categories/:id', getCategoryById);
  app.post('/api/inventory/categories', createCategory);
  app.put('/api/inventory/categories/:id', updateCategory);
  app.delete('/api/inventory/categories/:id', deleteCategory);
  app.use(errorHandler);
  return app;
}

async function createProductInCategory(
  categoryId: mongoose.Types.ObjectId,
  opts: { isActive?: boolean; isDeleted?: boolean; sku?: string } = {}
) {
  return Product.create({
    name: `P-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    sku: opts.sku ?? `SKU-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    category: categoryId,
    unitOfMeasurement: new mongoose.Types.ObjectId(),
    quantity: 0,
    currentStock: 0,
    reorderPoint: 10,
    isActive: opts.isActive ?? true,
    isDeleted: opts.isDeleted ?? false,
    status: opts.isActive === false ? 'inactive' : 'active',
  });
}

describe('Category endpoints (CRUD + behaviors)', () => {
  let app: Express;

  beforeAll(async () => {
    app = buildApp();
    // Ensure unique-name index is built before tests rely on it.
    await Category.init();
  });

  beforeEach(async () => {
    await clearCollections();
  });

  // ── CREATE ──
  describe('POST /api/inventory/categories', () => {
    it('creates a category with defaults', async () => {
      const res = await request(app)
        .post('/api/inventory/categories')
        .send({ name: 'Books' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        name: 'Books',
        level: 1,
        isActive: true,
        allowedUomTypes: [],
      });
      expect(res.body._id).toBeDefined();
    });

    it('creates with description, level, isActive, allowedUomTypes', async () => {
      const res = await request(app)
        .post('/api/inventory/categories')
        .send({
          name: 'Herbs',
          description: 'Dried herbs',
          level: 2,
          isActive: false,
          allowedUomTypes: ['weight', 'count'],
        });

      expect(res.status).toBe(201);
      expect(res.body.description).toBe('Dried herbs');
      expect(res.body.level).toBe(2);
      expect(res.body.isActive).toBe(false);
      expect(res.body.allowedUomTypes).toEqual(['weight', 'count']);
    });

    it('rejects missing name', async () => {
      const res = await request(app)
        .post('/api/inventory/categories')
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/required/i);
    });

    it('rejects empty/whitespace name after sanitization', async () => {
      const res = await request(app)
        .post('/api/inventory/categories')
        .send({ name: '   ' });
      expect(res.status).toBe(400);
    });

    it('strips HTML from name and description', async () => {
      const res = await request(app)
        .post('/api/inventory/categories')
        .send({
          name: '<script>alert(1)</script>CleanName',
          description: '<b>Bold</b> desc',
        });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe('alert(1)CleanName');
      expect(res.body.description).toBe('Bold desc');
    });

    it('rejects duplicate name (case-insensitive)', async () => {
      await request(app).post('/api/inventory/categories').send({ name: 'Books' });
      const res = await request(app)
        .post('/api/inventory/categories')
        .send({ name: 'books' });
      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/already exists/i);
    });

    it('rejects invalid allowedUomTypes enum', async () => {
      const res = await request(app)
        .post('/api/inventory/categories')
        .send({ name: 'Bad', allowedUomTypes: ['invalid-type'] });
      expect(res.status).toBe(400);
    });
  });

  // ── LIST ──
  describe('GET /api/inventory/categories', () => {
    it('returns empty list and pagination', async () => {
      const res = await request(app).get('/api/inventory/categories');
      expect(res.status).toBe(200);
      expect(res.body.categories).toEqual([]);
      expect(res.body.pagination).toMatchObject({ page: 1 });
    });

    it('returns categories with productCount (active, non-deleted products only)', async () => {
      const cat = await Category.create({ name: 'Books', level: 1 });
      await createProductInCategory(cat._id, { isActive: true });
      await createProductInCategory(cat._id, { isActive: true });
      await createProductInCategory(cat._id, { isActive: false }); // inactive excluded
      await createProductInCategory(cat._id, { isActive: true, isDeleted: true }); // soft-deleted excluded

      const res = await request(app).get('/api/inventory/categories');
      expect(res.status).toBe(200);
      expect(res.body.categories).toHaveLength(1);
      expect(res.body.categories[0].productCount).toBe(2);
    });

    it('supports search by name', async () => {
      await Category.create({ name: 'Books', level: 1 });
      await Category.create({ name: 'Herbs', level: 1 });
      await Category.create({ name: 'Oils', level: 1 });

      const res = await request(app)
        .get('/api/inventory/categories')
        .query({ search: 'book' });

      expect(res.status).toBe(200);
      expect(res.body.categories.map((c: { name: string }) => c.name)).toEqual(['Books']);
    });

    it('supports search by description', async () => {
      await Category.create({ name: 'Alpha', description: 'healing herbs', level: 1 });
      await Category.create({ name: 'Beta', description: 'oils', level: 1 });

      const res = await request(app)
        .get('/api/inventory/categories')
        .query({ search: 'healing' });
      expect(res.body.categories.map((c: { name: string }) => c.name)).toEqual(['Alpha']);
    });

    it('filters by isActive=true', async () => {
      await Category.create({ name: 'A', level: 1, isActive: true });
      await Category.create({ name: 'B', level: 1, isActive: false });

      const res = await request(app)
        .get('/api/inventory/categories')
        .query({ isActive: 'true' });
      expect(res.body.categories.map((c: { name: string }) => c.name)).toEqual(['A']);
    });

    it('filters by isActive=false', async () => {
      await Category.create({ name: 'A', level: 1, isActive: true });
      await Category.create({ name: 'B', level: 1, isActive: false });

      const res = await request(app)
        .get('/api/inventory/categories')
        .query({ isActive: 'false' });
      expect(res.body.categories.map((c: { name: string }) => c.name)).toEqual(['B']);
    });

    it('paginates', async () => {
      for (let i = 0; i < 5; i++) {
        await Category.create({ name: `C${i}`, level: 1 });
      }
      const res = await request(app)
        .get('/api/inventory/categories')
        .query({ page: '1', limit: '2' });
      expect(res.body.categories).toHaveLength(2);
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(2);
    });
  });

  // ── READ ──
  describe('GET /api/inventory/categories/:id', () => {
    it('returns category with productCount', async () => {
      const cat = await Category.create({ name: 'Books', level: 1 });
      await createProductInCategory(cat._id, { isActive: true });
      await createProductInCategory(cat._id, { isActive: false });

      const res = await request(app).get(`/api/inventory/categories/${cat._id}`);
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Books');
      expect(res.body.productCount).toBe(1);
    });

    it('returns 404 for missing category', async () => {
      const res = await request(app).get(
        `/api/inventory/categories/${new mongoose.Types.ObjectId()}`
      );
      expect(res.status).toBe(404);
    });

    it('returns 400 for malformed id', async () => {
      const res = await request(app).get('/api/inventory/categories/not-an-id');
      expect(res.status).toBe(400);
    });
  });

  // ── UPDATE ──
  describe('PUT /api/inventory/categories/:id', () => {
    it('updates name, description, level, isActive, allowedUomTypes', async () => {
      const cat = await Category.create({ name: 'Old', level: 1 });
      const res = await request(app)
        .put(`/api/inventory/categories/${cat._id}`)
        .send({
          name: 'New',
          description: 'updated',
          level: 3,
          isActive: false,
          allowedUomTypes: ['volume'],
        });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('New');
      expect(res.body.description).toBe('updated');
      expect(res.body.level).toBe(3);
      expect(res.body.isActive).toBe(false);
      expect(res.body.allowedUomTypes).toEqual(['volume']);
    });

    it('partial update leaves other fields untouched', async () => {
      const cat = await Category.create({
        name: 'Keep',
        description: 'orig',
        level: 2,
      });
      const res = await request(app)
        .put(`/api/inventory/categories/${cat._id}`)
        .send({ description: 'changed' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Keep');
      expect(res.body.level).toBe(2);
      expect(res.body.description).toBe('changed');
    });

    it('strips HTML from updated fields', async () => {
      const cat = await Category.create({ name: 'X', level: 1 });
      const res = await request(app)
        .put(`/api/inventory/categories/${cat._id}`)
        .send({ name: '<i>Y</i>', description: '<b>d</b>' });
      expect(res.body.name).toBe('Y');
      expect(res.body.description).toBe('d');
    });

    it('allows saving same name to the same document (self-exclusion)', async () => {
      const cat = await Category.create({ name: 'Books', level: 1 });
      const res = await request(app)
        .put(`/api/inventory/categories/${cat._id}`)
        .send({ name: 'Books' });
      expect(res.status).toBe(200);
    });

    it('rejects renaming to a name used by another category (case-insensitive)', async () => {
      await Category.create({ name: 'Books', level: 1 });
      const other = await Category.create({ name: 'Herbs', level: 1 });
      const res = await request(app)
        .put(`/api/inventory/categories/${other._id}`)
        .send({ name: 'BOOKS' });
      expect(res.status).toBe(409);
    });

    it('rejects empty name after sanitization', async () => {
      const cat = await Category.create({ name: 'X', level: 1 });
      const res = await request(app)
        .put(`/api/inventory/categories/${cat._id}`)
        .send({ name: '   ' });
      expect(res.status).toBe(400);
    });

    it('returns 404 for missing category', async () => {
      const res = await request(app)
        .put(`/api/inventory/categories/${new mongoose.Types.ObjectId()}`)
        .send({ name: 'Whatever' });
      expect(res.status).toBe(404);
    });
  });

  // ── DELETE ──
  describe('DELETE /api/inventory/categories/:id', () => {
    it('deletes a category with no products', async () => {
      const cat = await Category.create({ name: 'Gone', level: 1 });
      const res = await request(app).delete(`/api/inventory/categories/${cat._id}`);
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/deleted/i);
      expect(await Category.findById(cat._id)).toBeNull();
    });

    it('blocks deletion when non-deleted products reference the category', async () => {
      const cat = await Category.create({ name: 'Busy', level: 1 });
      await createProductInCategory(cat._id, { isActive: true, isDeleted: false });
      await createProductInCategory(cat._id, { isActive: false, isDeleted: false });

      const res = await request(app).delete(`/api/inventory/categories/${cat._id}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/2 products/);
      expect(res.body.error).toMatch(/In use by/);
      expect(await Category.findById(cat._id)).not.toBeNull();
    });

    it('allows deletion when the only products are soft-deleted', async () => {
      const cat = await Category.create({ name: 'SoftOnly', level: 1 });
      await createProductInCategory(cat._id, { isActive: false, isDeleted: true });

      const res = await request(app).delete(`/api/inventory/categories/${cat._id}`);
      expect(res.status).toBe(200);
    });

    it('returns 404 for missing category', async () => {
      const res = await request(app).delete(
        `/api/inventory/categories/${new mongoose.Types.ObjectId()}`
      );
      expect(res.status).toBe(404);
    });

    it('blocks deletion when child categories reference the parent', async () => {
      const parent = await Category.create({ name: 'Parent', level: 1 });
      await Category.create({ name: 'Child', level: 2, parent: parent._id });

      const res = await request(app).delete(`/api/inventory/categories/${parent._id}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/child categor/i);
    });

    it('blocks deletion when a Bundle references the category name', async () => {
      const cat = await Category.create({ name: 'Kits', level: 1 });
      await Bundle.create({
        name: 'Starter',
        sku: `BDL-${Date.now()}`,
        category: 'Kits',
        bundleProducts: [],
        bundlePrice: 0,
        individualTotalPrice: 0,
        savings: 0,
        savingsPercentage: 0,
        isActive: true,
        status: 'active',
        availableQuantity: 0,
        maxQuantity: 0,
        createdBy: new mongoose.Types.ObjectId(),
      });

      const res = await request(app).delete(`/api/inventory/categories/${cat._id}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/bundle/i);
    });

    it('blocks deletion when a BlendTemplate references the category name', async () => {
      const cat = await Category.create({ name: 'Tinctures', level: 1 });
      await BlendTemplate.create({
        name: 'Calm',
        batchSize: 1,
        unitOfMeasurementId: new mongoose.Types.ObjectId(),
        unitName: 'ml',
        category: 'Tinctures',
        ingredients: [{
          productId: new mongoose.Types.ObjectId(),
          name: 'X',
          quantity: 1,
          unitOfMeasurementId: new mongoose.Types.ObjectId(),
          unitName: 'ml',
        }],
        sellingPrice: 10,
        isActive: true,
        usageCount: 0,
        createdBy: 'test',
      });

      const res = await request(app).delete(`/api/inventory/categories/${cat._id}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/blend template/i);
    });
  });

  // ── Bug-fix regressions ──
  describe('Regression: PUT non-existent id with conflicting name', () => {
    it('returns 404 (existence check precedes duplicate check)', async () => {
      await Category.create({ name: 'Taken', level: 1 });
      const res = await request(app)
        .put(`/api/inventory/categories/${new mongoose.Types.ObjectId()}`)
        .send({ name: 'Taken' });
      expect(res.status).toBe(404);
    });
  });

  describe('Regression: unique-name race (backstopped by index)', () => {
    it('direct duplicate inserts are rejected by the unique index', async () => {
      await Category.create({ name: 'Once', level: 1 });
      await expect(Category.create({ name: 'ONCE', level: 1 })).rejects.toMatchObject({
        code: 11000,
      });
    });
  });

  // ── Parent support ──
  describe('Parent category support', () => {
    it('creates a category with a valid parent', async () => {
      const parent = await Category.create({ name: 'Parent', level: 1 });
      const res = await request(app)
        .post('/api/inventory/categories')
        .send({ name: 'Child', level: 2, parent: parent._id.toString() });
      expect(res.status).toBe(201);
      expect(res.body.parent).toBe(parent._id.toString());
    });

    it('rejects create with non-existent parent id', async () => {
      const res = await request(app)
        .post('/api/inventory/categories')
        .send({ name: 'Orphan', parent: new mongoose.Types.ObjectId().toString() });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/parent/i);
    });

    it('rejects create with malformed parent id', async () => {
      const res = await request(app)
        .post('/api/inventory/categories')
        .send({ name: 'Bad', parent: 'not-an-id' });
      expect(res.status).toBe(400);
    });

    it('rejects self-parent on update', async () => {
      const cat = await Category.create({ name: 'Self', level: 1 });
      const res = await request(app)
        .put(`/api/inventory/categories/${cat._id}`)
        .send({ parent: cat._id.toString() });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/own parent/i);
    });

    it('clears parent when passed null', async () => {
      const parent = await Category.create({ name: 'P', level: 1 });
      const child = await Category.create({ name: 'C', level: 2, parent: parent._id });
      const res = await request(app)
        .put(`/api/inventory/categories/${child._id}`)
        .send({ parent: null });
      expect(res.status).toBe(200);
      expect(res.body.parent).toBeUndefined();
    });
  });

  // ── Type-coercion / validation edges ──
  describe('Validation edges', () => {
    it('rejects non-string name on create', async () => {
      const res = await request(app)
        .post('/api/inventory/categories')
        .send({ name: 123 });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/expected a string/i);
    });

    it('treats whitespace-padded name as a duplicate of the trimmed form', async () => {
      await request(app).post('/api/inventory/categories').send({ name: 'Books' });
      const res = await request(app)
        .post('/api/inventory/categories')
        .send({ name: '  Books  ' });
      expect(res.status).toBe(409);
    });

    it('rejects names over 200 characters on create', async () => {
      const res = await request(app)
        .post('/api/inventory/categories')
        .send({ name: 'A'.repeat(201) });
      expect(res.status).toBe(400);
    });

    it('rejects names over 200 characters on update', async () => {
      const cat = await Category.create({ name: 'Ok', level: 1 });
      const res = await request(app)
        .put(`/api/inventory/categories/${cat._id}`)
        .send({ name: 'B'.repeat(201) });
      expect(res.status).toBe(400);
    });

    it('rejects level < 1 on create', async () => {
      const res = await request(app)
        .post('/api/inventory/categories')
        .send({ name: 'Bad', level: 0 });
      expect(res.status).toBe(400);
    });

    it('rejects level < 1 on update', async () => {
      const cat = await Category.create({ name: 'Lvl', level: 1 });
      const res = await request(app)
        .put(`/api/inventory/categories/${cat._id}`)
        .send({ level: 0 });
      expect(res.status).toBe(400);
    });

    it('rejects invalid allowedUomTypes enum on update', async () => {
      const cat = await Category.create({ name: 'U', level: 1 });
      const res = await request(app)
        .put(`/api/inventory/categories/${cat._id}`)
        .send({ allowedUomTypes: ['banana'] });
      expect(res.status).toBe(400);
    });

    it('clears allowedUomTypes to [] on update', async () => {
      const cat = await Category.create({ name: 'W', level: 1, allowedUomTypes: ['weight'] });
      const res = await request(app)
        .put(`/api/inventory/categories/${cat._id}`)
        .send({ allowedUomTypes: [] });
      expect(res.status).toBe(200);
      expect(res.body.allowedUomTypes).toEqual([]);
    });

    it('empty PUT body is a no-op that returns the current doc', async () => {
      const cat = await Category.create({ name: 'Same', level: 2, description: 'd' });
      const res = await request(app)
        .put(`/api/inventory/categories/${cat._id}`)
        .send({});
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Same');
      expect(res.body.level).toBe(2);
      expect(res.body.description).toBe('d');
    });
  });

  // ── Listing: sort & pagination bounds ──
  describe('Listing: sort and pagination bounds', () => {
    it('honours sortBy and sortOrder', async () => {
      await Category.create({ name: 'C', level: 1 });
      await Category.create({ name: 'A', level: 1 });
      await Category.create({ name: 'B', level: 1 });

      const asc = await request(app)
        .get('/api/inventory/categories')
        .query({ sortBy: 'name', sortOrder: 'asc' });
      expect(asc.body.categories.map((c: { name: string }) => c.name)).toEqual(['A', 'B', 'C']);

      const desc = await request(app)
        .get('/api/inventory/categories')
        .query({ sortBy: 'name', sortOrder: 'desc' });
      expect(desc.body.categories.map((c: { name: string }) => c.name)).toEqual(['C', 'B', 'A']);
    });

    it('clamps page=0 to 1', async () => {
      await Category.create({ name: 'A', level: 1 });
      const res = await request(app)
        .get('/api/inventory/categories')
        .query({ page: '0' });
      expect(res.body.pagination.page).toBe(1);
    });

    it('clamps negative page to 1', async () => {
      await Category.create({ name: 'A', level: 1 });
      const res = await request(app)
        .get('/api/inventory/categories')
        .query({ page: '-3' });
      expect(res.body.pagination.page).toBe(1);
    });

    it('falls back to default limit (20) when limit=0', async () => {
      // QueryBuilder treats parseInt('0')=0 as falsy and uses the default.
      await Category.create({ name: 'A', level: 1 });
      const res = await request(app)
        .get('/api/inventory/categories')
        .query({ limit: '0' });
      expect(res.body.pagination.limit).toBe(20);
    });

    it('caps limit at 5000', async () => {
      await Category.create({ name: 'A', level: 1 });
      const res = await request(app)
        .get('/api/inventory/categories')
        .query({ limit: '99999' });
      expect(res.body.pagination.limit).toBe(5000);
    });
  });

  // ── Search safety ──
  describe('Search input safety', () => {
    it('treats regex special chars as literal (no injection)', async () => {
      await Category.create({ name: 'Plain', level: 1 });
      // ".*" would match everything unescaped — must return zero hits.
      const res = await request(app)
        .get('/api/inventory/categories')
        .query({ search: '.*' });
      expect(res.body.categories).toEqual([]);
    });

    it('handles unbalanced parens without crashing', async () => {
      await Category.create({ name: 'Plain', level: 1 });
      const res = await request(app)
        .get('/api/inventory/categories')
        .query({ search: '(' });
      expect(res.status).toBe(200);
      expect(res.body.categories).toEqual([]);
    });
  });
});
