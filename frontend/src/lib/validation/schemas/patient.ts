import { z } from 'zod'
import { commonSchemas, addressSchema, baseEntitySchema } from './index'

// Medical history schema
export const medicalHistorySchema = z.object({
  conditions: z.array(z.string().trim()).default([]),
  allergies: z.array(z.string().trim()).default([]),
  medications: z.array(z.string().trim()).default([]),
  notes: z.string().trim().optional()
})

// Patient schema
export const patientSchema = baseEntitySchema.extend({
  name: z.string()
    .min(1, 'Patient name is required')
    .max(100, 'Name is too long')
    .trim(),
    
  email: commonSchemas.email.optional(),
  
  phone: commonSchemas.phone,
  
  dateOfBirth: z.string()
    .datetime()
    .or(z.date())
    .refine((date) => {
      const age = new Date().getFullYear() - new Date(date).getFullYear()
      return age >= 0 && age <= 150
    }, 'Invalid date of birth'),
    
  registrationNumber: z.string()
    .min(1, 'Registration number is required')
    .regex(/^[A-Z0-9-]+$/, 'Invalid registration number format')
    .trim(),
    
  address: addressSchema.optional(),
  
  medicalHistory: medicalHistorySchema.optional(),
  
  emergencyContact: z.object({
    name: z.string().trim().optional(),
    phone: commonSchemas.phone.optional(),
    relationship: z.string().trim().optional()
  }).optional(),
  
  isActive: z.boolean().default(true),
  
  notes: z.string().max(1000, 'Notes too long').trim().optional()
})

// Patient create/update schemas
export const createPatientSchema = patientSchema.omit({ 
  _id: true, 
  createdAt: true, 
  updatedAt: true 
})

export const updatePatientSchema = createPatientSchema.partial()

// Patient search schema
export const patientSearchSchema = z.object({
  name: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  registrationNumber: z.string().trim().optional(),
  email: z.string().email().optional(),
  isActive: z.boolean().optional()
})

// Type exports
export type Patient = z.infer<typeof patientSchema>
export type CreatePatientInput = z.infer<typeof createPatientSchema>
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>
export type PatientSearchInput = z.infer<typeof patientSearchSchema>