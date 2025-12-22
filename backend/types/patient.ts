export interface Patient {
  id: string
  _id?: string // MongoDB ID for compatibility
  // Basic Information
  firstName: string
  middleName?: string
  lastName: string
  name?: string // Combined name for backward compatibility
  nric: string
  dateOfBirth: string
  gender: "male" | "female" | "other" | "prefer-not-to-say"
  bloodType?: "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-"
  maritalStatus?: "single" | "married" | "divorced" | "widowed" | "separated"
  occupation?: string

  // Contact Information
  email: string
  phone: string
  altPhone?: string
  fax?: string
  address?: string
  city?: string
  state?: string
  postalCode?: string

  // Status and Consent
  status: "active" | "inactive"
  hasConsent: boolean

  // Member Benefits
  memberBenefits?: {
    discountPercentage: number
    discountReason?: string
    membershipTier: 'standard' | 'silver' | 'vip' | 'platinum'
    discountStartDate?: Date
    discountEndDate?: Date | null
  }

  // Legacy system integration
  legacyCustomerNo?: string
  patientId?: string // Alternative patient ID field
  
  // System fields
  createdAt: string
  updatedAt: string
}

export interface PatientAllergy {
  id: string
  allergen: string
  severity: "mild" | "moderate" | "severe" | "life-threatening"
  reaction?: string
  notes?: string
}

export interface PatientPreference {
  id: string
  item: string
  preference: "like" | "dislike" | "neutral"
  category?: string
  notes?: string
}

export type PatientFormData = Omit<Patient, "id" | "createdAt" | "updatedAt">

export interface PatientNotification {
  id: string
  patientId: string
  type: "appointment" | "medication" | "allergy" | "general"
  title: string
  message: string
  priority: "low" | "medium" | "high" | "urgent"
  read: boolean
  createdAt: string
}