import mongoose from 'mongoose';

/**
 * Patient Enrichment Schema Extensions
 * These schemas extend the base Patient model with additional fields
 * for the data enrichment process without breaking existing functionality
 */

// Enhanced Prescription Schema with detailed timing
const detailedPrescriptionSchema = new mongoose.Schema({
  prescriptionId: { type: String, required: true },
  diagnosisNo: { type: String },
  medicationName: { type: String, required: true },
  quantity: { type: Number, required: true },
  unit: { type: String },
  remedy: { type: String }, // Special instructions
  supplier: { type: String },
  issuedDate: { type: Date },
  // Detailed timing schedule (numeric values indicating doses)
  timingSchedule: {
    uponRising: { type: Number, min: 0, max: 10, default: 0 },
    beforeBreakfast: { type: Number, min: 0, max: 10, default: 0 },
    duringBreakfast: { type: Number, min: 0, max: 10, default: 0 },
    afterBreakfast: { type: Number, min: 0, max: 10, default: 0 },
    twoHoursAfterBreakfast: { type: Number, min: 0, max: 10, default: 0 },
    beforeLunch: { type: Number, min: 0, max: 10, default: 0 },
    duringLunch: { type: Number, min: 0, max: 10, default: 0 },
    afterLunch: { type: Number, min: 0, max: 10, default: 0 },
    twoHoursAfterLunch: { type: Number, min: 0, max: 10, default: 0 },
    beforeDinner: { type: Number, min: 0, max: 10, default: 0 },
    duringDinner: { type: Number, min: 0, max: 10, default: 0 },
    afterDinner: { type: Number, min: 0, max: 10, default: 0 },
    beforeBed: { type: Number, min: 0, max: 10, default: 0 }
  }
}, { _id: false });

// Diagnosis Schema
const diagnosisSchema = new mongoose.Schema({
  diagnosisNo: { type: String, required: true },
  date: { type: Date, required: true },
  condition: { type: String },
  practitioner: { type: String },
  notes: { type: String },
  linkedPrescriptions: [{ type: String }], // References to prescription IDs
  linkedTransactions: [{ type: String }] // References to transaction numbers
}, { _id: false });

// Marketing Preferences Schema
const marketingPreferencesSchema = new mongoose.Schema({
  partnerOffers: { type: Boolean, default: false },
  newsletter: { type: Boolean, default: false },
  lastUpdated: { type: Date, default: Date.now }
}, { _id: false });

// Member Benefits Schema
const memberBenefitsSchema = new mongoose.Schema({
  discountPercentage: {
    type: Number,
    min: 0,
    max: 100
  },
  discountReason: { type: String },
  discountStartDate: { type: Date },
  discountEndDate: { type: Date },
  membershipTier: { 
    type: String,
    enum: ['standard', 'silver', 'gold', 'platinum', 'vip']
  }
}, { _id: false });

// Enhanced Medical Data Schema
const enhancedMedicalDataSchema = new mongoose.Schema({
  diagnoses: [diagnosisSchema],
  detailedPrescriptions: [detailedPrescriptionSchema]
}, { _id: false });

// Financial Summary Schema
const financialSummarySchema = new mongoose.Schema({
  totalTransactionCount: { type: Number, default: 0 },
  totalSpent: { type: Number, default: 0 },
  averageTransactionValue: { type: Number, default: 0 },
  lastTransactionDate: { type: Date },
  preferredPaymentMethod: { 
    type: String,
    enum: ['cash', 'card', 'bank_transfer', 'offset_from_credit', 'paynow', 'nets', 'web_store', 'misc', 'CASH', 'PAYNOW', 'CARD', 'BANK_TRANSFER', 'MIXED', 'DIGITAL_WALLET']
  },
  outstandingBalance: { type: Number, default: 0 }
}, { _id: false });

// Enrichment Info Schema
const enrichmentInfoSchema = new mongoose.Schema({
  lastEnriched: { type: Date, default: Date.now },
  enrichmentVersion: { type: String, default: '2.0' },
  enrichmentSources: [{ type: String }],
  dataCompleteness: { 
    type: Number, 
    min: 0, 
    max: 100,
    default: 0 
  },
  enrichmentPhases: [{
    phase: { type: String },
    completedAt: { type: Date },
    recordsEnriched: { type: Number },
    success: { type: Boolean }
  }]
}, { _id: false });

// Export the enrichment fields to be added to Patient model
export const patientEnrichmentFields = {
  // Marketing preferences
  marketingPreferences: marketingPreferencesSchema,
  
  // Member benefits
  memberBenefits: memberBenefitsSchema,
  
  // Enhanced medical data
  enhancedMedicalData: enhancedMedicalDataSchema,
  
  // Financial summary
  financialSummary: financialSummarySchema,
  
  // Enrichment tracking
  enrichmentInfo: enrichmentInfoSchema,

  // Additional fields from old system
  salutation: { type: String }, // Mr., Mrs., Dr., etc.
  country: { type: String, default: 'Singapore' },
  company: { type: String } // Company affiliation
};

// Helper function to add enrichment fields to existing Patient schema
export function addEnrichmentFields(schema: mongoose.Schema) {
  for (const [fieldName, fieldSchema] of Object.entries(patientEnrichmentFields)) {
    schema.add({ [fieldName]: fieldSchema });
  }
  
  // Add index for enrichment tracking
  schema.index({ 'enrichmentInfo.lastEnriched': -1 });
  schema.index({ 'enrichmentInfo.dataCompleteness': -1 });
  
  return schema;
}