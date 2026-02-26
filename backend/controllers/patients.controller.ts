import { Request, Response } from 'express';
import { PatientService } from '../services/PatientService.js';
import { asyncHandler } from '../middlewares/errorHandler.middleware.js';
import type { PatientFormData } from '../types/patient.js';

const patientService = new PatientService();

export class PatientsController {
  getAllPatients = asyncHandler(async (req: Request, res: Response) => {
    const { search, page = '1', limit = '25', sortBy = 'createdAt', sortOrder = 'desc', status: statusFilter, tier: tierFilter } = req.query as Record<string, string>;
    res.json(await patientService.getAllPatients(search, parseInt(page), parseInt(limit), sortBy, sortOrder as 'asc' | 'desc', statusFilter, tierFilter));
  });

  getPatientById = asyncHandler(async (req: Request, res: Response) => {
    res.json(await patientService.getPatientById(req.params.id));
  });

  createPatient = asyncHandler(async (req: Request, res: Response) => {
    res.status(201).json(await patientService.createPatient(req.body as PatientFormData));
  });

  updatePatient = asyncHandler(async (req: Request, res: Response) => {
    res.json(await patientService.updatePatient(req.params.id, req.body as Partial<PatientFormData>));
  });

  deletePatient = asyncHandler(async (req: Request, res: Response) => {
    res.json(await patientService.deletePatient(req.params.id));
  });

  getPatientSummary = asyncHandler(async (req: Request, res: Response) => {
    res.json(await patientService.getPatientSummary(req.params.id));
  });

  getRecentPatients = asyncHandler(async (req: Request, res: Response) => {
    const { limit = '10' } = req.query as Record<string, string>;
    res.json({ patients: await patientService.getRecentPatients(parseInt(limit)) });
  });

  bulkDeletePatients = asyncHandler(async (req: Request, res: Response) => {
    res.json(await patientService.bulkDeletePatients(req.body.patientIds));
  });

  getPatientStats = asyncHandler(async (req: Request, res: Response) => {
    res.json(await patientService.getPatientStats());
  });
}
