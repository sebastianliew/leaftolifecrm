import { Response } from 'express';
import { Types } from 'mongoose';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import Appointment from '../models/Appointment.js';
import { asyncHandler, NotFoundError, ValidationError } from '../middlewares/errorHandler.middleware.js';

export const getAppointments = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { date, status } = req.query as Record<string, string>;
  const query: Record<string, unknown> = {};

  if (date) {
    const start = new Date(date); start.setHours(0, 0, 0, 0);
    const end = new Date(date); end.setHours(23, 59, 59, 999);
    query.preferredDate = { $gte: start, $lte: end };
  }
  if (status && status !== 'all') query.status = status;

  const appointments = await Appointment.find(query).sort({ preferredDate: -1 }).lean();

  res.json(appointments.map((apt) => ({
    id: (apt._id as Types.ObjectId).toString(),
    date: apt.preferredDate,
    startTime: new Date(apt.preferredDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
    endTime: new Date(new Date(apt.preferredDate).getTime() + 3600000).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
    status: apt.status || 'scheduled',
    createdAt: apt.createdAt, updatedAt: apt.updatedAt,
    patientId: apt.email || 'Unknown',
    service: apt.appointmentType || 'General Consultation',
    notes: apt.notes || `Health Concerns: ${apt.healthConcerns || 'None'}\nAllergies: ${apt.allergies || 'None'}\nMedications: ${apt.medications || 'None'}`,
    history: [{ id: '1', appointmentId: (apt._id as Types.ObjectId).toString(), status: apt.status || 'scheduled', changedAt: apt.updatedAt, changedBy: 'system', notes: apt.source ? `Imported from ${apt.source}` : undefined }]
  })));
});

export const updateAppointmentStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const appointment = await Appointment.findByIdAndUpdate(req.params.id, { status: req.body.status, updatedAt: new Date() }, { new: true });
  if (!appointment) throw new NotFoundError('Appointment', req.params.id);
  res.json({ message: 'Appointment updated successfully' });
});

export const deleteAppointment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const appointment = await Appointment.findByIdAndDelete(req.params.id);
  if (!appointment) throw new NotFoundError('Appointment', req.params.id);
  res.json({ message: 'Appointment deleted successfully' });
});

export const bulkDeleteAppointments = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { appointmentIds } = req.body;
  if (!Array.isArray(appointmentIds) || !appointmentIds.length) throw new ValidationError('Invalid appointment IDs');
  const result = await Appointment.deleteMany({ _id: { $in: appointmentIds } });
  res.json({ deletedCount: result.deletedCount, message: `Successfully deleted ${result.deletedCount} appointments` });
});
