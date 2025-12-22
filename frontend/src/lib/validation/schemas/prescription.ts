import { z } from 'zod'
import { commonSchemas, baseEntitySchema } from './index'

// Prescription item schema
export const prescriptionItemSchema = z.object({
  productId: commonSchemas.mongoId,
  productName: z.string().min(1),
  dosage: z.string().min(1, 'Dosage is required').trim(),
  frequency: z.string().min(1, 'Frequency is required').trim(),
  duration: z.string().min(1, 'Duration is required').trim(),
  quantity: commonSchemas.positiveNumber,
  instructions: z.string().trim().optional(),
  refills: commonSchemas.nonNegativeNumber.int().default(0)
})

// Prescription base schema (without refinement)
const prescriptionBaseSchema = baseEntitySchema.extend({
  prescriptionNumber: z.string()
    .regex(/^RX-\d{6}-\d{4}$/, 'Invalid prescription number format'),
    
  // Patient information
  patientId: commonSchemas.mongoId,
  patientName: z.string().min(1),
  patientPhone: z.string(),
  
  // Doctor information
  doctorName: z.string().min(1, 'Doctor name is required').trim(),
  doctorLicense: z.string().min(1, 'Doctor license is required').trim(),
  doctorPhone: z.string().optional(),
  clinic: z.string().trim().optional(),
  
  // Prescription details
  items: z.array(prescriptionItemSchema)
    .min(1, 'At least one medication is required'),
    
  diagnosis: z.string().trim().optional(),
  notes: z.string().max(1000).trim().optional(),
  
  // Status and validity
  status: z.enum(['active', 'filled', 'partial', 'expired', 'cancelled']),
  issuedDate: z.string().datetime().or(z.date()),
  expiryDate: z.string().datetime().or(z.date()),
  
  // Filling information
  filledItems: z.array(z.object({
    itemIndex: z.number().int().nonnegative(),
    quantityFilled: commonSchemas.positiveNumber,
    filledDate: z.string().datetime().or(z.date()),
    filledBy: z.string(),
    transactionId: commonSchemas.mongoId.optional()
  })).default([]),
  
  // Control substance information
  isControlled: z.boolean().default(false),
  controlSchedule: z.enum(['I', 'II', 'III', 'IV', 'V']).optional(),
  
  // Verification
  isVerified: z.boolean().default(false),
  verifiedBy: z.string().optional(),
  verifiedAt: z.string().datetime().optional()
})

// Prescription schema with refinement
export const prescriptionSchema = prescriptionBaseSchema.refine(
  (data) => {
    // Expiry date must be after issued date
    const issued = new Date(data.issuedDate)
    const expiry = new Date(data.expiryDate)
    return expiry > issued
  },
  {
    message: 'Expiry date must be after issued date',
    path: ['expiryDate']
  }
)

// Prescription create schema
export const createPrescriptionSchema = prescriptionBaseSchema.omit({ 
  _id: true, 
  createdAt: true, 
  updatedAt: true,
  filledItems: true,
  isVerified: true,
  verifiedBy: true,
  verifiedAt: true
}).refine(
  (data) => {
    // Expiry date must be after issued date
    const issued = new Date(data.issuedDate)
    const expiry = new Date(data.expiryDate)
    return expiry > issued
  },
  {
    message: 'Expiry date must be after issued date',
    path: ['expiryDate']
  }
)

// Prescription verification schema
export const verifyPrescriptionSchema = z.object({
  isVerified: z.boolean(),
  verifiedBy: z.string().min(1),
  notes: z.string().optional()
})

// Fill prescription schema
export const fillPrescriptionSchema = z.object({
  items: z.array(z.object({
    itemIndex: z.number().int().nonnegative(),
    quantityToFill: commonSchemas.positiveNumber
  })).min(1),
  transactionId: commonSchemas.mongoId.optional()
})

// Prescription search schema
export const prescriptionSearchSchema = z.object({
  prescriptionNumber: z.string().optional(),
  patientId: commonSchemas.mongoId.optional(),
  patientName: z.string().trim().optional(),
  doctorName: z.string().trim().optional(),
  status: prescriptionBaseSchema.shape.status.optional(),
  isControlled: z.boolean().optional(),
  isVerified: z.boolean().optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional()
})

// Type exports
export type Prescription = z.infer<typeof prescriptionSchema>
export type PrescriptionItem = z.infer<typeof prescriptionItemSchema>
export type CreatePrescriptionInput = z.infer<typeof createPrescriptionSchema>
export type VerifyPrescriptionInput = z.infer<typeof verifyPrescriptionSchema>
export type FillPrescriptionInput = z.infer<typeof fillPrescriptionSchema>
export type PrescriptionSearchInput = z.infer<typeof prescriptionSearchSchema>