const { User } = require('../dist/models/User.js');
const mongoose = require('mongoose');

async function reactivateAccount() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/l2l-crm');
    
    const user = await User.findOne({ email: 'bem@gyocc.org' });
    if (user) {
      console.log('Current user status:');
      console.log('  Email:', user.email);
      console.log('  isActive:', user.isActive);
      console.log('  failedLoginAttempts:', user.failedLoginAttempts || 0);
      console.log('  lastFailedLogin:', user.lastFailedLogin || 'Never');
      
      if (!user.isActive || user.failedLoginAttempts >= 5) {
        console.log('\nReactivating account...');
        await User.updateOne(
          { email: 'bem@gyocc.org' },
          { 
            $set: { 
              isActive: true,
              failedLoginAttempts: 0
            } 
          }
        );
        console.log('Account reactivated successfully!');
      } else {
        console.log('\nAccount is already active.');
      }
    } else {
      console.log('User not found with email: bem@gyocc.org');
    }
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

reactivateAccount();