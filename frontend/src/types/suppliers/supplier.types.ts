export type BusinessType = 'manufacturer' | 'distributor' | 'wholesaler' | 'retailer' | 'service_provider'

export interface Supplier {
  id: string
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
  businessType: BusinessType
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
    issuedDate: string
    expiryDate: string
    documentPath: string
  }>
  
  // Performance Metrics
  rating: number
  totalOrders: number
  totalSpent: number
  averageDeliveryTime: number
  lastOrderDate?: string
  
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
  
  // Timestamps
  createdAt: string
  updatedAt: string
}

export interface SupplierFormData {
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
  businessType?: BusinessType
  taxId?: string
  businessRegistrationNumber?: string
  paymentTerms?: 'immediate' | 'net_15' | 'net_30' | 'net_60' | 'net_90'
  creditLimit?: number
  minimumOrderValue?: number
  currency?: string
  notes?: string
  internalNotes?: string
  tags?: string[]
  status?: 'active' | 'inactive' | 'suspended' | 'pending_approval' | 'blacklisted'
  isActive?: boolean
  isPreferred?: boolean
  requiresApproval?: boolean
}

export interface SupplierListResponse {
  suppliers: Supplier[]
  pagination?: {
    total: number
    page: number
    limit: number
    pages: number
  }
}