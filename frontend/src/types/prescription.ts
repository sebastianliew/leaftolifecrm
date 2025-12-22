export interface PrescriptionRemedy {
  id: string
  name: string
  dosage: string
  instructions: string
  frequency: string
  duration?: string
  notes?: string
}

export interface PrescriptionTiming {
  before: PrescriptionRemedy[]
  during: PrescriptionRemedy[]
  after: PrescriptionRemedy[]
}

export interface PrescriptionMeal {
  breakfast: PrescriptionTiming
  lunch: PrescriptionTiming
  dinner: PrescriptionTiming
}

export interface PrescriptionSpecialInstruction {
  id: string
  category: 'general' | 'dietary' | 'lifestyle' | 'supplement' | 'emergency'
  instruction: string
  timing?: string
  priority: 'low' | 'medium' | 'high'
}

export interface Prescription {
  id: string
  patientId: string
  patientName: string
  practitionerName: string
  practitionerCredentials: string
  date: string
  
  // Main remedy schedule
  dailySchedule: PrescriptionMeal
  
  // Special instructions and notes
  specialInstructions: PrescriptionSpecialInstruction[]
  
  // Dietary and lifestyle advice
  dietaryAdvice: string[]
  lifestyleAdvice: string[]
  
  // Status and tracking
  status: 'draft' | 'active' | 'completed' | 'cancelled'
  isActive: boolean
  
  // System fields
  createdAt: string
  updatedAt: string
  createdBy: string
  lastModifiedBy?: string
}

export type PrescriptionFormData = Omit<Prescription, 'id' | 'createdAt' | 'updatedAt'>

// Predefined remedy templates for quick selection
export interface RemedyTemplate {
  id: string
  name: string
  category: 'herb' | 'tincture' | 'supplement' | 'probiotic' | 'essential_oil' | 'other'
  defaultDosage: string
  commonInstructions: string[]
  contraindications?: string[]
  isActive: boolean
}

// Enhanced versioning interfaces
export interface PrescriptionChange {
  field: string
  oldValue: unknown
  newValue: unknown
  timestamp: string
  reason?: string
  changeType: 'added' | 'modified' | 'removed'
}

export interface VersionedPrescription extends Prescription {
  version: number
  prescriptionDate: string
  validFrom: string
  validUntil?: string
  parentId?: string
  previousVersionId?: string
  nextVersionId?: string
  changes: PrescriptionChange[]
  isCurrentVersion: boolean
}

export interface PrescriptionVersion {
  id: string
  version: number
  date: string
  prescription: Prescription
  changes: PrescriptionChange[]
  summary: string
}

export interface PrescriptionSchedule {
  prescriptionId: string
  scheduledDate: string
  autoActivate: boolean
  reminderSettings: {
    enabled: boolean
    daysBefore: number
    notificationMethod: 'email' | 'sms' | 'app'
  }
}

// For managing prescription history
export interface PrescriptionHistory {
  id: string
  prescriptionId: string
  patientId: string
  action: 'created' | 'modified' | 'activated' | 'completed' | 'cancelled'
  changes?: string
  performedBy: string
  performedAt: string
  notes?: string
} 