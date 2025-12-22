import { Request, Response } from 'express';
import { PatientService } from '../services/PatientService.js';
import type { PatientFormData } from '../types/patient.js';

export class PatientsController {
  private patientService: PatientService;

  constructor() {
    this.patientService = new PatientService();
  }
  // Get all patients with optional search and pagination
  async getAllPatients(req: Request, res: Response) {
    try {
      const { 
        search, 
        page = 1, 
        limit = 25, 
        sortBy = 'createdAt', 
        sortOrder = 'desc' 
      } = req.query;
      
      const result = await this.patientService.getAllPatients(
        search as string,
        parseInt(page as string),
        parseInt(limit as string),
        sortBy as string,
        sortOrder as 'asc' | 'desc'
      );
      
      res.json(result);
    } catch (error) {
      console.error('Error fetching patients:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch patients' });
    }
  }

  // Get patient by ID
  async getPatientById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const patient = await this.patientService.getPatientById(id);
      
      res.json(patient);
    } catch (error) {
      console.error('Error fetching patient:', error);
      if (error instanceof Error && error.message === 'Patient not found') {
        res.status(404).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch patient' });
    }
  }

  // Create new patient
  async createPatient(req: Request, res: Response): Promise<void> {
    try {
      const patientData: PatientFormData = req.body;
      const patient = await this.patientService.createPatient(patientData);
      
      res.status(201).json(patient);
    } catch (error) {
      console.error('Error creating patient:', error);
      if (error instanceof Error && error.message.includes('already exists')) {
        res.status(400).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create patient' });
    }
  }

  // Update patient
  async updatePatient(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updateData: Partial<PatientFormData> = req.body;
      
      const patient = await this.patientService.updatePatient(id, updateData);
      
      res.json(patient);
    } catch (error) {
      console.error('Error updating patient:', error);
      if (error instanceof Error) {
        if (error.message === 'Patient not found') {
          res.status(404).json({ error: error.message });
          return;
        }
        if (error.message.includes('already exists')) {
          res.status(400).json({ error: error.message });
          return;
        }
      }
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to update patient' });
    }
  }

  // Delete patient
  async deletePatient(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const result = await this.patientService.deletePatient(id);
      
      res.json(result);
    } catch (error) {
      console.error('Error deleting patient:', error);
      if (error instanceof Error && error.message === 'Patient not found') {
        res.status(404).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to delete patient' });
    }
  }

  // Get recent patients
  async getRecentPatients(req: Request, res: Response) {
    try {
      const { limit = 10 } = req.query;
      
      const patients = await this.patientService.getRecentPatients(parseInt(limit as string));
      
      res.json({ patients });
    } catch (error) {
      console.error('Error fetching recent patients:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to fetch recent patients' });
    }
  }

  // Bulk delete patients
  async bulkDeletePatients(req: Request, res: Response): Promise<void> {
    try {
      const { patientIds } = req.body;
      
      const result = await this.patientService.bulkDeletePatients(patientIds);
      
      res.json(result);
    } catch (error) {
      console.error('Error bulk deleting patients:', error);
      if (error instanceof Error && error.message.includes('required')) {
        res.status(400).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to delete patients' });
    }
  }
}