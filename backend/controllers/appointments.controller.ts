import { Response } from 'express';
import { Types } from 'mongoose';
import { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import Appointment from '../models/Appointment.js';

// Get all appointments for dashboard
export const getAppointments = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { date, status } = req.query;
    
    interface AppointmentQuery {
      preferredDate?: {
        $gte: Date;
        $lte: Date;
      };
      status?: string;
    }
    
    const query: AppointmentQuery = {};
    
    if (date) {
      const startDate = new Date(date as string);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date as string);
      endDate.setHours(23, 59, 59, 999);
      
      query.preferredDate = {
        $gte: startDate,
        $lte: endDate
      };
    }
    
    if (status && status !== 'all') {
      query.status = status as string;
    }
    
    const appointments = await Appointment.find(query)
      .sort({ preferredDate: -1 })
      .lean();
    
    // Transform to match frontend interface
    const transformedAppointments = appointments.map((apt) => ({
      id: (apt._id as Types.ObjectId).toString(),
      date: apt.preferredDate,
      startTime: new Date(apt.preferredDate).toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      }),
      endTime: new Date(new Date(apt.preferredDate).getTime() + 60 * 60 * 1000).toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      }),
      status: apt.status || 'scheduled',
      createdAt: apt.createdAt,
      updatedAt: apt.updatedAt,
      patientId: apt.email || 'Unknown',
      service: apt.appointmentType || 'General Consultation',
      notes: apt.notes || `Health Concerns: ${apt.healthConcerns || 'None'}\nAllergies: ${apt.allergies || 'None'}\nMedications: ${apt.medications || 'None'}`,
      history: [{
        id: '1',
        appointmentId: (apt._id as Types.ObjectId).toString(),
        status: apt.status || 'scheduled',
        changedAt: apt.updatedAt,
        changedBy: 'system',
        notes: apt.source ? `Imported from ${apt.source}` : undefined
      }]
    }));

    res.json(transformedAppointments);
  } catch (error) {
    console.error('[Backend] Error fetching appointments - Full error:', error);
    console.error('[Backend] Error type:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('[Backend] Error message:', error instanceof Error ? error.message : 'Unknown error');
    console.error('[Backend] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    res.status(500).json({ 
      error: 'Failed to fetch appointments',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Update appointment status
export const updateAppointmentStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const appointment = await Appointment.findByIdAndUpdate(
      id,
      { status, updatedAt: new Date() },
      { new: true }
    );
    
    if (!appointment) {
      res.status(404).json({ error: 'Appointment not found' });
      return;
    }
    
    res.json({ message: 'Appointment updated successfully' });
  } catch (error) {
    console.error('Error updating appointment:', error);
    res.status(500).json({ error: 'Failed to update appointment' });
  }
};

// Delete appointment
export const deleteAppointment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    const appointment = await Appointment.findById(id);
    if (!appointment) {
      res.status(404).json({ error: 'Appointment not found' });
      return;
    }
    
    await Appointment.findByIdAndDelete(id);
    res.json({ message: 'Appointment deleted successfully' });
  } catch (error) {
    console.error('Error deleting appointment:', error);
    res.status(500).json({ error: 'Failed to delete appointment' });
  }
};

// Bulk delete appointments
export const bulkDeleteAppointments = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { appointmentIds } = req.body;
    
    if (!Array.isArray(appointmentIds) || appointmentIds.length === 0) {
      res.status(400).json({ error: 'Invalid appointment IDs' });
      return;
    }
    
    const result = await Appointment.deleteMany({ _id: { $in: appointmentIds } });
    
    res.json({ 
      deletedCount: result.deletedCount,
      message: `Successfully deleted ${result.deletedCount} appointments`
    });
  } catch (error) {
    console.error('Error bulk deleting appointments:', error);
    res.status(500).json({ error: 'Failed to delete appointments' });
  }
};