import { z } from 'zod'

// Common validation patterns
export const patterns = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^[\d\s\-+()]+$/,
  alphanumeric: /^[a-zA-Z0-9]+$/,
  noSpecialChars: /^[a-zA-Z0-9\s]+$/,
  url: /^https?:\/\/.+/,
  mongoId: /^[0-9a-fA-F]{24}$/
}

// Common field schemas
export const commonSchemas = {
  email: z.string()
    .min(1, 'Email is required')
    .email('Invalid email format')
    .toLowerCase()
    .trim(),
    
  phone: z.string()
    .min(1, 'Phone number is required')
    .regex(patterns.phone, 'Invalid phone number format')
    .transform(val => val.replace(/\D/g, '')), // Remove non-digits
    
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
    
  mongoId: z.string()
    .regex(patterns.mongoId, 'Invalid ID format'),
    
  url: z.string()
    .url('Invalid URL format')
    .regex(patterns.url, 'URL must start with http:// or https://'),
    
  positiveNumber: z.number()
    .positive('Must be a positive number')
    .finite('Must be a finite number'),
    
  nonNegativeNumber: z.number()
    .nonnegative('Must be zero or positive')
    .finite('Must be a finite number'),
    
  currency: z.number()
    .nonnegative('Amount cannot be negative')
    .multipleOf(0.01, 'Amount must have at most 2 decimal places')
    .finite('Must be a valid amount'),
    
  percentage: z.number()
    .min(0, 'Percentage must be between 0 and 100')
    .max(100, 'Percentage must be between 0 and 100'),
    
  date: z.string()
    .datetime('Invalid date format')
    .or(z.date()),
    
  optionalString: z.string().trim().optional().or(z.literal('')),
  
  sanitizedString: z.string()
    .trim()
    .transform(val => val.replace(/<[^>]*>/g, '')) // Remove HTML tags
}

// Address schema
export const addressSchema = z.object({
  street: z.string().min(1, 'Street address is required').trim(),
  city: z.string().min(1, 'City is required').trim(),
  state: z.string().min(2, 'State is required').max(2, 'Use 2-letter state code'),
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code format'),
  country: z.string().default('US')
})

// Pagination schema
export const paginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(10),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
})

// Search query schema
export const searchQuerySchema = z.object({
  q: z.string().trim().optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
  ...paginationSchema.shape
})

// Base schemas for common entities
export const timestampSchema = z.object({
  createdAt: z.date().or(z.string().datetime()),
  updatedAt: z.date().or(z.string().datetime())
})

export const baseEntitySchema = z.object({
  _id: commonSchemas.mongoId.optional(),
  ...timestampSchema.shape
})

// Utility functions
export function validateSchema<T>(schema: z.ZodSchema<T>, data: unknown): {
  success: boolean
  data?: T
  errors?: z.ZodError
} {
  try {
    const validated = schema.parse(data)
    return { success: true, data: validated }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, errors: error }
    }
    throw error
  }
}

export function getErrorMessages(error: z.ZodError): Record<string, string> {
  const messages: Record<string, string> = {}
  
  error.issues.forEach(err => {
    const path = err.path.join('.')
    messages[path] = err.message
  })
  
  return messages
}

// Note: Individual schema files are imported directly to avoid circular dependencies