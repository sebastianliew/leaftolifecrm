const { User } = require('../dist/models/User.js');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function findSpecificUser() {
  const databases = [
    'mongodb://localhost:27017/l2l-backend',
    'mongodb://localhost:27017/l2l', 
    'mongodb://localhost:27017/l2l-crm'
  ];
  
  const targetUserId = '687482d77b4aa030c17f14c8';
  const newPassword = 'BemAdmin123!';
  
  for (const mongoUri of databases) {
    try {
      console.log(`\n🔍 Checking database: ${mongoUri}`);
      await mongoose.connect(mongoUri);
      
      // Look for the specific user ID from the debug output
      const userById = await User.findById(targetUserId).select('+password');
      
      if (userById) {
        console.log(`✅ Found user by ID: ${targetUserId}`);
        console.log(`  Email: ${userById.email}`);
        console.log(`  Username: ${userById.username}`);
        console.log(`  Name: ${userById.name}`);
        console.log(`  Role: ${userById.role}`);
        console.log(`  Active: ${userById.isActive}`);
        console.log(`  Failed Attempts: ${userById.failedLoginAttempts || 0}`);
        console.log(`  Current hash prefix: ${userById.password.substring(0, 10)}`);
        
        // Hash the new password
        console.log(`\n🔧 Updating password...`);
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        // Update this specific user
        const result = await User.updateOne(
          { _id: targetUserId },
          { 
            $set: { 
              password: hashedPassword,
              isActive: true,
              failedLoginAttempts: 0
            },
            $unset: {
              lastFailedLogin: 1
            }
          }
        );
        
        console.log(`✅ Password updated! Modified ${result.modifiedCount} record(s)`);
        console.log(`  New hash prefix: ${hashedPassword.substring(0, 10)}`);
        
        // Test the new password
        console.log(`\n🔐 Testing new password...`);
        const updatedUser = await User.findById(targetUserId).select('+password');
        const isValid = await bcrypt.compare(newPassword, updatedUser.password);
        console.log(`  Password test: ${isValid ? '✅ SUCCESS' : '❌ FAILED'}`);
        
        await mongoose.disconnect();
        return; // Exit once we find and update the user
      }
      
      // Also check for users with bem@gyocc.org email
      const userByEmail = await User.findOne({ email: 'bem@gyocc.org' }).select('+password');
      if (userByEmail && userByEmail._id.toString() !== targetUserId) {
        console.log(`⚠️  Found different user with same email:`);
        console.log(`  ID: ${userByEmail._id}`);
        console.log(`  Expected ID: ${targetUserId}`);
      }
      
      await mongoose.disconnect();
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
      try {
        await mongoose.disconnect();
      } catch (e) {
        // Ignore disconnect errors
      }
    }
  }
  
  console.log(`\n❌ User with ID ${targetUserId} not found in any database`);
}

findSpecificUser();