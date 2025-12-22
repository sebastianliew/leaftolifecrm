/**
 * Fix invalid createdBy values in Bundle collection
 * This script finds bundles with "current_user" as createdBy and replaces them with a valid admin user
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

// Connect to MongoDB
async function connectToDatabase() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI environment variable is not set');
    }
    
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1);
  }
}

// Define schemas for this script
const bundleSchema = new mongoose.Schema({}, { collection: 'bundles', strict: false });
const userSchema = new mongoose.Schema({}, { collection: 'users', strict: false });

const Bundle = mongoose.model('Bundle', bundleSchema);
const User = mongoose.model('User', userSchema);

async function fixBundleCreatedBy() {
  try {
    console.log('Starting bundle createdBy fix...');
    
    // Find all bundles with invalid createdBy values
    const invalidBundles = await Bundle.find({
      $or: [
        { createdBy: "current_user" },
        { createdBy: { $type: "string" } },
        { createdBy: { $exists: false } },
        { createdBy: null }
      ]
    });
    
    console.log(`Found ${invalidBundles.length} bundles with invalid createdBy values`);
    
    if (invalidBundles.length === 0) {
      console.log('No bundles found with invalid createdBy values');
      return;
    }
    
    // Find the first admin or super_admin user to use as fallback
    const adminUser = await User.findOne({
      role: { $in: ['admin', 'super_admin'] },
      isActive: true
    });
    
    if (!adminUser) {
      throw new Error('No active admin user found to use as fallback');
    }
    
    console.log(`Using admin user ${adminUser.email} (${adminUser._id}) as fallback createdBy`);
    
    // Update all invalid bundles
    const result = await Bundle.updateMany(
      {
        $or: [
          { createdBy: "current_user" },
          { createdBy: { $type: "string" } },
          { createdBy: { $exists: false } },
          { createdBy: null }
        ]
      },
      {
        $set: { createdBy: adminUser._id }
      }
    );
    
    console.log(`Updated ${result.modifiedCount} bundles with valid createdBy values`);
    
    // Verify the fix
    const remainingInvalidBundles = await Bundle.countDocuments({
      $or: [
        { createdBy: "current_user" },
        { createdBy: { $type: "string" } },
        { createdBy: { $exists: false } },
        { createdBy: null }
      ]
    });
    
    console.log(`Remaining invalid bundles: ${remainingInvalidBundles}`);
    
    if (remainingInvalidBundles === 0) {
      console.log('✅ All bundle createdBy values have been fixed!');
    } else {
      console.log('⚠️  Some invalid bundle createdBy values still remain');
    }
    
  } catch (error) {
    console.error('Error fixing bundle createdBy values:', error);
    throw error;
  }
}

async function main() {
  try {
    await connectToDatabase();
    await fixBundleCreatedBy();
    console.log('Bundle createdBy fix completed successfully');
  } catch (error) {
    console.error('Script failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run the script
main();