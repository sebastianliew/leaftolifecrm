const fs = require('fs');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// Copy the Patient schema from import-patients.js since we can't import TypeScript models
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

const medicalHistorySchema = new mongoose.Schema({
  appointments: [appointmentSchema],
  prescriptions: [prescriptionSchema],
  customBlends: [customBlendSchema]
}, { _id: false });

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
  email: { type: String, required: true },
  phone: { type: String, required: true },
  altPhone: { type: String },
  fax: { type: String },
  address: { type: String },
  city: { type: String },
  state: { type: String },
  postalCode: { type: String },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  hasConsent: {
    type: Boolean,
    default: false
  },
  legacyCustomerNo: { type: String },
  medicalHistory: medicalHistorySchema,
  consentHistory: [consentHistorySchema],
  migrationInfo: migrationInfoSchema
}, {
  timestamps: true
});

patientSchema.index({ lastName: 1, firstName: 1 });
patientSchema.index({ status: 1 });
patientSchema.index({ nric: 1 }, { unique: true, sparse: true });
patientSchema.index({ legacyCustomerNo: 1 }, { unique: true, sparse: true });
patientSchema.index({ email: 1 }, { unique: true });
patientSchema.index({ 'migrationInfo.sourceSystem': 1 });

const Patient = mongoose.models.Patient || mongoose.model('Patient', patientSchema);

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  throw new Error('MONGODB_URI environment variable is required');
}

function parseDate(dateString) {
  if (!dateString || dateString === '') return new Date('1990-01-01');

  // Handle MM/DD/YYYY format from form
  const parts = dateString.split('/');
  if (parts.length === 3) {
    const [month, day, year] = parts;
    return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
  }

  const date = new Date(dateString);
  return isNaN(date.getTime()) ? new Date('1990-01-01') : date;
}

function mapMaritalStatus(status) {
  if (!status) return undefined;
  const normalized = status.toLowerCase();
  if (normalized.includes('single')) return 'single';
  if (normalized.includes('married')) return 'married';
  if (normalized.includes('divorced') || normalized.includes('widowed')) return 'divorced';
  return undefined;
}

async function importPatientsFromForm() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Read the JSON file
    const jsonFilePath = 'C:\\Users\\Miko\\Downloads\\intake-form-2025-09-15.json';

    if (!fs.existsSync(jsonFilePath)) {
      throw new Error(`JSON file not found: ${jsonFilePath}`);
    }

    console.log('📖 Reading form data...');
    const formData = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
    console.log(`📊 Found ${formData.length} form submissions`);

    // Get existing patients to avoid duplicates (check by name + email)
    const existingPatients = await Patient.find({}, 'firstName lastName email').lean();
    console.log(`📧 Found ${existingPatients.length} existing patients in database`);

    let importedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const submission of formData) {
      try {
        const data = submission.response;

        // Skip test entries
        if (data.email?.toLowerCase().includes('test')) {
          console.log(`⏭️  Skipping test entry: ${data.email}`);
          skippedCount++;
          continue;
        }

        // Check for duplicates by name AND email
        const firstName = data.names?.first_name || 'Unknown';
        const lastName = data.names?.last_name || 'Unknown';
        const email = data.email;

        const isDuplicate = existingPatients.some(p =>
          p.email === email &&
          p.firstName === firstName &&
          p.lastName === lastName
        );

        if (isDuplicate) {
          console.log(`⏭️  Patient already exists: ${firstName} ${lastName} (${email})`);
          skippedCount++;
          continue;
        }

        // Skip if no email
        if (!data.email) {
          console.log(`⏭️  Skipping entry without email`);
          skippedCount++;
          continue;
        }

        const patient = {
          firstName: data.names?.first_name || 'Unknown',
          lastName: data.names?.last_name || 'Unknown',
          email: data.email,
          phone: data.numeric_field || '', // Just extract what's there, no validation
          dateOfBirth: parseDate(data.datetime),
          gender: 'prefer-not-to-say', // Not collected in form - using N/A equivalent

          // Optional fields - leave blank if not provided
          nric: data.input_text_9 || undefined,
          occupation: data.input_text || undefined,
          maritalStatus: mapMaritalStatus(data.input_radio_1),

          // Address fields (not in form, leave blank)
          address: undefined,
          city: undefined,
          state: undefined,
          postalCode: undefined,
          country: undefined,

          // Status and consent
          status: 'active',
          hasConsent: data.checkbox_6?.includes('Yes') || false,

          // Medical history initialization
          medicalHistory: {
            appointments: [],
            prescriptions: [],
            customBlends: []
          },

          // Store consent if given
          consentHistory: data.checkbox_6?.includes('Yes') ? [{
            consentNo: `FORM-${submission.id}`,
            consentDate: new Date(submission.created_at),
            consentType: 'digital'
          }] : [],

          // Migration tracking
          migrationInfo: {
            sourceSystem: 'leaftolife_website_form',
            migratedAt: new Date(),
            migrationVersion: '2.0',
            dataQuality: 'partial',
            conflictResolved: false,
            originalRecord: undefined // Don't set this - it expects ObjectId not a number
          }
        };

        // Store important medical info in a note field (for reference)
        const medicalNotes = [];
        if (data.description_3) medicalNotes.push(`Health Concerns: ${data.description_3}`);
        if (data.description_2) medicalNotes.push(`Allergies: ${data.description_2}`);
        if (data.description) medicalNotes.push(`Medications: ${data.description}`);
        if (data.description_1) medicalNotes.push(`Supplements: ${data.description_1}`);

        // Add lifestyle info if available (newer form entries have these)
        if (data.input_radio === 'Yes') medicalNotes.push('Smoker: Yes');
        if (data.input_radio_2) medicalNotes.push(`Alcohol: ${data.input_radio_2}`);
        if (data.input_radio_6 && data.description_6) {
          medicalNotes.push(`Dietary Restrictions: ${data.description_6}`);
        }

        if (medicalNotes.length > 0) {
          patient.medicalHistory.appointments.push({
            appointmentNo: `INTAKE-${submission.id}`,
            appointmentDate: new Date(submission.created_at),
            conditionSummary: medicalNotes.join('\n'),
            remarks: `Intake form submitted: ${submission.created_at}. Referral: ${data.description_4 || 'Not specified'}`,
            status: 'completed'
          });
        }

        // Create the patient
        const createdPatient = await Patient.create(patient);
        importedCount++;
        console.log(`✅ Imported: ${patient.firstName} ${patient.lastName} (${patient.email}) - ID: ${createdPatient._id}`);

      } catch (error) {
        errorCount++;
        // Check if it's a duplicate key error
        if (error.code === 11000) {
          console.error(`❌ Duplicate found for submission ID ${submission.id}: ${error.keyValue}`);
        } else {
          console.error(`❌ Error processing submission ID ${submission.id}:`, error.message);
        }
      }
    }

    console.log('\n🎉 Import completed!');
    console.log(`📊 Summary:`);
    console.log(`   - Total form submissions: ${formData.length}`);
    console.log(`   - Successfully imported: ${importedCount}`);
    console.log(`   - Skipped (duplicates/test): ${skippedCount}`);
    console.log(`   - Errors: ${errorCount}`);

  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    process.exit(0);
  }
}

// Run the import
console.log('🚀 Starting patient import from form data...');
console.log('📝 This will import new patients from the intake form JSON file');
console.log('⚠️  Existing patients (by email) will be skipped\n');

importPatientsFromForm();