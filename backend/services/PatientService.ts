import { Patient } from '../models/Patient.js';
import type { PatientFormData, Patient as PatientType } from '../types/patient.js';

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
      // Validate ID before querying to prevent Mongoose CastError
      if (!id || id === 'undefined' || id === 'null') {
        throw new Error('Patient not found');
      }
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
      // Strip _id and id from input data to prevent MongoDB casting errors
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _id: _unusedId, id: _unusedIdAlias, ...cleanPatientData } = patientData as PatientFormData & { _id?: string; id?: string };

      // Normalize email and NRIC
      const normalizedEmail = cleanPatientData.email?.trim().toLowerCase();
      const normalizedNric = cleanPatientData.nric?.trim().toUpperCase();

      // Treat empty strings as "no value"
      const hasEmail = normalizedEmail && normalizedEmail.length > 0;
      const hasNric = normalizedNric && normalizedNric.length > 0;

      // Check for duplicate NRIC only (email duplicates are allowed)
      if (hasNric) {
        const existingPatient = await Patient.findOne({ nric: normalizedNric });
        if (existingPatient) {
          throw new Error('Patient with this NRIC already exists');
        }
      }

      // Normalize the data being saved for consistency
      if (hasEmail) {
        cleanPatientData.email = normalizedEmail;
      }
      if (hasNric) {
        cleanPatientData.nric = normalizedNric;
      }

      const patient = new Patient(cleanPatientData);
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
      // Validate ID before querying to prevent Mongoose CastError
      if (!id || id === 'undefined' || id === 'null') {
        throw new Error('Patient not found');
      }
      // First, get the current patient to compare values
      const currentPatient = await Patient.findById(id).lean() as PatientType | null;
      if (!currentPatient) {
        throw new Error('Patient not found');
      }

      // Normalize email and NRIC for comparison
      const normalizedEmail = updateData.email?.trim().toLowerCase();
      const normalizedNric = updateData.nric?.trim().toUpperCase();
      const currentNric = currentPatient.nric?.trim().toUpperCase();

      // Treat empty strings as "no value"
      const hasEmail = normalizedEmail && normalizedEmail.length > 0;
      const hasNric = normalizedNric && normalizedNric.length > 0;

      // Only check for NRIC duplicates if the value is CHANGING to a new value
      const nricIsChanging = hasNric && normalizedNric !== currentNric;

      // Check if trying to update NRIC to existing value (owned by another patient)
      if (nricIsChanging) {
        const existingPatient = await Patient.findOne({
          _id: { $ne: id },
          nric: normalizedNric
        });

        if (existingPatient) {
          throw new Error('Patient with this NRIC already exists');
        }
      }

      // Normalize the data being saved for consistency
      if (hasEmail && updateData.email) {
        updateData.email = normalizedEmail;
      }
      if (hasNric && updateData.nric) {
        updateData.nric = normalizedNric;
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
      // Validate ID before querying to prevent Mongoose CastError
      if (!id || id === 'undefined' || id === 'null') {
        throw new Error('Patient not found');
      }
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