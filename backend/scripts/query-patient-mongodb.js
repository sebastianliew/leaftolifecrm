import { MongoClient } from 'mongodb';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

async function queryPatientIrinYip() {
  let client = null;
  
  try {
    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is required');
    }

    console.log('🔌 Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db();
    const collection = db.collection('patients');

    // Search for patient named "Irin Yip"
    console.log('\n🔍 Searching for patient "Irin Yip"...\n');

    // Exact name search (case-insensitive)
    const exactQuery = {
      $or: [
        { firstName: { $regex: /^irin$/i }, lastName: { $regex: /^yip$/i } },
        { firstName: { $regex: /^yip$/i }, lastName: { $regex: /^irin$/i } }
      ]
    };

    const exactResults = await collection.find(exactQuery).toArray();
    
    if (exactResults.length > 0) {
      console.log('✅ Found exact name match(es):');
      exactResults.forEach((patient, index) => {
        console.log(`\n📋 Patient ${index + 1}:`);
        console.log(`   ID: ${patient._id}`);
        console.log(`   Name: ${patient.firstName} ${patient.middleName || ''} ${patient.lastName}`.trim());
        console.log(`   Email: ${patient.email}`);
        console.log(`   Phone: ${patient.phone}`);
        console.log(`   NRIC: ${patient.nric || 'Not provided'}`);
        console.log(`   DOB: ${patient.dateOfBirth}`);
        console.log(`   Gender: ${patient.gender || 'Not specified'}`);
        console.log(`   Status: ${patient.status}`);
        console.log(`   Legacy Customer No: ${patient.legacyCustomerNo || 'N/A'}`);
        console.log(`   Has Consent: ${patient.hasConsent}`);
        console.log(`   Created: ${patient.createdAt}`);
        console.log(`   Updated: ${patient.updatedAt}`);
        
        // Show additional info if available
        if (patient.address || patient.city || patient.state || patient.postalCode) {
          console.log(`   Address: ${[patient.address, patient.city, patient.state, patient.postalCode].filter(Boolean).join(', ')}`);
        }
        if (patient.occupation) {
          console.log(`   Occupation: ${patient.occupation}`);
        }
        if (patient.memberBenefits) {
          console.log(`   Member Benefits:`, patient.memberBenefits);
        }
        if (patient.financialSummary) {
          console.log(`   Financial Summary:`, patient.financialSummary);
        }
      });
    }

    // Partial name search
    const partialQuery = {
      $or: [
        { firstName: { $regex: /irin/i } },
        { lastName: { $regex: /irin/i } },
        { firstName: { $regex: /yip/i } },
        { lastName: { $regex: /yip/i } }
      ]
    };

    const partialResults = await collection.find(partialQuery).toArray();
    
    if (partialResults.length > 0) {
      console.log(`\n📊 Found ${partialResults.length} patient(s) with partial name match:`);
      partialResults.forEach(patient => {
        console.log(`   - ${patient.firstName} ${patient.lastName} (${patient.email}) [ID: ${patient._id}]`);
      });
    }

    // Search in email field
    const emailQuery = {
      email: { $regex: /irin.*yip|yip.*irin/i }
    };
    
    const emailResults = await collection.find(emailQuery).toArray();
    
    if (emailResults.length > 0) {
      console.log(`\n📧 Found ${emailResults.length} patient(s) with "Irin Yip" in email:`);
      emailResults.forEach(patient => {
        console.log(`   - ${patient.firstName} ${patient.lastName} (${patient.email})`);
      });
    }

    // Get total count
    const totalCount = await collection.countDocuments();
    console.log(`\n📈 Total patients in database: ${totalCount}`);

    // Get sample of recent patients
    const recentPatients = await collection.find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .project({ firstName: 1, lastName: 1, email: 1, createdAt: 1 })
      .toArray();
      
    console.log('\n🕐 5 Most Recent Patients:');
    recentPatients.forEach(patient => {
      console.log(`   - ${patient.firstName} ${patient.lastName} (${patient.email}) - Created: ${patient.createdAt}`);
    });

    if (exactResults.length === 0 && partialResults.length === 0 && emailResults.length === 0) {
      console.log('\n❌ No patient named "Irin Yip" found in the database.');
      
      // Try alternative spellings
      console.log('\n🔄 Trying alternative spellings...');
      const alternativeQuery = {
        $or: [
          { firstName: { $regex: /iren|irene|erin|ireen/i } },
          { lastName: { $regex: /yep|ip|yeap|yeop/i } }
        ]
      };
      
      const alternativeResults = await collection.find(alternativeQuery).limit(10).toArray();
      if (alternativeResults.length > 0) {
        console.log(`Found ${alternativeResults.length} patient(s) with similar names:`);
        alternativeResults.forEach(patient => {
          console.log(`   - ${patient.firstName} ${patient.lastName} (${patient.email})`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Search failed:', error);
  } finally {
    if (client) {
      await client.close();
      console.log('\n🔌 Database connection closed');
    }
    process.exit(0);
  }
}

// Run the search
console.log('🚀 Starting patient search using MongoDB driver...');
queryPatientIrinYip();