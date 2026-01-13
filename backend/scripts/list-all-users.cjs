const { User } = require('../dist/models/User.js');
const mongoose = require('mongoose');

async function listUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/l2l-backend');
    
    const users = await User.find({}, 'email name isActive failedLoginAttempts');
    console.log('All users in database:');
    console.log('Total count:', users.length);
    
    if (users.length > 0) {
      users.forEach((user, index) => {
        console.log(`${index + 1}. Email: ${user.email}, Name: ${user.name}, Active: ${user.isActive}, Failed Attempts: ${user.failedLoginAttempts || 0}`);
      });
    } else {
      console.log('No users found in database');
    }
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

listUsers();