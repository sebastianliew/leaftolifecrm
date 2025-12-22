import express, { type IRouter } from 'express';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/permission.middleware.js';
import {
  getAppointments,
  updateAppointmentStatus,
  deleteAppointment,
  bulkDeleteAppointments
} from '../controllers/appointments.controller.js';

const router: IRouter = express.Router();

// Dashboard appointments routes
router.get('/dashboard/appointments', authenticateToken, requirePermission('appointments', 'canViewAllAppointments'), getAppointments);
router.put('/dashboard/appointments/:id', authenticateToken, requirePermission('appointments', 'canEditAppointments'), updateAppointmentStatus);
router.delete('/dashboard/appointments/:id', authenticateToken, requirePermission('appointments', 'canDeleteAppointments'), deleteAppointment);

// Bulk operations
router.post('/appointments/bulk-delete', authenticateToken, requirePermission('appointments', 'canDeleteAppointments'), bulkDeleteAppointments);

export default router;