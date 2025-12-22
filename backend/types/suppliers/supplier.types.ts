import { Document } from 'mongoose'

export interface ISupplier extends Document {
  // Basic Information
  name: string
  code?: string
  description?: string
  
  // Contact Information
  email?: string
  phone?: string
  fax?: string
  website?: string
  contactPerson?: string
  
  // Address Information
  address?: string
  city?: string
  state?: string
  postalCode?: string
  country?: string
  
  // Business Information
  businessType: 'manufacturer' | 'distributor' | 'wholesaler' | 'retailer' | 'service_provider'
  taxId?: string
  businessRegistrationNumber?: string
  
  // Terms and Conditions
  paymentTerms: 'immediate' | 'net_15' | 'net_30' | 'net_60' | 'net_90'
  creditLimit: number
  minimumOrderValue: number
  currency: string
  
  // Categories and Products
  categories: Array<{
    categoryId: string
    categoryName: string
  }>
  productCount: number
  
  // Quality and Certifications
  qualityStandards: Array<{
    name: string
    certificateNumber: string
    issuedDate: Date
    expiryDate: Date
    documentPath: string
  }>
  
  // Performance Metrics
  rating: number
  totalOrders: number
  totalSpent: number
  averageDeliveryTime: number
  lastOrderDate?: Date
  
  // Status and Flags
  status: 'active' | 'inactive' | 'suspended' | 'pending_approval' | 'blacklisted'
  isActive: boolean
  isPreferred: boolean
  requiresApproval: boolean
  
  // Notes
  notes?: string
  internalNotes?: string
  
  // System Fields
  createdBy: string
  lastModifiedBy?: string
  tags: string[]
  
  // Migration support fields
  legacyId?: string
  migrationData?: {
    source?: string
    importedAt?: Date
    originalData?: Map<string, unknown>
  }
  
  // Timestamps
  createdAt: Date
  updatedAt: Date
  
  // Methods
  updateMetrics(orderValue: number, deliveryDays: number): Promise<void>
}

export interface SupplierCreateRequest {
  name: string
  code?: string
  description?: string
  email?: string
  phone?: string
  fax?: string
  website?: string
  contactPerson?: string
  address?: string
  city?: string
  state?: string
  postalCode?: string
  country?: string
  businessType?: 'manufacturer' | 'distributor' | 'wholesaler' | 'retailer' | 'service_provider'
  taxId?: string
  businessRegistrationNumber?: string
  paymentTerms?: 'immediate' | 'net_15' | 'net_30' | 'net_60' | 'net_90'
  creditLimit?: number
  minimumOrderValue?: number
  currency?: string
  notes?: string
  internalNotes?: string
  tags?: string[]
  isPreferred?: boolean
  requiresApproval?: boolean
}

export interface SupplierUpdateRequest extends Partial<SupplierCreateRequest> {
  lastModifiedBy?: string
}

export interface SupplierQueryParams {
  page?: string
  limit?: string
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  status?: string
  businessType?: string
  isPreferred?: string
  requiresApproval?: string
}