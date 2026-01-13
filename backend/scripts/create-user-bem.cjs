const { User } = require('../dist/models/User.js');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function createUser() {
  try {
    // Use the default database that the app uses
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/l2l-backend';
    console.log(`🔗 Connecting to: ${mongoUri}`);
    await mongoose.connect(mongoUri);
    
    console.log('✅ Connected to MongoDB');
    
    const email = 'bem@gyocc.org';
    const password = 'BemAdmin123!';
    const username = 'admin';
    
    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      console.log(`📝 User exists, updating password...`);
      console.log(`  Email: ${existingUser.email}`);
      console.log(`  Username: ${existingUser.username}`);
      
      // Hash the new password
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Update the existing user
      const result = await User.updateOne(
        { _id: existingUser._id },
        { 
          $set: { 
            email, // Update email if different
            password: hashedPassword,
            isActive: true,
            failedLoginAttempts: 0
          },
          $unset: {
            lastFailedLogin: 1
          }
        }
      );
      
      console.log(`✅ User updated successfully! Modified ${result.modifiedCount} record(s)`);
    } else {
      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Create new user
      const user = new User({
        email,
        username,
        password: hashedPassword,
        name: 'BEM Admin',
        role: 'super_admin',
        isActive: true,
        failedLoginAttempts: 0,
        featurePermissions: {
          inventory: {
            canAddProducts: true,
            canEditProducts: true,
            canDeleteProducts: true,
            canCreateRestockOrders: true
          },
          suppliers: {
            canManageSuppliers: true
          },
          bundles: {
            canCreateBundles: true
          },
          appointments: {
            canManageSchedules: true
          },
          reports: {
            canViewInventoryReports: true,
            canViewFinancialReports: true
          },
          transactions: {
            canProcessRefunds: true
          }
        }
      });
      
      await user.save();
      console.log('✅ User created successfully');
    }
    
    console.log(`📧 Email: ${email}`);
    console.log(`🔑 Password: ${password}`);
    console.log(`👤 Username: ${username}`);
    console.log(`🏢 Role: super_admin`);
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    if (error.code === 11000) {
      console.error('Duplicate key error - user may already exist with different fields');
      // Try to find and show existing users
      try {
        const users = await User.find({}, 'email username role isActive');
        console.log('\nExisting users:');
        users.forEach(u => console.log(`  ${u.email} (${u.username}) - ${u.role} - Active: ${u.isActive}`));
      } catch (e) {
        console.error('Could not list users:', e.message);
      }
    }
    process.exit(1);
  }
}

createUser();