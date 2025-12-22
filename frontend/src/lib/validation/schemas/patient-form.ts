import { z } from 'zod';

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

  nric: z.string()
    .min(1, 'NRIC is required')
    .length(9, 'NRIC must be exactly 9 characters')
    .trim()
    .regex(/^[STFG]\d{7}[A-Z]$/, 'NRIC must be in format: S/T/F/G followed by 7 digits and 1 letter')
    .refine((nric) => {
      // Singapore NRIC checksum validation
      const prefix = nric.charAt(0);
      const digits = nric.substring(1, 8);
      const checkLetter = nric.charAt(8);
      
      // Weights for each digit position
      const weights = [2, 7, 6, 5, 4, 3, 2];
      
      // Calculate weighted sum
      let sum = 0;
      for (let i = 0; i < 7; i++) {
        sum += parseInt(digits.charAt(i)) * weights[i];
      }
      
      // Different lookup tables for different prefix types
      const checkLetters = {
        'S': ['J', 'Z', 'I', 'H', 'G', 'F', 'E', 'D', 'C', 'B', 'A'],
        'T': ['G', 'F', 'E', 'D', 'C', 'B', 'A', 'J', 'Z', 'I', 'H'],
        'F': ['X', 'W', 'U', 'T', 'R', 'Q', 'P', 'N', 'M', 'L', 'K'],
        'G': ['R', 'Q', 'P', 'N', 'M', 'L', 'K', 'X', 'W', 'U', 'T']
      };
      
      const remainder = sum % 11;
      const expectedLetter = checkLetters[prefix as keyof typeof checkLetters][remainder];
      
      return checkLetter === expectedLetter;
    }, 'Invalid NRIC - checksum does not match'),

  dateOfBirth: z.string()
    .min(1, 'Date of birth is required')
    .refine((date) => {
      const birthDate = new Date(date);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      return age >= 0 && age <= 150;
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
    membershipTier: z.enum(['standard', 'silver', 'vip', 'platinum']),
    discountStartDate: z.date().optional(),
    discountEndDate: z.date().nullable().optional()
  }).optional(),

  // Legacy fields
  legacyCustomerNo: z.string().optional(),
  _id: z.string().optional()
});

export type PatientFormInput = z.infer<typeof patientFormSchema>;
