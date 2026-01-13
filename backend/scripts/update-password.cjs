const { User } = require('../dist/models/User.js');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function updatePassword() {
  const databases = [
    'mongodb://localhost:27017/l2l-backend',
    'mongodb://localhost:27017/l2l', 
    'mongodb://localhost:27017/l2l-crm'
  ];
  
  const email = 'bem@gyocc.org';
  const newPassword = 'BemAdmin123!';
  
  for (const mongoUri of databases) {
    try {
      console.log(`\n🔍 Checking database: ${mongoUri}`);
      await mongoose.connect(mongoUri);
      
      // Look for the specific user
      const user = await User.findOne({ email });
      
      if (user) {
        console.log(`✅ Found user: ${email}`);
        console.log(`  Current status: Active=${user.isActive}, Role=${user.role}`);
        
        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        // Update the user
        const result = await User.updateOne(
          { email },
          { 
            $set: { 
              password: hashedPassword,
              isActive: true,
              failedLoginAttempts: 0,
              lastFailedLogin: undefined
            } 
          }
        );
        
        console.log(`✅ Password updated successfully! Modified ${result.modifiedCount} record(s)`);
        console.log(`  New password: ${newPassword}`);
        
        await mongoose.disconnect();
        return; // Exit once we find and update the user
      } else {
        console.log(`❌ User not found: ${email}`);
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
  
  console.log(`\n❌ User ${email} not found in any database`);
  console.log('You may need to create the user first.');
}

updatePassword();