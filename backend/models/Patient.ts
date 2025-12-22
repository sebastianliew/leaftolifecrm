import mongoose from 'mongoose';
import { addEnrichmentFields } from './PatientEnrichment.js';

// Appointment subdocument schema
const appointmentSchema = new mongoose.Schema({
  appointmentNo: { type: String, required: true },
  appointmentDate: { type: Date, required: true },
  timeStart: { type: Date },
  timeEnd: { type: Date },
  conditionSummary: { type: String },
  remarks: { type: String },
  doctorSeen: { type: String },
  status: {
    type: String,
    enum: ['confirmed', 'completed', 'cancelled'],
    default: 'confirmed'
  }
}, { _id: false });

// Prescription subdocument schema
const prescriptionSchema = new mongoose.Schema({
  medicationName: { type: String, required: true },
  quantity: { type: Number, required: true },
  dosageInstructions: { type: String },
  supplier: { type: String },
  diagnosisNo: { type: String },
  issuedDate: { type: Date },
  timingInstructions: {
    uponRising: { type: Boolean, default: false },
    beforeBreakfast: { type: Boolean, default: false },
    afterBreakfast: { type: Boolean, default: false },
    beforeLunch: { type: Boolean, default: false },
    afterLunch: { type: Boolean, default: false },
    beforeDinner: { type: Boolean, default: false },
    afterDinner: { type: Boolean, default: false },
    beforeBed: { type: Boolean, default: false }
  }
}, { _id: false });

// Custom blend subdocument schema
const customBlendSchema = new mongoose.Schema({
  blendNo: { type: String, required: true },
  blendName: { type: String, required: true },
  ingredients: [{
    name: { type: String },
    quantity: { type: Number },
    unit: { type: String },
    cost: { type: Number }
  }],
  totalPrice: { type: Number },
  quantity: { type: Number },
  unit: { type: String },
  transactionNo: { type: String },
  createdDate: { type: Date }
}, { _id: false });

// Consent history subdocument schema
const consentHistorySchema = new mongoose.Schema({
  consentNo: { type: String, required: true },
  signatureFile: { type: String },
  consentDate: { type: Date, required: true },
  consentType: {
    type: String,
    enum: ['digital', 'physical'],
    default: 'digital'
  }
}, { _id: false });

// Medical history subdocument schema
const medicalHistorySchema = new mongoose.Schema({
  appointments: [appointmentSchema],
  prescriptions: [prescriptionSchema],
  customBlends: [customBlendSchema]
}, { _id: false });

// Migration info subdocument schema
const migrationInfoSchema = new mongoose.Schema({
  sourceSystem: { type: String, default: 'leaftolife_legacy' },
  migratedAt: { type: Date, default: Date.now },
  migrationVersion: { type: String, default: '1.0' },
  dataQuality: {
    type: String,
    enum: ['complete', 'partial', 'minimal'],
    default: 'partial'
  },
  conflictResolved: { type: Boolean, default: false },
  originalRecord: { type: mongoose.Schema.Types.ObjectId }
}, { _id: false });

const patientSchema = new mongoose.Schema({
  // Basic Information
  firstName: { type: String, required: true },
  middleName: { type: String },
  lastName: { type: String, required: true },
  nric: { type: String },
  dateOfBirth: { type: Date, required: true },
  gender: { 
    type: String, 
    enum: ['male', 'female', 'other', 'prefer-not-to-say'],
    required: true 
  },
  bloodType: {
    type: String,
    enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
  },
  maritalStatus: {
    type: String,
    enum: ['single', 'married', 'divorced', 'widowed', 'separated']
  },
  occupation: { type: String },

  // Contact Information
  email: { type: String, required: true },
  phone: { type: String, required: true },
  altPhone: { type: String },
  fax: { type: String },
  address: { type: String },
  city: { type: String },
  state: { type: String },
  postalCode: { type: String },

  // Status and Consent
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  hasConsent: {
    type: Boolean,
    default: false
  },


  // Legacy system integration
  legacyCustomerNo: { type: String },
  
  // Medical history
  medicalHistory: medicalHistorySchema,
  
  // Consent history
  consentHistory: [consentHistorySchema],
  
  // Migration metadata
  migrationInfo: migrationInfoSchema
}, {
  timestamps: true,
  suppressReservedKeysWarning: true
});

// Add enrichment fields to the schema
addEnrichmentFields(patientSchema);

// Add indexes for better query performance
patientSchema.index({ lastName: 1, firstName: 1 });
patientSchema.index({ status: 1 });
patientSchema.index({ nric: 1 }, { unique: true, sparse: true });
patientSchema.index({ legacyCustomerNo: 1 }, { unique: true, sparse: true });
patientSchema.index({ 'migrationInfo.sourceSystem': 1 });

// Pre-save middleware to remove unwanted fields
patientSchema.pre('save', function(next) {
  // Remove medicalInfo and emergencyContacts if they exist
  this.set('medicalInfo', undefined);
  this.set('emergencyContacts', undefined);
  next();
});

export const Patient = mongoose.models.Patient || mongoose.model('Patient', patientSchema);