import { Patient } from '../models/Patient.js';
import type { PatientFormData } from '../types/patient.js';

export class PatientService {
  // Get all patients with search and pagination
  async getAllPatients(searchTerm?: string, page: number = 1, limit: number = 25, sortBy: string = 'createdAt', sortOrder: 'asc' | 'desc' = 'desc') {
    try {
      interface PatientQuery {
        $or?: Array<{
          firstName?: RegExp;
          lastName?: RegExp;
          email?: RegExp;
          phone?: RegExp;
          nric?: RegExp;
          legacyCustomerNo?: RegExp;
        }>;
      }
      
      let query: PatientQuery = {};
      
      // Add search functionality
      if (searchTerm && searchTerm.trim().length >= 2) {
        const searchRegex = new RegExp(searchTerm.trim(), 'i');
        query = {
          $or: [
            { firstName: searchRegex },
            { lastName: searchRegex },
            { email: searchRegex },
            { phone: searchRegex },
            { nric: searchRegex },
            { legacyCustomerNo: searchRegex }
          ]
        };
      }
      
      const sortOptions: Record<string, 1 | -1> = {};
      sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;
      
      // Calculate skip for pagination
      const skip = (page - 1) * limit;
      
      // Get total count for pagination info
      const totalCount = await Patient.countDocuments(query);
      
      // Get patients with pagination
      const patients = await Patient.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .lean();
      
      // Calculate pagination metadata
      const totalPages = Math.ceil(totalCount / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;
      
      return {
        patients,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          limit,
          hasNextPage,
          hasPrevPage,
          nextPage: hasNextPage ? page + 1 : null,
          prevPage: hasPrevPage ? page - 1 : null
        }
      };
    } catch (error) {
      console.error('Error in PatientService.getAllPatients:', error);
      throw new Error('Failed to fetch patients');
    }
  }

  // Get patient by ID
  async getPatientById(id: string) {
    try {
      const patient = await Patient.findById(id).lean();
      
      if (!patient) {
        throw new Error('Patient not found');
      }
      
      return patient;
    } catch (error) {
      console.error('Error in PatientService.getPatientById:', error);
      throw error;
    }
  }

  // Create new patient
  async createPatient(patientData: PatientFormData) {
    try {
      // Check for duplicate email or NRIC
      const existingPatient = await Patient.findOne({
        $or: [
          { email: patientData.email },
          ...(patientData.nric ? [{ nric: patientData.nric }] : [])
        ]
      });
      
      if (existingPatient) {
        throw new Error('Patient with this email or NRIC already exists');
      }
      
      const patient = new Patient(patientData);
      const savedPatient = await patient.save();
      
      return savedPatient.toJSON();
    } catch (error) {
      console.error('Error in PatientService.createPatient:', error);
      throw error;
    }
  }

  // Update patient
  async updatePatient(id: string, updateData: Partial<PatientFormData>) {
    try {
      // Check if trying to update email/NRIC to existing value
      if (updateData.email || updateData.nric) {
        const existingPatient = await Patient.findOne({
          _id: { $ne: id },
          $or: [
            ...(updateData.email ? [{ email: updateData.email }] : []),
            ...(updateData.nric ? [{ nric: updateData.nric }] : [])
          ]
        });
        
        if (existingPatient) {
          throw new Error('Patient with this email or NRIC already exists');
        }
      }
      
      const patient = await Patient.findByIdAndUpdate(
        id,
        updateData,
        { new: true, runValidators: true }
      ).lean();
      
      if (!patient) {
        throw new Error('Patient not found');
      }
      
      return patient;
    } catch (error) {
      console.error('Error in PatientService.updatePatient:', error);
      throw error;
    }
  }

  // Delete patient
  async deletePatient(id: string) {
    try {
      const patient = await Patient.findByIdAndDelete(id);
      
      if (!patient) {
        throw new Error('Patient not found');
      }
      
      return { message: 'Patient deleted successfully' };
    } catch (error) {
      console.error('Error in PatientService.deletePatient:', error);
      throw error;
    }
  }

  // Get recent patients
  async getRecentPatients(limit: number = 10) {
    try {
      const patients = await Patient.find()
        .sort({ updatedAt: -1 })
        .limit(limit)
        .lean();
      
      return patients;
    } catch (error) {
      console.error('Error in PatientService.getRecentPatients:', error);
      throw new Error('Failed to fetch recent patients');
    }
  }

  // Bulk delete patients
  async bulkDeletePatients(patientIds: string[]) {
    try {
      if (!Array.isArray(patientIds) || patientIds.length === 0) {
        throw new Error('Patient IDs array is required');
      }
      
      const result = await Patient.deleteMany({
        _id: { $in: patientIds }
      });
      
      return {
        message: `${result.deletedCount} patients deleted successfully`,
        deletedCount: result.deletedCount
      };
    } catch (error) {
      console.error('Error in PatientService.bulkDeletePatients:', error);
      throw error;
    }
  }

  // Search patients
  async searchPatients(searchTerm: string, limit: number = 50) {
    try {
      if (searchTerm.length < 2) {
        return [];
      }

      const searchRegex = new RegExp(searchTerm.trim(), 'i');
      const patients = await Patient.find({
        $or: [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { email: searchRegex },
          { phone: searchRegex },
          { nric: searchRegex },
          { legacyCustomerNo: searchRegex }
        ]
      })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean();

      return patients;
    } catch (error) {
      console.error('Error in PatientService.searchPatients:', error);
      throw new Error('Failed to search patients');
    }
  }

  // Get patient statistics
  async getPatientStats() {
    try {
      const totalPatients = await Patient.countDocuments();
      const activePatients = await Patient.countDocuments({ status: 'active' });
      const inactivePatients = await Patient.countDocuments({ status: 'inactive' });
      const withConsent = await Patient.countDocuments({ hasConsent: true });
      
      // Get recent registrations (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentRegistrations = await Patient.countDocuments({
        createdAt: { $gte: thirtyDaysAgo }
      });

      return {
        totalPatients,
        activePatients,
        inactivePatients,
        withConsent,
        recentRegistrations
      };
    } catch (error) {
      console.error('Error in PatientService.getPatientStats:', error);
      throw new Error('Failed to fetch patient statistics');
    }
  }
}