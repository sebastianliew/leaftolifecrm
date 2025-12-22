const mongoose = require('mongoose');
require('dotenv').config();

async function cleanupPatientFields() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Get the Patient model
    const Patient = mongoose.model('Patient', new mongoose.Schema({}));
    
    // Update all documents to remove the unwanted fields
    const result = await Patient.updateMany(
      {}, // match all documents
      {
        $unset: {
          medicalInfo: "",
          emergencyContacts: ""
        }
      }
    );

    console.log(`Successfully cleaned up ${result.modifiedCount} patient documents`);
    console.log('Fields removed: medicalInfo, emergencyContacts');
    
    // Verify the cleanup
    const remainingDocs = await Patient.find({
      $or: [
        { medicalInfo: { $exists: true } },
        { emergencyContacts: { $exists: true } }
      ]
    });

    if (remainingDocs.length === 0) {
      console.log('Verification successful: No documents contain the removed fields');
    } else {
      console.log(`Warning: ${remainingDocs.length} documents still contain the removed fields`);
    }

  } catch (error) {
    console.error('Error during cleanup:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

cleanupPatientFields(); 