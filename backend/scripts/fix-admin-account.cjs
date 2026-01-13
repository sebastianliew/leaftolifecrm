const { User } = require('../dist/models/User.js');
const mongoose = require('mongoose');

async function fixAdminAccount() {
  try {
    // Try different connection strings
    let mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/l2l-backend';
    console.log('Trying connection:', mongoUri);
    await mongoose.connect(mongoUri);
    
    console.log('✅ Connected to MongoDB');
    
    // Look for users with "admin" in username or email
    const adminUsers = await User.find({
      $or: [
        { email: { $regex: /admin/i } },
        { username: 'admin' },
        { role: { $in: ['admin', 'super_admin'] } }
      ]
    });
    
    console.log('Admin users found:', adminUsers.length);
    
    if (adminUsers.length > 0) {
      adminUsers.forEach((user, index) => {
        console.log(`${index + 1}. Email: ${user.email}, Username: ${user.username}, Active: ${user.isActive}, Failed Attempts: ${user.failedLoginAttempts || 0}, Role: ${user.role}`);
      });
      
      // Reactivate all admin accounts
      const result = await User.updateMany(
        { $or: [
          { email: { $regex: /admin/i } },
          { username: 'admin' },
          { role: { $in: ['admin', 'super_admin'] } }
        ]},
        { 
          $set: { 
            isActive: true,
            failedLoginAttempts: 0
          } 
        }
      );
      
      console.log(`✅ Reactivated ${result.modifiedCount} admin accounts`);
    } else {
      console.log('No admin users found');
    }
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

fixAdminAccount();