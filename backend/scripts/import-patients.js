import fs from 'fs';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';
import mongoose from 'mongoose';

// Define Patient schema directly in script to avoid import issues
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

// Use the actual MongoDB Atlas URI from environment variables - targeting the correct l2l database
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  throw new Error('MONGODB_URI environment variable is required');
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

function parseDate(dateString) {
  if (!dateString || dateString === '') return new Date('1900-01-01');
  
  // Handle various date formats
  const date = new Date(dateString);
  return isNaN(date.getTime()) ? new Date('1900-01-01') : date;
}

function generatePlaceholderPhone() {
  // Generate a placeholder phone number
  return '00000000';
}

async function importPatients() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const csvFilePath = 'G:\\sql_to_csv_extraction\\base_usermembership.csv';
    
    if (!fs.existsSync(csvFilePath)) {
      throw new Error(`CSV file not found: ${csvFilePath}`);
    }

    const patients = [];
    let lineCount = 0;
    let headers = [];
    
    const fileStream = createReadStream(csvFilePath);
    const rl = createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    console.log('📖 Reading CSV file...');

    for await (const line of rl) {
      lineCount++;
      
      if (lineCount === 1) {
        // Parse headers
        headers = parseCSVLine(line);
        console.log('📊 CSV Headers:', headers);
        continue;
      }

      const values = parseCSVLine(line);
      
      // Map CSV values to object using headers - handle duplicate headers
      const row = {};
      headers.forEach((header, index) => {
        if (header === 'email' && !row[header]) {
          // Use first email column
          row[header] = values[index] || '';
        } else if (header !== 'email') {
          row[header] = values[index] || '';
        }
      });

      // Debug: Log first few rows
      if (lineCount <= 5) {
        console.log(`Row ${lineCount}:`, row);
        console.log(`Raw values:`, values);
      }
      
      // Skip invalid rows - check the email column (should be at index 6)
      const emailToUse = values[6] || row.email || '';
      
      if (lineCount <= 5) {
        console.log(`Email to use: "${emailToUse}"`);
      }
      
      if (!emailToUse || emailToUse.includes('noemail+') || emailToUse === '' || !emailToUse.includes('@')) {
        if (lineCount <= 5) {
          console.log(`Skipping row ${lineCount}: invalid email`);
        }
        continue;
      }
      
      // Skip test/system accounts
      if (emailToUse.includes('leaftolife.com.sg') && emailToUse.includes('noemail+')) {
        if (lineCount <= 5) {
          console.log(`Skipping row ${lineCount}: test account`);
        }
        continue;
      }
      
      if (lineCount <= 5) {
        console.log(`Processing row ${lineCount}: ${emailToUse}`);
      }

      // Map CSV data to Patient schema
      const patient = {
        firstName: row.first_name || 'Unknown',
        lastName: row.last_name || 'Unknown',
        nric: row.nric && row.nric !== '' ? row.nric : undefined,
        dateOfBirth: parseDate(row.birthdate),
        gender: 'prefer-not-to-say', // Default since CSV doesn't have this
        email: emailToUse,
        phone: generatePlaceholderPhone(), // Placeholder - update manually later
        occupation: row.occupation && row.occupation !== '' ? row.occupation : undefined,
        status: row.active === '1' ? 'active' : 'inactive',
        hasConsent: false, // Default to false
        legacyCustomerNo: row.customerNo,
        medicalHistory: {
          appointments: [],
          prescriptions: [],
          customBlends: []
        },
        consentHistory: [],
        migrationInfo: {
          sourceSystem: 'leaftolife_legacy',
          migratedAt: new Date(),
          migrationVersion: '1.0',
          dataQuality: (row.nric && row.birthdate && row.first_name && row.last_name) ? 'complete' : 'partial',
          conflictResolved: false
        }
      };

      patients.push(patient);
    }

    console.log(`📝 Processed ${patients.length} patient records from ${lineCount - 1} CSV lines`);

    if (patients.length === 0) {
      console.log('⚠️  No valid patient records found to import');
      return;
    }

    // Check for existing patients to avoid duplicates
    console.log('🔍 Checking for existing patients...');
    const existingEmails = await Patient.distinct('email');
    const existingCustomerNos = await Patient.distinct('legacyCustomerNo');
    
    const newPatients = patients.filter(patient => 
      !existingEmails.includes(patient.email) && 
      !existingCustomerNos.includes(patient.legacyCustomerNo)
    );

    console.log(`📊 Found ${newPatients.length} new patients to import (${patients.length - newPatients.length} duplicates skipped)`);

    if (newPatients.length === 0) {
      console.log('✅ No new patients to import - all records already exist');
      return;
    }

    // Insert patients in batches to avoid memory issues
    const batchSize = 50;
    let importedCount = 0;
    
    for (let i = 0; i < newPatients.length; i += batchSize) {
      const batch = newPatients.slice(i, i + batchSize);
      
      try {
        const result = await Patient.insertMany(batch, { 
          ordered: false, // Continue on individual errors
          runValidators: true 
        });
        
        importedCount += result.length;
        console.log(`✅ Imported batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(newPatients.length/batchSize)} (${result.length} patients)`);
        
      } catch (error) {
        console.error(`❌ Error in batch ${Math.floor(i/batchSize) + 1}:`, error.message);
        
        // Try to import individual records in this batch
        for (const patient of batch) {
          try {
            await Patient.create(patient);
            importedCount++;
            console.log(`✅ Individually imported: ${patient.firstName} ${patient.lastName}`);
          } catch (individualError) {
            console.error(`❌ Failed to import ${patient.firstName} ${patient.lastName}:`, individualError.message);
          }
        }
      }
    }

    console.log(`🎉 Patient import completed successfully!`);
    console.log(`📊 Statistics:`);
    console.log(`   - Total CSV records: ${lineCount - 1}`);
    console.log(`   - Valid patient records: ${patients.length}`);
    console.log(`   - New patients imported: ${importedCount}`);
    console.log(`   - Duplicates skipped: ${patients.length - newPatients.length}`);
    
    // Show some sample imported patients
    const samplePatients = await Patient.find({ 'migrationInfo.sourceSystem': 'leaftolife_legacy' })
      .limit(5)
      .select('firstName lastName email legacyCustomerNo');
    
    console.log(`\n📋 Sample imported patients:`);
    samplePatients.forEach(patient => {
      console.log(`   - ${patient.firstName} ${patient.lastName} (${patient.email}) [${patient.legacyCustomerNo}]`);
    });

  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  } finally {
    try {
      await mongoose.connection.close();
      console.log('\n🔌 Database connection closed');
    } catch (error) {
      console.error('❌ Error closing database connection:', error);
    }
    process.exit(0);
  }
}

// Run the import
console.log('🚀 Starting patient import from CSV...');
importPatients();