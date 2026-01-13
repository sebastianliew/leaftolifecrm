import express, { type IRouter } from 'express';
import { PatientsController } from '../controllers/patients.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/permission.middleware.js';
import { bulkOperationRateLimit } from '../middlewares/rateLimiting.middleware.js';

const router: IRouter = express.Router();
const patientsController = new PatientsController();

// Apply authentication to all routes
router.use(authenticateToken);

// GET /api/patients - Get all patients with search and pagination
router.get('/', requirePermission('patients', 'canAccessAllPatients'), patientsController.getAllPatients.bind(patientsController));

// GET /api/patients/recent - Get recent patients
router.get('/recent', requirePermission('patients', 'canAccessAllPatients'), patientsController.getRecentPatients.bind(patientsController));

// POST /api/patients/bulk-delete - Bulk delete patients (rate limited)
router.post('/bulk-delete', bulkOperationRateLimit, requirePermission('patients', 'canDeletePatients'), patientsController.bulkDeletePatients.bind(patientsController));

// GET /api/patients/:id - Get patient by ID
router.get('/:id', requirePermission('patients', 'canAccessAllPatients'), patientsController.getPatientById.bind(patientsController));

// POST /api/patients - Create new patient
router.post('/', requirePermission('patients', 'canCreatePatients'), patientsController.createPatient.bind(patientsController));

// PUT /api/patients/:id - Update patient
router.put('/:id', requirePermission('patients', 'canEditPatients'), patientsController.updatePatient.bind(patientsController));

// DELETE /api/patients/:id - Delete patient
router.delete('/:id', requirePermission('patients', 'canDeletePatients'), patientsController.deletePatient.bind(patientsController));

export default router;
