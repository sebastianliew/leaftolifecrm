import mongoose from 'mongoose';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

// Define Patient schema (simplified version for querying)
const patientSchema = new mongoose.Schema({
  firstName: String,
  middleName: String,
  lastName: String,
  nric: String,
  dateOfBirth: Date,
  gender: String,
  bloodType: String,
  maritalStatus: String,
  occupation: String,
  email: String,
  phone: String,
  altPhone: String,
  fax: String,
  address: String,
  city: String,
  state: String,
  postalCode: String,
  status: String,
  hasConsent: Boolean,
  legacyCustomerNo: String,
  createdAt: Date,
  updatedAt: Date
}, {
  collection: 'patients',
  timestamps: true
});

const Patient = mongoose.models.Patient || mongoose.model('Patient', patientSchema);

async function findPatientIrinYip() {
  try {
    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is required');
    }

    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Search for patient named "Irin Yip" using various search criteria
    console.log('\n🔍 Searching for patient "Irin Yip"...\n');

    // Search by exact name match (case-insensitive)
    const exactMatch = await Patient.find({
      $or: [
        { firstName: /^irin$/i, lastName: /^yip$/i },
        { firstName: /^yip$/i, lastName: /^irin$/i }
      ]
    }).lean();

    if (exactMatch.length > 0) {
      console.log('✅ Found exact name match(es):');
      exactMatch.forEach((patient, index) => {
        console.log(`\n📋 Patient ${index + 1}:`);
        console.log(`   ID: ${patient._id}`);
        console.log(`   Name: ${patient.firstName} ${patient.middleName || ''} ${patient.lastName}`.trim());
        console.log(`   Email: ${patient.email}`);
        console.log(`   Phone: ${patient.phone}`);
        console.log(`   NRIC: ${patient.nric || 'Not provided'}`);
        console.log(`   DOB: ${patient.dateOfBirth ? patient.dateOfBirth.toISOString().split('T')[0] : 'Not provided'}`);
        console.log(`   Status: ${patient.status}`);
        console.log(`   Legacy Customer No: ${patient.legacyCustomerNo || 'N/A'}`);
        console.log(`   Created: ${patient.createdAt}`);
      });
    }

    // Search by partial name match
    const partialMatch = await Patient.find({
      $or: [
        { firstName: /irin/i },
        { lastName: /irin/i },
        { firstName: /yip/i },
        { lastName: /yip/i }
      ]
    }).lean();

    if (partialMatch.length > 0) {
      console.log(`\n📊 Found ${partialMatch.length} patient(s) with partial name match:`);
      partialMatch.forEach(patient => {
        console.log(`   - ${patient.firstName} ${patient.lastName} (${patient.email})`);
      });
    }

    // Search in all text fields for "Irin Yip"
    const textSearch = await Patient.find({
      $or: [
        { firstName: /irin.*yip/i },
        { lastName: /irin.*yip/i },
        { middleName: /irin.*yip/i },
        { email: /irin.*yip/i },
        { occupation: /irin.*yip/i },
        { address: /irin.*yip/i }
      ]
    }).lean();

    if (textSearch.length > 0 && textSearch.length !== exactMatch.length) {
      console.log(`\n🔎 Found ${textSearch.length} patient(s) with "Irin Yip" in other fields:`);
      textSearch.forEach(patient => {
        console.log(`   - ${patient.firstName} ${patient.lastName} (${patient.email})`);
      });
    }

    // Count total patients in database
    const totalCount = await Patient.countDocuments();
    console.log(`\n📈 Total patients in database: ${totalCount}`);

    if (exactMatch.length === 0 && partialMatch.length === 0 && textSearch.length === 0) {
      console.log('\n❌ No patient named "Irin Yip" found in the database.');
    }

  } catch (error) {
    console.error('❌ Search failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Database connection closed');
    process.exit(0);
  }
}

// Run the search
console.log('🚀 Starting patient search...');
findPatientIrinYip();