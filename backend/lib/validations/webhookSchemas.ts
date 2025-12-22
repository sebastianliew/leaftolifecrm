import { z } from 'zod';

// Phone number validation schema
export const phoneSchema = z.string()
  .min(1, 'Phone number is required')
  .regex(/^[+\d\s()-]+$/, 'Invalid phone number format')
  .transform((val) => val.replace(/[^\d+]/g, '')) // Remove formatting
  .refine((val) => val.length >= 8 && val.length <= 20, {
    message: 'Phone number must be between 8 and 20 digits'
  });

// Date of birth validation schema
export const dateOfBirthSchema = z.string()
  .min(1, 'Date of birth is required')
  .refine((val) => {
    const date = new Date(val);
    const now = new Date();
    const minDate = new Date(now.getFullYear() - 120, 0, 1); // 120 years ago
    const maxDate = new Date(now.getFullYear() - 1, 11, 31); // 1 year ago
    
    return !isNaN(date.getTime()) && date >= minDate && date <= maxDate;
  }, {
    message: 'Invalid date of birth (must be between 1 and 120 years ago)'
  })
  .transform((val) => new Date(val).toISOString().split('T')[0]); // Convert to YYYY-MM-DD string format

// Gender validation schema
export const genderSchema = z.string()
  .min(1, 'Gender is required')
  .transform((val) => {
    const normalized = val.toLowerCase().trim();
    if (['male', 'm', 'man'].includes(normalized)) return 'male';
    if (['female', 'f', 'woman'].includes(normalized)) return 'female';
    if (['other', 'non-binary', 'nb'].includes(normalized)) return 'other';
    return 'prefer-not-to-say';
  })
  .pipe(z.enum(['male', 'female', 'other', 'prefer-not-to-say']));

// Blood type validation schema
export const bloodTypeSchema = z.string()
  .optional()
  .transform((val) => {
    if (!val) return undefined;
    const normalized = val.toUpperCase().replace(/\s/g, '');
    const validTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
    return validTypes.includes(normalized) ? normalized : undefined;
  })
  .pipe(z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).optional());

// Marital status validation schema
export const maritalStatusSchema = z.string()
  .optional()
  .transform((val) => {
    if (!val) return undefined;
    const normalized = val.toLowerCase().trim();
    const statusMap: Record<string, 'single' | 'married' | 'divorced' | 'widowed' | 'separated'> = {
      'single': 'single',
      'unmarried': 'single',
      'never married': 'single',
      'married': 'married',
      'wed': 'married',
      'divorced': 'divorced',
      'widowed': 'widowed',
      'widow': 'widowed',
      'widower': 'widowed',
      'separated': 'separated'
    };
    return statusMap[normalized];
  })
  .pipe(z.enum(['single', 'married', 'divorced', 'widowed', 'separated']).optional());

// NRIC validation schema (Singapore/Malaysia format)
export const nricSchema = z.string()
  .optional()
  .refine((val) => {
    if (!val) return true;
    // Singapore NRIC format: S/T + 7 digits + letter
    // Malaysia IC format: 6 digits + 2 digits + 4 digits
    const singaporeNRIC = /^[STFG]\d{7}[A-Z]$/i;
    const malaysiaIC = /^\d{6}-?\d{2}-?\d{4}$/;
    return singaporeNRIC.test(val) || malaysiaIC.test(val);
  }, {
    message: 'Invalid NRIC/IC format'
  });

// Webhook patient data validation schema
export const webhookPatientDataSchema = z.object({
  // Required fields
  firstName: z.string()
    .min(1, 'First name is required')
    .max(100, 'First name must be less than 100 characters')
    .transform((val) => val.trim()),
  
  lastName: z.string()
    .min(1, 'Last name is required')
    .max(100, 'Last name must be less than 100 characters')
    .transform((val) => val.trim()),
  
  email: z.string()
    .min(1, 'Email is required')
    .email('Invalid email format')
    .max(255, 'Email must be less than 255 characters')
    .transform((val) => val.toLowerCase().trim()),
  
  phone: phoneSchema,
  
  dateOfBirth: dateOfBirthSchema,
  
  gender: genderSchema,
  
  // Optional fields
  middleName: z.string()
    .max(100, 'Middle name must be less than 100 characters')
    .optional()
    .transform((val) => val?.trim()),
  
  nric: nricSchema,
  
  bloodType: bloodTypeSchema,
  
  maritalStatus: maritalStatusSchema,
  
  occupation: z.string()
    .max(200, 'Occupation must be less than 200 characters')
    .optional()
    .transform((val) => val?.trim()),
  
  altPhone: z.string()
    .optional()
    .refine((val) => {
      if (!val) return true;
      const cleaned = val.replace(/[^\d+]/g, '');
      return cleaned.length >= 8 && cleaned.length <= 20;
    }, {
      message: 'Invalid alternative phone number format'
    })
    .transform((val) => val?.replace(/[^\d+]/g, '')),
  
  fax: z.string()
    .max(50, 'Fax number must be less than 50 characters')
    .optional()
    .transform((val) => val?.trim()),
  
  address: z.string()
    .max(500, 'Address must be less than 500 characters')
    .optional()
    .transform((val) => val?.trim()),
  
  city: z.string()
    .max(100, 'City must be less than 100 characters')
    .optional()
    .transform((val) => val?.trim()),
  
  state: z.string()
    .max(100, 'State must be less than 100 characters')
    .optional()
    .transform((val) => val?.trim()),
  
  postalCode: z.string()
    .max(20, 'Postal code must be less than 20 characters')
    .optional()
    .refine((val) => {
      if (!val) return true;
      // Allow various postal code formats
      return /^[\d\w\s-]{3,20}$/i.test(val);
    }, {
      message: 'Invalid postal code format'
    })
    .transform((val) => val?.trim()),
  
  // Webhook metadata (automatically added, but validated for security)
  webhookSource: z.literal('fluent-forms'),
  webhookFormId: z.string().min(1, 'Webhook form ID is required'),
  webhookSubmissionId: z.string().optional(),
  webhookTimestamp: z.string().default(() => new Date().toISOString())
});

// Fluent Forms webhook payload validation schema
export const fluentFormWebhookPayloadSchema = z.object({
  // Form metadata
  form_id: z.union([z.string(), z.number()]).transform(String),
  serial_number: z.string().optional(),
  source_url: z.string().url().optional().or(z.literal('')),
  user_id: z.union([z.string(), z.number()]).optional().transform((val) => val?.toString()),
  browser: z.string().optional(),
  device: z.string().optional(),
  ip: z.string().regex(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/, 'Invalid IP address').optional().or(z.literal('')),
  created_at: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/, 'Invalid datetime format').optional().or(z.literal('')),
  updated_at: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/, 'Invalid datetime format').optional().or(z.literal('')),
  
  // Form response data - flexible structure
  response: z.record(z.string(), z.unknown()).optional(),
  
  // Allow additional fields for flexibility
}).catchall(z.unknown()).refine((data) => {
  // Must have either response object or direct field data
  return data.response || Object.keys(data).some(key => !['form_id', 'serial_number', 'source_url', 'user_id', 'browser', 'device', 'ip', 'created_at', 'updated_at'].includes(key));
}, {
  message: 'Webhook payload must contain form response data'
});

// Webhook security validation schema
export const webhookSecuritySchema = z.object({
  ip: z.string().regex(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/, 'Invalid IP address'),
  userAgent: z.string().optional(),
  signature: z.string().optional(),
  timestamp: z.date().default(() => new Date()),
  secretKey: z.string().optional()
});

// Webhook configuration schema
export const webhookConfigSchema = z.object({
  enabled: z.boolean().default(true),
  requireAuthentication: z.boolean().default(false),
  allowedIPs: z.array(z.string().regex(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$|^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/, 'Invalid IP address')).optional(),
  secretKey: z.string().min(32, 'Secret key must be at least 32 characters').optional(),
  rateLimit: z.object({
    windowMs: z.number().min(1000).default(60000), // 1 minute default
    maxRequests: z.number().min(1).default(100),
    skipSuccessfulRequests: z.boolean().default(false)
  }).optional()
});

// Field mapping configuration schema
export const formFieldMappingSchema = z.object({
  formId: z.string().min(1, 'Form ID is required'),
  mappings: z.record(
    z.string(),
    z.union([z.string(), z.array(z.string())]) // Single field name or array of possible names
  ),
  enabled: z.boolean().default(true),
  priority: z.number().min(1).default(1) // For handling multiple matching mappings
});

// Export inferred types
export type WebhookPatientData = z.infer<typeof webhookPatientDataSchema>;
export type FluentFormWebhookPayload = z.infer<typeof fluentFormWebhookPayloadSchema>;
export type WebhookSecurity = z.infer<typeof webhookSecuritySchema>;
export type WebhookConfig = z.infer<typeof webhookConfigSchema>;
export type FormFieldMapping = z.infer<typeof formFieldMappingSchema>;

// Validation utilities
export const validateWebhookPayload = (data: unknown) => fluentFormWebhookPayloadSchema.parse(data);
export const validatePatientData = (data: unknown) => webhookPatientDataSchema.parse(data);
export const validateWebhookSecurity = (data: unknown) => webhookSecuritySchema.parse(data);

// Sanitization utilities
export const sanitizeString = (str: string): string => {
  return str
    .replace(/[<>"']/g, '') // Remove potentially dangerous characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
};

export const sanitizeEmail = (email: string): string => {
  return email
    .toLowerCase()
    .trim()
    .replace(/[<>"']/g, '');
};

export const sanitizePhone = (phone: string): string => {
  return phone
    .replace(/[^\d+\s()-]/g, '') // Keep only digits, +, -, space, parentheses
    .replace(/\s+/g, ' ')
    .trim();
};