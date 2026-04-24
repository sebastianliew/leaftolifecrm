import { describe, it, expect, beforeAll, beforeEach } from '@jest/globals';
import express, { Express } from 'express';
import request from 'supertest';
import mongoose from 'mongoose';

import { Patient } from '../../models/Patient.js';
import { PatientsController } from '../../controllers/patients.controller.js';
import { errorHandler } from '../../middlewares/errorHandler.middleware.js';
import { patientPhotoUpload } from '../../middlewares/upload.middleware.js';
import { clearCollections } from '../setup/mongodb-memory-server.js';
import { setStorageDriver } from '../../lib/storage/index.js';
import { createMemoryDriver } from '../../lib/storage/memory.js';

// ── Test app: wires up the exact controller the real router uses, bypassing
//    auth + permission middlewares (those are separate concerns tested elsewhere).
function buildApp(): Express {
  const app = express();
  app.use(express.json());
  const c = new PatientsController();
  app.get('/api/patients/stats', c.getPatientStats.bind(c));
  app.get('/api/patients/recent', c.getRecentPatients.bind(c));
  app.get('/api/patients', c.getAllPatients.bind(c));
  app.post('/api/patients/bulk-delete', c.bulkDeletePatients.bind(c));
  app.get('/api/patients/:id/summary', c.getPatientSummary.bind(c));
  app.get('/api/patients/:id/photos', c.getPatientPhotos.bind(c));
  app.post(
    '/api/patients/:id/photos',
    patientPhotoUpload.single('file'),
    c.addPatientPhoto.bind(c)
  );
  app.delete('/api/patients/:id/photos', c.deletePatientPhoto.bind(c));
  app.get('/api/patients/:id', c.getPatientById.bind(c));
  app.post('/api/patients', c.createPatient.bind(c));
  app.put('/api/patients/:id', c.updatePatient.bind(c));
  app.delete('/api/patients/:id', c.deletePatient.bind(c));
  app.use(errorHandler);
  return app;
}

const basePatient = (overrides: Record<string, unknown> = {}) => ({
  firstName: 'Jane',
  lastName: 'Doe',
  dateOfBirth: '1990-05-14',
  gender: 'female',
  phone: '+6591234567',
  ...overrides,
});

describe('Patient endpoints (CRUD + behaviors)', () => {
  let app: Express;

  beforeAll(async () => {
    app = buildApp();
    await Patient.init();
  });

  beforeEach(async () => {
    await clearCollections();
  });

  // ── CREATE ────────────────────────────────────────────────────────────────
  describe('POST /api/patients', () => {
    it('creates a patient with required fields and defaults', async () => {
      const res = await request(app).post('/api/patients').send(basePatient());
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        firstName: 'Jane',
        lastName: 'Doe',
        gender: 'female',
        status: 'active',
        hasConsent: false,
      });
      expect(res.body._id).toBeDefined();
      expect(res.body.createdAt).toBeDefined();
    });

    it('normalizes email to lowercase and trims', async () => {
      const res = await request(app)
        .post('/api/patients')
        .send(basePatient({ email: '  JANE@Example.COM  ' }));
      expect(res.status).toBe(201);
      expect(res.body.email).toBe('jane@example.com');
    });

    it('uppercases NRIC and enforces uniqueness', async () => {
      const first = await request(app)
        .post('/api/patients')
        .send(basePatient({ nric: 's1234567a' }));
      expect(first.status).toBe(201);
      expect(first.body.nric).toBe('S1234567A');

      const dup = await request(app)
        .post('/api/patients')
        .send(basePatient({ firstName: 'John', lastName: 'Smith', nric: 'S1234567A' }));
      expect(dup.status).toBe(409);
      expect(dup.body.error).toMatch(/already exists/i);
    });

    it('treats blank NRIC as null (sparse unique allows multiple blanks)', async () => {
      const a = await request(app).post('/api/patients').send(basePatient({ nric: '   ' }));
      const b = await request(app)
        .post('/api/patients')
        .send(basePatient({ firstName: 'John', lastName: 'S', nric: '' }));
      expect(a.status).toBe(201);
      expect(b.status).toBe(201);
      expect(a.body.nric).toBeNull();
      expect(b.body.nric).toBeNull();
    });

    it('rejects future date of birth', async () => {
      const future = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      const res = await request(app)
        .post('/api/patients')
        .send(basePatient({ dateOfBirth: future }));
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/future/i);
    });

    it('rejects invalid date of birth string', async () => {
      const res = await request(app)
        .post('/api/patients')
        .send(basePatient({ dateOfBirth: 'not-a-date' }));
      expect(res.status).toBe(400);
    });

    it('rejects missing required firstName (mongoose validation)', async () => {
      const { firstName: _firstName, ...rest } = basePatient();
      void _firstName;
      const res = await request(app).post('/api/patients').send(rest);
      expect(res.status).toBe(400);
    });

    it('rejects invalid gender enum', async () => {
      const res = await request(app)
        .post('/api/patients')
        .send(basePatient({ gender: 'banana' }));
      expect(res.status).toBe(400);
    });

    it('rejects invalid bloodType enum', async () => {
      const res = await request(app)
        .post('/api/patients')
        .send(basePatient({ bloodType: 'Z+' }));
      expect(res.status).toBe(400);
    });

    it('strips unknown fields (mass-assignment protection)', async () => {
      const res = await request(app)
        .post('/api/patients')
        .send(basePatient({ isAdmin: true, role: 'super_admin' }));
      expect(res.status).toBe(201);
      expect((res.body as Record<string, unknown>).isAdmin).toBeUndefined();
      expect((res.body as Record<string, unknown>).role).toBeUndefined();
    });

    it('accepts nested memberBenefits and marketingPreferences on create', async () => {
      const res = await request(app)
        .post('/api/patients')
        .send(
          basePatient({
            memberBenefits: { discountPercentage: 10, membershipTier: 'gold' },
            marketingPreferences: { emailOptIn: true },
          })
        );
      expect(res.status).toBe(201);
      expect(res.body.memberBenefits?.discountPercentage).toBe(10);
      expect(res.body.memberBenefits?.membershipTier).toBe('gold');
    });
  });

  // ── READ: BY ID ───────────────────────────────────────────────────────────
  describe('GET /api/patients/:id', () => {
    it('returns full patient document', async () => {
      const created = await request(app).post('/api/patients').send(basePatient());
      const res = await request(app).get(`/api/patients/${created.body._id}`);
      expect(res.status).toBe(200);
      expect(res.body.firstName).toBe('Jane');
    });

    it('returns 404 for missing patient', async () => {
      const res = await request(app).get(`/api/patients/${new mongoose.Types.ObjectId()}`);
      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/not found/i);
    });

    it('returns 400 for malformed id', async () => {
      const res = await request(app).get('/api/patients/not-an-id');
      expect(res.status).toBe(400);
    });
  });

  // ── READ: SUMMARY ─────────────────────────────────────────────────────────
  describe('GET /api/patients/:id/summary', () => {
    it('returns lightweight projection (no medicalHistory)', async () => {
      const created = await request(app)
        .post('/api/patients')
        .send(basePatient({ email: 'a@b.com' }));
      const res = await request(app).get(`/api/patients/${created.body._id}/summary`);
      expect(res.status).toBe(200);
      expect(res.body.firstName).toBe('Jane');
      expect(res.body.email).toBe('a@b.com');
      expect(res.body.medicalHistory).toBeUndefined();
      expect(res.body.enhancedMedicalData).toBeUndefined();
    });

    it('404 for missing id', async () => {
      const res = await request(app).get(
        `/api/patients/${new mongoose.Types.ObjectId()}/summary`
      );
      expect(res.status).toBe(404);
    });

    it('400 for malformed id', async () => {
      const res = await request(app).get('/api/patients/bad-id/summary');
      expect(res.status).toBe(400);
    });
  });

  // ── LIST ──────────────────────────────────────────────────────────────────
  describe('GET /api/patients', () => {
    it('returns empty list with pagination structure', async () => {
      const res = await request(app).get('/api/patients');
      expect(res.status).toBe(200);
      expect(res.body.patients).toEqual([]);
      expect(res.body.pagination).toMatchObject({
        currentPage: 1,
        totalCount: 0,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false,
      });
    });

    it('paginates results', async () => {
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/patients')
          .send(basePatient({ firstName: `P${i}`, lastName: 'Test' }));
      }
      const res = await request(app).get('/api/patients').query({ page: '1', limit: '2' });
      expect(res.body.patients).toHaveLength(2);
      expect(res.body.pagination).toMatchObject({
        currentPage: 1,
        totalPages: 3,
        totalCount: 5,
        limit: 2,
        hasNextPage: true,
        hasPrevPage: false,
      });
    });

    it('clamps limit above max (100)', async () => {
      await request(app).post('/api/patients').send(basePatient());
      const res = await request(app).get('/api/patients').query({ limit: '5000' });
      expect(res.body.pagination.limit).toBe(100);
    });

    it('search by firstName (case-insensitive, >=2 chars)', async () => {
      await request(app)
        .post('/api/patients')
        .send(basePatient({ firstName: 'Alice', lastName: 'Aqua' }));
      await request(app)
        .post('/api/patients')
        .send(basePatient({ firstName: 'Bob', lastName: 'Blue' }));
      const res = await request(app).get('/api/patients').query({ search: 'ali' });
      expect(res.body.patients).toHaveLength(1);
      expect(res.body.patients[0].firstName).toBe('Alice');
    });

    it('search term <2 chars is ignored', async () => {
      await request(app)
        .post('/api/patients')
        .send(basePatient({ firstName: 'Alice' }));
      const res = await request(app).get('/api/patients').query({ search: 'a' });
      expect(res.body.patients).toHaveLength(1);
    });

    it('search escapes regex special chars (no injection)', async () => {
      await request(app)
        .post('/api/patients')
        .send(basePatient({ firstName: 'Alice' }));
      // Unescaped ".*" would match everything; escaped it matches nothing.
      const res = await request(app).get('/api/patients').query({ search: '.*' });
      expect(res.body.patients).toEqual([]);
    });

    it('filters by status=inactive', async () => {
      const active = await request(app).post('/api/patients').send(basePatient());
      const inactive = await request(app)
        .post('/api/patients')
        .send(basePatient({ firstName: 'Gone' }));
      await request(app).delete(`/api/patients/${inactive.body._id}`);

      const res = await request(app).get('/api/patients').query({ status: 'inactive' });
      expect(res.body.patients).toHaveLength(1);
      expect(res.body.patients[0]._id).toBe(inactive.body._id);

      const resAll = await request(app).get('/api/patients').query({ status: 'all' });
      expect(resAll.body.patients).toHaveLength(2);
      void active;
    });

    it('filters by tier=gold', async () => {
      await request(app)
        .post('/api/patients')
        .send(basePatient({ memberBenefits: { discountPercentage: 0, membershipTier: 'gold' } }));
      await request(app)
        .post('/api/patients')
        .send(
          basePatient({
            firstName: 'Silver',
            memberBenefits: { discountPercentage: 0, membershipTier: 'silver' },
          })
        );
      const res = await request(app).get('/api/patients').query({ tier: 'gold' });
      expect(res.body.patients).toHaveLength(1);
      expect(res.body.patients[0].memberBenefits.membershipTier).toBe('gold');
    });

    it('sort by lastName asc/desc', async () => {
      await request(app).post('/api/patients').send(basePatient({ lastName: 'Charlie' }));
      await request(app).post('/api/patients').send(basePatient({ lastName: 'Alpha' }));
      await request(app).post('/api/patients').send(basePatient({ lastName: 'Bravo' }));

      const asc = await request(app)
        .get('/api/patients')
        .query({ sortBy: 'lastName', sortOrder: 'asc' });
      expect(asc.body.patients.map((p: { lastName: string }) => p.lastName)).toEqual([
        'Alpha',
        'Bravo',
        'Charlie',
      ]);

      const desc = await request(app)
        .get('/api/patients')
        .query({ sortBy: 'lastName', sortOrder: 'desc' });
      expect(desc.body.patients.map((p: { lastName: string }) => p.lastName)).toEqual([
        'Charlie',
        'Bravo',
        'Alpha',
      ]);
    });

    it('ignores invalid sortBy (falls back to createdAt)', async () => {
      await request(app).post('/api/patients').send(basePatient());
      const res = await request(app).get('/api/patients').query({ sortBy: 'hackField' });
      expect(res.status).toBe(200);
    });

    it('list projection excludes heavy fields', async () => {
      const created = await request(app)
        .post('/api/patients')
        .send(
          basePatient({
            medicalHistory: { appointments: [], prescriptions: [], customBlends: [] },
          })
        );
      const res = await request(app).get('/api/patients');
      expect(res.body.patients[0].medicalHistory).toBeUndefined();
      expect(res.body.patients[0].consentHistory).toBeUndefined();
      void created;
    });
  });

  // ── UPDATE ────────────────────────────────────────────────────────────────
  describe('PUT /api/patients/:id', () => {
    it('partial update leaves other fields untouched', async () => {
      const created = await request(app)
        .post('/api/patients')
        .send(basePatient({ email: 'old@x.com' }));
      const res = await request(app)
        .put(`/api/patients/${created.body._id}`)
        .send({ phone: '+6598765432' });
      expect(res.status).toBe(200);
      expect(res.body.phone).toBe('+6598765432');
      expect(res.body.email).toBe('old@x.com');
      expect(res.body.firstName).toBe('Jane');
    });

    it('nested memberBenefits uses dot notation (merges, not replaces)', async () => {
      const created = await request(app)
        .post('/api/patients')
        .send(
          basePatient({
            memberBenefits: {
              discountPercentage: 10,
              discountReason: 'loyalty',
              membershipTier: 'silver',
            },
          })
        );
      const res = await request(app)
        .put(`/api/patients/${created.body._id}`)
        .send({ memberBenefits: { discountPercentage: 20 } });
      expect(res.status).toBe(200);
      expect(res.body.memberBenefits.discountPercentage).toBe(20);
      // discountReason and membershipTier should survive because dot-notation merges
      expect(res.body.memberBenefits.discountReason).toBe('loyalty');
      expect(res.body.memberBenefits.membershipTier).toBe('silver');
    });

    it('NRIC uniqueness enforced across patients on update', async () => {
      const a = await request(app)
        .post('/api/patients')
        .send(basePatient({ nric: 'S1111111A' }));
      await request(app)
        .post('/api/patients')
        .send(basePatient({ firstName: 'B', nric: 'S2222222B' }));
      const res = await request(app)
        .put(`/api/patients/${a.body._id}`)
        .send({ nric: 'S2222222B' });
      expect(res.status).toBe(409);
    });

    it('allows saving same NRIC on same document (self-exclusion)', async () => {
      const a = await request(app)
        .post('/api/patients')
        .send(basePatient({ nric: 'S3333333C' }));
      const res = await request(app)
        .put(`/api/patients/${a.body._id}`)
        .send({ nric: 's3333333c' });
      expect(res.status).toBe(200);
      expect(res.body.nric).toBe('S3333333C');
    });

    it('rejects future DOB on update', async () => {
      const created = await request(app).post('/api/patients').send(basePatient());
      const future = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      const res = await request(app)
        .put(`/api/patients/${created.body._id}`)
        .send({ dateOfBirth: future });
      expect(res.status).toBe(400);
    });

    it('strips unknown fields on update', async () => {
      const created = await request(app).post('/api/patients').send(basePatient());
      const res = await request(app)
        .put(`/api/patients/${created.body._id}`)
        .send({ role: 'super_admin', isAdmin: true, phone: '+6500000000' });
      expect(res.status).toBe(200);
      expect(res.body.phone).toBe('+6500000000');
      expect((res.body as Record<string, unknown>).role).toBeUndefined();
    });

    it('404 for missing id', async () => {
      const res = await request(app)
        .put(`/api/patients/${new mongoose.Types.ObjectId()}`)
        .send({ phone: '+6500000000' });
      expect(res.status).toBe(404);
    });

    it('400 for malformed id', async () => {
      const res = await request(app).put('/api/patients/bad-id').send({ phone: 'x' });
      expect(res.status).toBe(400);
    });
  });

  // ── DELETE (soft) ─────────────────────────────────────────────────────────
  describe('DELETE /api/patients/:id', () => {
    it('soft-deletes (status=inactive), record still exists', async () => {
      const created = await request(app).post('/api/patients').send(basePatient());
      const res = await request(app).delete(`/api/patients/${created.body._id}`);
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/deactivated/i);

      const stillThere = await Patient.findById(created.body._id).lean();
      expect(stillThere).not.toBeNull();
      expect((stillThere as unknown as { status: string }).status).toBe('inactive');
    });

    it('404 for missing id', async () => {
      const res = await request(app).delete(
        `/api/patients/${new mongoose.Types.ObjectId()}`
      );
      expect(res.status).toBe(404);
    });

    it('400 for malformed id', async () => {
      const res = await request(app).delete('/api/patients/bad-id');
      expect(res.status).toBe(400);
    });
  });

  // ── BULK DELETE ───────────────────────────────────────────────────────────
  describe('POST /api/patients/bulk-delete', () => {
    it('deactivates multiple patients', async () => {
      const a = await request(app).post('/api/patients').send(basePatient());
      const b = await request(app)
        .post('/api/patients')
        .send(basePatient({ firstName: 'B' }));
      const c = await request(app)
        .post('/api/patients')
        .send(basePatient({ firstName: 'C' }));

      const res = await request(app)
        .post('/api/patients/bulk-delete')
        .send({ patientIds: [a.body._id, b.body._id] });

      expect(res.status).toBe(200);
      expect(res.body.deletedCount).toBe(2);

      const surviving = await Patient.findById(c.body._id).lean();
      expect((surviving as unknown as { status: string }).status).toBe('active');
    });

    it('rejects empty patientIds array', async () => {
      const res = await request(app)
        .post('/api/patients/bulk-delete')
        .send({ patientIds: [] });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/required/i);
    });

    it('rejects missing patientIds', async () => {
      const res = await request(app).post('/api/patients/bulk-delete').send({});
      expect(res.status).toBe(400);
    });

    it('400 when any id is malformed', async () => {
      const a = await request(app).post('/api/patients').send(basePatient());
      const res = await request(app)
        .post('/api/patients/bulk-delete')
        .send({ patientIds: [a.body._id, 'not-an-id'] });
      expect(res.status).toBe(400);
    });

    it('returns 0 modified when ids do not exist (non-error)', async () => {
      const res = await request(app)
        .post('/api/patients/bulk-delete')
        .send({ patientIds: [new mongoose.Types.ObjectId().toString()] });
      expect(res.status).toBe(200);
      expect(res.body.deletedCount).toBe(0);
    });
  });

  // ── RECENT ────────────────────────────────────────────────────────────────
  describe('GET /api/patients/recent', () => {
    it('returns most recently updated patients', async () => {
      await request(app).post('/api/patients').send(basePatient({ firstName: 'First' }));
      const second = await request(app)
        .post('/api/patients')
        .send(basePatient({ firstName: 'Second' }));
      // Bump updatedAt of "Second" by editing it
      await request(app).put(`/api/patients/${second.body._id}`).send({ phone: '+6500000001' });

      const res = await request(app).get('/api/patients/recent').query({ limit: '2' });
      expect(res.status).toBe(200);
      expect(res.body.patients[0].firstName).toBe('Second');
    });

    it('defaults limit=10 when not provided', async () => {
      for (let i = 0; i < 12; i++) {
        await request(app)
          .post('/api/patients')
          .send(basePatient({ firstName: `P${i}` }));
      }
      const res = await request(app).get('/api/patients/recent');
      expect(res.body.patients).toHaveLength(10);
    });

    it('clamps limit to 100', async () => {
      await request(app).post('/api/patients').send(basePatient());
      const res = await request(app).get('/api/patients/recent').query({ limit: '99999' });
      expect(res.status).toBe(200);
      // Only 1 patient so body has 1, but no error thrown from clamp
      expect(res.body.patients).toHaveLength(1);
    });
  });

  // ── STATS ─────────────────────────────────────────────────────────────────
  describe('GET /api/patients/stats', () => {
    it('returns zero counts when empty', async () => {
      const res = await request(app).get('/api/patients/stats');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        totalPatients: 0,
        activePatients: 0,
        inactivePatients: 0,
        withConsent: 0,
        recentRegistrations: 0,
      });
    });

    it('counts active, inactive, and consented patients correctly', async () => {
      await request(app)
        .post('/api/patients')
        .send(basePatient({ firstName: 'A', hasConsent: true }));
      await request(app)
        .post('/api/patients')
        .send(basePatient({ firstName: 'B', hasConsent: false }));
      const c = await request(app)
        .post('/api/patients')
        .send(basePatient({ firstName: 'C', hasConsent: true }));
      await request(app).delete(`/api/patients/${c.body._id}`);

      const res = await request(app).get('/api/patients/stats');
      expect(res.body.totalPatients).toBe(3);
      expect(res.body.activePatients).toBe(2);
      expect(res.body.inactivePatients).toBe(1);
      expect(res.body.withConsent).toBe(2);
      expect(res.body.recentRegistrations).toBe(3);
    });
  });

  // ── INDEX / SCHEMA REGRESSIONS ────────────────────────────────────────────
  describe('Schema regressions', () => {
    it('sparse unique NRIC allows many null values', async () => {
      for (let i = 0; i < 4; i++) {
        const res = await request(app)
          .post('/api/patients')
          .send(basePatient({ firstName: `N${i}`, nric: '' }));
        expect(res.status).toBe(201);
      }
      const list = await request(app).get('/api/patients').query({ limit: '100' });
      expect(list.body.patients).toHaveLength(4);
    });

    it('can create a patient without optional bloodType/maritalStatus', async () => {
      const res = await request(app)
        .post('/api/patients')
        .send(basePatient({ bloodType: undefined, maritalStatus: undefined }));
      expect(res.status).toBe(201);
    });
  });

  // ── MEDICAL PHOTOS ────────────────────────────────────────────────────────
  // A 1x1 PNG — enough bytes for multer's mime sniffer.
  const TINY_PNG = Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478' +
      '9c6200010000050001' +
      '0d0a2db40000000049454e44ae426082',
    'hex'
  );

  describe('Medical photo endpoints (Wasabi via memory driver)', () => {
    const memDriver = createMemoryDriver();

    beforeAll(() => {
      setStorageDriver(memDriver);
    });

    beforeEach(() => {
      memDriver.store.clear();
    });

    async function createPatient() {
      const res = await request(app).post('/api/patients').send(basePatient());
      return res.body._id as string;
    }

    describe('POST /api/patients/:id/photos', () => {
      it('uploads to storage, records metadata, returns public url', async () => {
        const pid = await createPatient();
        const res = await request(app)
          .post(`/api/patients/${pid}/photos`)
          .attach('file', TINY_PNG, { filename: 'scan.png', contentType: 'image/png' });

        expect(res.status).toBe(201);
        expect(res.body.photo).toMatchObject({
          originalName: 'scan.png',
          contentType: 'image/png',
          size: TINY_PNG.length,
        });
        expect(res.body.photo.storageKey).toMatch(
          new RegExp(`^patient-photos/${pid}/[0-9a-f-]+\\.png$`)
        );
        expect(res.body.photo.url).toBe(`memory://test-bucket/${res.body.photo.storageKey}`);

        // The buffer was handed to the storage driver, not written to disk
        const stored = memDriver.store.get(res.body.photo.storageKey);
        expect(stored).toBeDefined();
        expect(stored!.length).toBe(TINY_PNG.length);

        const persisted = await Patient.findById(pid).select('medicalPhotos').lean();
        expect((persisted as unknown as { medicalPhotos: unknown[] }).medicalPhotos).toHaveLength(1);
      });

      it('rejects requests with no file', async () => {
        const pid = await createPatient();
        const res = await request(app).post(`/api/patients/${pid}/photos`);
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/no file/i);
      });

      it('rejects non-image uploads', async () => {
        const pid = await createPatient();
        const res = await request(app)
          .post(`/api/patients/${pid}/photos`)
          .attach('file', Buffer.from('not an image'), {
            filename: 'doc.pdf',
            contentType: 'application/pdf',
          });
        expect(res.status).toBeGreaterThanOrEqual(400);
      });

      it('400 when patient id is malformed', async () => {
        const res = await request(app)
          .post('/api/patients/not-an-id/photos')
          .attach('file', TINY_PNG, { filename: 's.png', contentType: 'image/png' });
        expect(res.status).toBe(400);
      });

      it('404 when patient does not exist (no orphan in storage)', async () => {
        const ghostId = new mongoose.Types.ObjectId().toString();
        const res = await request(app)
          .post(`/api/patients/${ghostId}/photos`)
          .attach('file', TINY_PNG, { filename: 's.png', contentType: 'image/png' });
        expect(res.status).toBe(404);
        // Storage must be untouched — the service checks existence before upload
        expect([...memDriver.store.keys()]).toHaveLength(0);
      });
    });

    describe('GET /api/patients/:id/photos', () => {
      it('returns [] for a patient with no photos', async () => {
        const pid = await createPatient();
        const res = await request(app).get(`/api/patients/${pid}/photos`);
        expect(res.status).toBe(200);
        expect(res.body.photos).toEqual([]);
      });

      it('returns uploaded photos', async () => {
        const pid = await createPatient();
        await request(app)
          .post(`/api/patients/${pid}/photos`)
          .attach('file', TINY_PNG, { filename: 'a.png', contentType: 'image/png' });
        await request(app)
          .post(`/api/patients/${pid}/photos`)
          .attach('file', TINY_PNG, { filename: 'b.png', contentType: 'image/png' });

        const res = await request(app).get(`/api/patients/${pid}/photos`);
        expect(res.status).toBe(200);
        expect(res.body.photos).toHaveLength(2);
        expect(res.body.photos[0].originalName).toBe('a.png');
      });

      it('404 for missing patient', async () => {
        const res = await request(app).get(
          `/api/patients/${new mongoose.Types.ObjectId()}/photos`
        );
        expect(res.status).toBe(404);
      });

      it('400 for malformed id', async () => {
        const res = await request(app).get('/api/patients/bad-id/photos');
        expect(res.status).toBe(400);
      });
    });

    describe('DELETE /api/patients/:id/photos', () => {
      it('removes the photo from DB and from storage', async () => {
        const pid = await createPatient();
        const up = await request(app)
          .post(`/api/patients/${pid}/photos`)
          .attach('file', TINY_PNG, { filename: 'doomed.png', contentType: 'image/png' });
        const photoId = up.body.photo._id;
        const key = up.body.photo.storageKey;
        expect(memDriver.store.has(key)).toBe(true);

        const del = await request(app).delete(
          `/api/patients/${pid}/photos?photoId=${photoId}`
        );
        expect(del.status).toBe(200);
        expect(del.body.message).toMatch(/deleted/i);
        expect(memDriver.store.has(key)).toBe(false);

        const persisted = await Patient.findById(pid).select('medicalPhotos').lean();
        expect((persisted as unknown as { medicalPhotos: unknown[] }).medicalPhotos).toHaveLength(0);
      });

      it('400 when photoId missing', async () => {
        const pid = await createPatient();
        const res = await request(app).delete(`/api/patients/${pid}/photos`);
        expect(res.status).toBe(400);
      });

      it('400 when photoId is malformed', async () => {
        const pid = await createPatient();
        const res = await request(app).delete(
          `/api/patients/${pid}/photos?photoId=not-an-id`
        );
        expect(res.status).toBe(400);
      });

      it('404 when photoId does not exist on that patient', async () => {
        const pid = await createPatient();
        const res = await request(app).delete(
          `/api/patients/${pid}/photos?photoId=${new mongoose.Types.ObjectId()}`
        );
        expect(res.status).toBe(404);
      });

      it('404 when the patient itself does not exist', async () => {
        const res = await request(app).delete(
          `/api/patients/${new mongoose.Types.ObjectId()}/photos?photoId=${new mongoose.Types.ObjectId()}`
        );
        expect(res.status).toBe(404);
      });
    });

    describe('List projection', () => {
      it('GET /api/patients list omits medicalPhotos', async () => {
        const pid = await createPatient();
        await request(app)
          .post(`/api/patients/${pid}/photos`)
          .attach('file', TINY_PNG, { filename: 'hide.png', contentType: 'image/png' });

        const list = await request(app).get('/api/patients');
        expect(list.body.patients[0].medicalPhotos).toBeUndefined();
      });
    });
  });
});
