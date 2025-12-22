// Migration utilities - DB connection disabled for frontend compilation
// import dbConnect from '@/lib/mongoose';

// Type definitions for medical history objects
interface MedicalHistory {
  appointments?: unknown[];
  prescriptions?: unknown[];
  customBlends?: unknown[];
}

interface PatientRecord {
  id: string;
  name: string;
  medicalHistory?: MedicalHistory;
  [key: string]: unknown;
}

// Stub functions for compilation
export const migratePatientData = async (_data: PatientRecord[]): Promise<void> => {
  throw new Error('Migration not available in frontend - use backend API')
}

export const validateMigrationData = (data: unknown[]): boolean => {
  return Array.isArray(data)
}