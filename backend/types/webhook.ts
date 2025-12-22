// Fluent Forms Pro webhook payload interface
export interface FluentFormWebhookPayload {
  // Form metadata
  form_id: string | number;
  serial_number?: string;
  source_url?: string;
  user_id?: string | number;
  browser?: string;
  device?: string;
  ip?: string;
  created_at?: string;
  updated_at?: string;
  
  // Form response data - this can be dynamic based on form configuration
  response?: FluentFormResponse;
  
  // Raw form data (alternative structure)
  [key: string]: unknown;
}

// Dynamic response structure from Fluent Forms
export interface FluentFormResponse {
  [fieldName: string]: string | number | boolean | string[] | FluentFormFieldValue;
}

export interface FluentFormFieldValue {
  value?: string | number | boolean;
  label?: string;
  raw?: unknown;
}

// Mapped patient data from webhook
export interface WebhookPatientData {
  // Required fields
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: 'male' | 'female' | 'other' | 'prefer-not-to-say';
  
  // Optional fields
  middleName?: string;
  nric?: string;
  bloodType?: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
  maritalStatus?: 'single' | 'married' | 'divorced' | 'widowed' | 'separated';
  occupation?: string;
  altPhone?: string;
  fax?: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  
  // Webhook metadata
  webhookSource: 'fluent-forms';
  webhookFormId: string;
  webhookSubmissionId?: string;
  webhookTimestamp: string;
}

// Webhook processing result
export interface WebhookProcessingResult {
  success: boolean;
  patientId: string;
  action: 'created' | 'updated';
  message?: string;
  errors?: string[];
}

// Field mapping configuration for different forms
export interface FormFieldMapping {
  formId: string | number;
  mappings: {
    [patientField: string]: string | string[]; // Can map to multiple possible field names
  };
}

// Common field name variations that might be used in intake forms
export interface FieldNameVariations {
  firstName: string[];
  lastName: string[];
  middleName: string[];
  email: string[];
  phone: string[];
  dateOfBirth: string[];
  gender: string[];
  nric: string[];
  bloodType: string[];
  maritalStatus: string[];
  occupation: string[];
  altPhone: string[];
  fax: string[];
  address: string[];
  city: string[];
  state: string[];
  postalCode: string[];
}

// Webhook configuration
export interface WebhookConfig {
  enabled: boolean;
  requireAuthentication: boolean;
  allowedIPs?: string[];
  secretKey?: string;
  defaultFormMapping?: FormFieldMapping;
}

// Webhook security validation
export interface WebhookSecurityContext {
  ip: string;
  userAgent?: string;
  signature?: string;
  timestamp: Date;
}