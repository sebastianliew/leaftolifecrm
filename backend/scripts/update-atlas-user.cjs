require('dotenv').config({ path: '.env.local' });
const { User } = require('../dist/models/User.js');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function updateAtlasUser() {
  try {
    // Use the actual MongoDB Atlas connection from the environment
    const mongoUri = process.env.MONGODB_URI;
    console.log(`🔗 Connecting to Atlas: ${mongoUri?.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`);
    
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB Atlas');
    
    const email = 'bem@gyocc.org';
    const targetUserId = '687482d77b4aa030c17f14c8';
    const newPassword = 'BemAdmin123!';
    
    // First, try to find by the specific ID from debug output
    let user = await User.findById(targetUserId).select('+password');
    
    if (!user) {
      console.log(`⚠️  User with ID ${targetUserId} not found`);
      // Try to find by email instead
      user = await User.findOne({ email }).select('+password');
    }
    
    if (user) {
      console.log(`✅ Found user:`);
      console.log(`  ID: ${user._id}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Username: ${user.username}`);
      console.log(`  Name: ${user.name}`);
      console.log(`  Role: ${user.role}`);
      console.log(`  Active: ${user.isActive}`);
      console.log(`  Failed Attempts: ${user.failedLoginAttempts || 0}`);
      console.log(`  Current hash prefix: ${user.password.substring(0, 10)}`);
      
      // Hash the new password
      console.log(`\n🔧 Updating password to: ${newPassword}`);
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      console.log(`  New hash prefix: ${hashedPassword.substring(0, 10)}`);
      
      // Update the user
      const result = await User.updateOne(
        { _id: user._id },
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
      
      // Test the new password
      console.log(`\n🔐 Testing new password...`);
      const updatedUser = await User.findById(user._id).select('+password');
      const isValid = await bcrypt.compare(newPassword, updatedUser.password);
      console.log(`  Password test: ${isValid ? '✅ SUCCESS' : '❌ FAILED'}`);
      
      if (isValid) {
        console.log(`\n🎉 Login should now work with:`);
        console.log(`  Email: ${email}`);
        console.log(`  Password: ${newPassword}`);
      }
      
    } else {
      console.log(`❌ No user found with email ${email} or ID ${targetUserId}`);
      
      // List all users to see what's available
      console.log(`\n📋 All users in the database:`);
      const allUsers = await User.find({}, 'email username name role isActive').limit(10);
      if (allUsers.length === 0) {
        console.log('  No users found');
      } else {
        allUsers.forEach((u, i) => {
          console.log(`  ${i + 1}. ${u.email} (${u.username}) - ${u.role} - Active: ${u.isActive}`);
        });
      }
    }
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

updateAtlasUser();