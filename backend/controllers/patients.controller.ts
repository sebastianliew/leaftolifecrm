import { Request, Response } from 'express';
import { PatientService } from '../services/PatientService.js';
import type { PatientFormData } from '../types/patient.js';

const patientService = new PatientService();

/** Extract statusCode from error (default 500). */
function errorStatus(error: unknown): number {
  return (error as { statusCode?: number }).statusCode || 500;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export class PatientsController {
  // Get all patients with search, filters, and pagination
  async getAllPatients(req: Request, res: Response) {
    try {
      const {
        search,
        page = 1,
        limit = 25,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        status: statusFilter,
        tier: tierFilter
      } = req.query;

      const result = await patientService.getAllPatients(
        search as string,
        parseInt(page as string),
        parseInt(limit as string),
        sortBy as string,
        sortOrder as 'asc' | 'desc',
        statusFilter as string,
        tierFilter as string
      );

      res.json(result);
    } catch (error) {
      console.error('Error fetching patients:', error);
      res.status(500).json({ error: errorMessage(error, 'Failed to fetch patients') });
    }
  }

  // Get patient by ID
  async getPatientById(req: Request, res: Response): Promise<void> {
    try {
      const patient = await patientService.getPatientById(req.params.id);
      res.json(patient);
    } catch (error) {
      const status = errorStatus(error);
      res.status(status).json({ error: errorMessage(error, 'Failed to fetch patient') });
    }
  }

  // Create new patient
  async createPatient(req: Request, res: Response): Promise<void> {
    try {
      const patient = await patientService.createPatient(req.body as PatientFormData);
      res.status(201).json(patient);
    } catch (error) {
      console.error('Error creating patient:', error);
      const msg = errorMessage(error, 'Failed to create patient');
      const isValidation = (error as { name?: string }).name === 'ValidationError';
      const status = msg.includes('already exists') ? 409 : isValidation ? 400 : errorStatus(error);
      res.status(status).json({ error: msg });
    }
  }

  // Update patient
  async updatePatient(req: Request, res: Response): Promise<void> {
    try {
      const patient = await patientService.updatePatient(req.params.id, req.body as Partial<PatientFormData>);
      res.json(patient);
    } catch (error) {
      console.error('Error updating patient:', error);
      const msg = errorMessage(error, 'Failed to update patient');
      const isValidation = (error as { name?: string }).name === 'ValidationError';
      const status = msg.includes('already exists') ? 409 : isValidation ? 400 : errorStatus(error);
      res.status(status).json({ error: msg });
    }
  }

  // Delete patient (soft delete — deactivates)
  async deletePatient(req: Request, res: Response): Promise<void> {
    try {
      const result = await patientService.deletePatient(req.params.id);
      res.json(result);
    } catch (error) {
      res.status(errorStatus(error)).json({ error: errorMessage(error, 'Failed to delete patient') });
    }
  }

  // Get patient summary (lightweight — for transaction selectors)
  async getPatientSummary(req: Request, res: Response): Promise<void> {
    try {
      const patient = await patientService.getPatientSummary(req.params.id);
      res.json(patient);
    } catch (error) {
      const status = errorStatus(error);
      res.status(status).json({ error: errorMessage(error, 'Failed to fetch patient') });
    }
  }

  // Get recent patients
  async getRecentPatients(req: Request, res: Response) {
    try {
      const { limit = 10 } = req.query;
      const patients = await patientService.getRecentPatients(parseInt(limit as string));
      res.json({ patients });
    } catch (error) {
      console.error('Error fetching recent patients:', error);
      res.status(500).json({ error: errorMessage(error, 'Failed to fetch recent patients') });
    }
  }

  // Bulk delete patients (soft delete — deactivates)
  async bulkDeletePatients(req: Request, res: Response): Promise<void> {
    try {
      const { patientIds } = req.body;
      const result = await patientService.bulkDeletePatients(patientIds);
      res.json(result);
    } catch (error) {
      console.error('Error bulk deleting patients:', error);
      res.status(errorStatus(error)).json({ error: errorMessage(error, 'Failed to delete patients') });
    }
  }

  // Get patient statistics
  async getPatientStats(req: Request, res: Response) {
    try {
      const stats = await patientService.getPatientStats();
      res.json(stats);
    } catch (error) {
      console.error('Error fetching patient stats:', error);
      res.status(500).json({ error: errorMessage(error, 'Failed to fetch patient statistics') });
    }
  }
}
