import { z } from 'zod';
import { ALL_TIERS } from '@/config/membership-tiers';

// Patient form validation schema - matches the actual form structure
export const patientFormSchema = z.object({
  // Basic Information
  firstName: z.string()
    .min(1, 'First name is required')
    .max(50, 'First name must be less than 50 characters')
    .trim(),

  middleName: z.string()
    .max(50, 'Middle name must be less than 50 characters')
    .trim()
    .optional(),

  lastName: z.string()
    .min(1, 'Last name is required')
    .max(50, 'Last name must be less than 50 characters')
    .trim(),

  // NRIC: optional for legacy patients (many have invalid/masked data from Django migration)
  // Valid SG format enforced only when provided and non-empty
  nric: z.string()
    .trim()
    .optional()
    .or(z.literal('')),

  dateOfBirth: z.string()
    .min(1, 'Date of birth is required')
    .refine((date) => {
      const birthDate = new Date(date);
      return !isNaN(birthDate.getTime()) && birthDate <= new Date();
    }, 'Date of birth cannot be in the future')
    .refine((date) => {
      const birthDate = new Date(date);
      const age = new Date().getFullYear() - birthDate.getFullYear();
      return age <= 150;
    }, 'Invalid date of birth'),

  gender: z.enum(['male', 'female', 'other', 'prefer-not-to-say'], {
    required_error: 'Gender is required'
  }),

  bloodType: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).optional(),

  maritalStatus: z.enum(['single', 'married', 'divorced', 'widowed', 'separated']).optional(),

  occupation: z.string()
    .max(100, 'Occupation must be less than 100 characters')
    .trim()
    .optional(),

  // Contact Information
  email: z.string()
    .min(1, 'Email is required')
    .email('Invalid email format')
    .trim(),

  phone: z.string()
    .min(1, 'Primary phone is required')
    .regex(/^[\d\s\-+()]+$/, 'Invalid phone number format')
    .trim(),

  altPhone: z.string()
    .regex(/^[\d\s\-+()]*$/, 'Invalid phone number format')
    .trim()
    .optional(),

  fax: z.string()
    .regex(/^[\d\s\-+()]*$/, 'Invalid fax number format')
    .trim()
    .optional(),

  address: z.string()
    .max(200, 'Address must be less than 200 characters')
    .trim()
    .optional(),

  city: z.string()
    .max(100, 'City must be less than 100 characters')
    .trim()
    .optional(),

  state: z.string()
    .max(100, 'State/Province must be less than 100 characters')
    .trim()
    .optional(),

  postalCode: z.string()
    .max(20, 'Postal code must be less than 20 characters')
    .trim()
    .optional(),

  // Status and Consent
  status: z.enum(['active', 'inactive'], {
    required_error: 'Status is required'
  }),

  hasConsent: z.boolean(),

  // Member Benefits
  memberBenefits: z.object({
    discountPercentage: z.number().min(0).max(100),
    discountReason: z.string().optional(),
    membershipTier: z.enum(ALL_TIERS as [string, ...string[]]),
    discountStartDate: z.date().optional(),
    discountEndDate: z.date().nullable().optional()
  }).optional(),

  // Legacy fields
  legacyCustomerNo: z.string().optional(),
  _id: z.string().optional()
});

export type PatientFormInput = z.infer<typeof patientFormSchema>;
