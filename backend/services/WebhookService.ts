import { Patient } from '../models/Patient.js';
import type { 
  FluentFormWebhookPayload, 
  WebhookPatientData, 
  WebhookProcessingResult,
  FormFieldMapping,
  FieldNameVariations
} from '../types/webhook.js';
import type { PatientFormData } from '../types/patient.js';
import { 
  validateWebhookPayload,
  validatePatientData,
  sanitizeString,
  sanitizeEmail,
  sanitizePhone
} from '../lib/validations/webhookSchemas.js';

export class WebhookService {
  // Common field name variations for flexible mapping
  private fieldVariations: FieldNameVariations = {
    firstName: ['first_name', 'firstName', 'fname', 'given_name', 'name_first'],
    lastName: ['last_name', 'lastName', 'lname', 'family_name', 'surname', 'name_last'],
    middleName: ['middle_name', 'middleName', 'mname', 'middle_initial', 'name_middle'],
    email: ['email', 'email_address', 'e_mail', 'user_email', 'contact_email'],
    phone: ['phone', 'phone_number', 'mobile', 'cell', 'telephone', 'contact_phone'],
    dateOfBirth: ['date_of_birth', 'dateOfBirth', 'dob', 'birth_date', 'birthdate', 'birthday'],
    gender: ['gender', 'sex'],
    nric: ['nric', 'ic', 'identity_card', 'national_id', 'id_number'],
    bloodType: ['blood_type', 'bloodType', 'blood_group'],
    maritalStatus: ['marital_status', 'maritalStatus', 'martial_status'],
    occupation: ['occupation', 'job', 'profession', 'work'],
    altPhone: ['alt_phone', 'altPhone', 'alternative_phone', 'secondary_phone', 'phone_2'],
    fax: ['fax', 'fax_number'],
    address: ['address', 'street_address', 'home_address', 'full_address'],
    city: ['city', 'town'],
    state: ['state', 'province', 'region'],
    postalCode: ['postal_code', 'postalCode', 'zip_code', 'zip', 'postcode']
  };

  // Default form field mapping - can be customized per form
  private defaultMapping: FormFieldMapping = {
    formId: 'default',
    mappings: {
      firstName: ['first_name', 'firstName'],
      lastName: ['last_name', 'lastName'],
      email: ['email', 'email_address'],
      phone: ['phone', 'phone_number'],
      dateOfBirth: ['date_of_birth', 'dob'],
      gender: ['gender']
    }
  };

  /**
   * Process Fluent Forms Pro intake webhook
   */
  async processFluentFormIntake(payload: FluentFormWebhookPayload): Promise<WebhookProcessingResult> {
    try {
      // Validate webhook payload structure
      const validatedPayload = validateWebhookPayload(payload) as FluentFormWebhookPayload;
      
      // Extract and map patient data from webhook payload
      const patientData = this.mapWebhookToPatient(validatedPayload);
      
      // Validate and sanitize patient data
      const validatedPatientData = validatePatientData(patientData);
      
      // Check if patient already exists (by email or NRIC)
      const existingPatient = await this.findExistingPatient(validatedPatientData);
      
      let result: WebhookProcessingResult;
      
      if (existingPatient) {
        // Update existing patient
        const updatedPatient = await this.updateExistingPatient(existingPatient._id.toString(), validatedPatientData);
        result = {
          success: true,
          patientId: updatedPatient._id.toString(),
          action: 'updated',
          message: 'Patient updated successfully from intake form'
        };
      } else {
        // Create new patient
        const newPatient = await this.createNewPatient(validatedPatientData);
        result = {
          success: true,
          patientId: newPatient._id.toString(),
          action: 'created',
          message: 'Patient created successfully from intake form'
        };
      }
      
      // Log successful processing
      console.log('✅ Webhook processed successfully:', {
        action: result.action,
        patientId: result.patientId,
        formId: validatedPayload.form_id,
        email: validatedPatientData.email
      });
      
      return result;
      
    } catch (error) {
      console.error('❌ Webhook processing error:', error);
      
      return {
        success: false,
        patientId: '',
        action: 'created',
        errors: [error instanceof Error ? error.message : 'Unknown processing error']
      };
    }
  }

  /**
   * Map webhook payload to patient data structure
   */
  private mapWebhookToPatient(payload: FluentFormWebhookPayload): WebhookPatientData {
    const response = payload.response || payload;
    
    // Helper function to find field value by multiple possible names
    const findFieldValue = (possibleNames: string[]): string | undefined => {
      for (const name of possibleNames) {
        if (response[name] !== undefined && response[name] !== null && response[name] !== '') {
          const value = response[name];
          return typeof value === 'object' && 'value' in value ? value.value?.toString() : value?.toString();
        }
      }
      return undefined;
    };

    // Extract required fields
    const firstName = findFieldValue(this.fieldVariations.firstName);
    const lastName = findFieldValue(this.fieldVariations.lastName);
    const email = findFieldValue(this.fieldVariations.email);
    const phone = findFieldValue(this.fieldVariations.phone);
    const dateOfBirth = findFieldValue(this.fieldVariations.dateOfBirth);
    const gender = findFieldValue(this.fieldVariations.gender);

    if (!firstName || !lastName || !email || !phone || !dateOfBirth || !gender) {
      console.log('Missing required fields:', { firstName, lastName, email, phone, dateOfBirth, gender });
      console.log('Available response fields:', Object.keys(response));
      throw new Error('Missing required patient fields in webhook payload');
    }

    // Parse and validate date of birth
    const dobDate = this.parseDate(dateOfBirth);
    if (!dobDate) {
      throw new Error(`Invalid date of birth format: ${dateOfBirth}`);
    }

    // Validate and normalize gender
    const normalizedGender = this.normalizeGender(gender);

    // Build patient data object with sanitization
    const patientData: WebhookPatientData = {
      firstName: sanitizeString(firstName),
      lastName: sanitizeString(lastName),
      email: sanitizeEmail(email),
      phone: phone, // Will be sanitized and validated by Zod schema
      dateOfBirth: dobDate.toISOString().split('T')[0], // Convert Date to YYYY-MM-DD string format
      gender: normalizedGender,
      
      // Optional fields with sanitization
      middleName: findFieldValue(this.fieldVariations.middleName) ? sanitizeString(findFieldValue(this.fieldVariations.middleName)!) : undefined,
      nric: findFieldValue(this.fieldVariations.nric),
      bloodType: this.normalizeBloodType(findFieldValue(this.fieldVariations.bloodType)),
      maritalStatus: this.normalizeMaritalStatus(findFieldValue(this.fieldVariations.maritalStatus)),
      occupation: findFieldValue(this.fieldVariations.occupation) ? sanitizeString(findFieldValue(this.fieldVariations.occupation)!) : undefined,
      altPhone: findFieldValue(this.fieldVariations.altPhone) ? sanitizePhone(findFieldValue(this.fieldVariations.altPhone)!) : undefined,
      fax: findFieldValue(this.fieldVariations.fax),
      address: findFieldValue(this.fieldVariations.address) ? sanitizeString(findFieldValue(this.fieldVariations.address)!) : undefined,
      city: findFieldValue(this.fieldVariations.city) ? sanitizeString(findFieldValue(this.fieldVariations.city)!) : undefined,
      state: findFieldValue(this.fieldVariations.state) ? sanitizeString(findFieldValue(this.fieldVariations.state)!) : undefined,
      postalCode: findFieldValue(this.fieldVariations.postalCode),
      
      // Webhook metadata
      webhookSource: 'fluent-forms',
      webhookFormId: payload.form_id?.toString() || 'unknown',
      webhookSubmissionId: payload.serial_number,
      webhookTimestamp: new Date().toISOString()
    };

    return patientData;
  }

  /**
   * Find existing patient by email or NRIC
   */
  private async findExistingPatient(patientData: WebhookPatientData) {
    const query = {
      $or: [
        { email: patientData.email },
        ...(patientData.nric ? [{ nric: patientData.nric }] : [])
      ]
    };

    return await Patient.findOne(query);
  }

  /**
   * Create new patient from webhook data
   */
  private async createNewPatient(patientData: WebhookPatientData) {
    const patientFormData: PatientFormData = this.convertToPatientFormData(patientData);
    
    const patient = new Patient({
      ...patientFormData,
      status: 'active',
      hasConsent: false, // Will need to be set separately
      migrationInfo: {
        sourceSystem: 'fluent_forms_webhook',
        migratedAt: new Date(),
        migrationVersion: '1.0',
        dataQuality: 'complete',
        conflictResolved: true
      }
    });

    return await patient.save();
  }

  /**
   * Update existing patient with webhook data
   */
  private async updateExistingPatient(patientId: string, patientData: WebhookPatientData) {
    const updateData: Partial<PatientFormData> = this.convertToPatientFormData(patientData);
    
    // Only update fields that have values
    const filteredUpdateData = Object.fromEntries(
      Object.entries(updateData).filter(([_, value]) => value !== undefined && value !== null && value !== '')
    );

    return await Patient.findByIdAndUpdate(
      patientId,
      {
        ...filteredUpdateData,
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    );
  }

  /**
   * Convert webhook patient data to PatientFormData
   */
  private convertToPatientFormData(patientData: WebhookPatientData): PatientFormData {
    return {
      firstName: patientData.firstName,
      lastName: patientData.lastName,
      middleName: patientData.middleName,
      email: patientData.email,
      phone: patientData.phone,
      dateOfBirth: patientData.dateOfBirth,
      gender: patientData.gender,
      nric: patientData.nric || '', // Provide empty string if NRIC is not provided
      bloodType: patientData.bloodType,
      maritalStatus: patientData.maritalStatus,
      occupation: patientData.occupation,
      altPhone: patientData.altPhone,
      fax: patientData.fax,
      address: patientData.address,
      city: patientData.city,
      state: patientData.state,
      postalCode: patientData.postalCode,
      status: 'active', // New patients from webhook are active by default
      hasConsent: false // Consent should be collected separately
    };
  }

  /**
   * Parse date from various formats
   */
  private parseDate(dateStr: string): Date | null {
    if (!dateStr) return null;
    
    const date = new Date(dateStr);
    
    if (!isNaN(date.getTime())) {
      return date;
    }
    
    return null;
  }

  /**
   * Normalize gender value
   */
  private normalizeGender(gender: string): 'male' | 'female' | 'other' | 'prefer-not-to-say' {
    const normalized = gender.toLowerCase().trim();
    
    if (['male', 'm', 'man'].includes(normalized)) return 'male';
    if (['female', 'f', 'woman'].includes(normalized)) return 'female';
    if (['other', 'non-binary', 'nb'].includes(normalized)) return 'other';
    
    return 'prefer-not-to-say';
  }

  /**
   * Normalize blood type
   */
  private normalizeBloodType(bloodType?: string): 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | undefined {
    if (!bloodType) return undefined;
    
    const normalized = bloodType.toUpperCase().replace(/\s/g, '');
    const validTypes: Array<'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-'> = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
    
    return validTypes.includes(normalized as 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-') ? normalized as 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' : undefined;
  }

  /**
   * Normalize marital status
   */
  private normalizeMaritalStatus(status?: string): 'single' | 'married' | 'divorced' | 'widowed' | 'separated' | undefined {
    if (!status) return undefined;
    
    const normalized = status.toLowerCase().trim();
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
  }
}