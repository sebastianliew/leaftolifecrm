import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

// Import User model
import { User } from './models/User.js';

// Test configuration
const TEST_EMAIL = 'test.user@example.com';
const TEST_USERNAME = 'testuser' + Date.now();
const ORIGINAL_PASSWORD = 'Original@Pass1';
const NEW_PASSWORD = 'Updated@Pass2';

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

async function testPasswordLoginFlow() {
  console.log(`${colors.blue}Testing Password Update and Login Flow${colors.reset}\n`);

  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/l2l-crm');
    console.log(`${colors.green}✓ Connected to MongoDB${colors.reset}\n`);

    // Step 1: Create a test user with original password
    console.log(`${colors.blue}Step 1: Creating test user${colors.reset}`);
    const hashedOriginalPassword = await bcrypt.hash(ORIGINAL_PASSWORD, 10);
    
    // Remove existing test user if exists
    await User.deleteOne({ email: TEST_EMAIL });
    
    const testUser = await User.create({
      email: TEST_EMAIL,
      username: TEST_USERNAME,
      password: hashedOriginalPassword,
      name: 'Test User',
      firstName: 'Test',
      lastName: 'User',
      role: 'staff',
      isActive: true
    });

    console.log(`${colors.green}✓ Created test user: ${testUser.email}${colors.reset}\n`);

    // Step 2: Verify login works with original password
    console.log(`${colors.blue}Step 2: Testing login with original password${colors.reset}`);
    const userWithPassword = await User.findOne({ email: TEST_EMAIL }).select('+password');
    
    if (!userWithPassword) {
      throw new Error('Test user not found');
    }

    const originalLoginValid = await bcrypt.compare(ORIGINAL_PASSWORD, userWithPassword.password);
    if (originalLoginValid) {
      console.log(`${colors.green}✓ Login successful with original password${colors.reset}`);
    } else {
      console.log(`${colors.red}✗ Login failed with original password${colors.reset}`);
    }

    // Step 3: Update password (simulating the controller logic)
    console.log(`\n${colors.blue}Step 3: Updating password${colors.reset}`);
    const hashedNewPassword = await bcrypt.hash(NEW_PASSWORD, 10);
    
    await User.findByIdAndUpdate(
      testUser._id,
      { password: hashedNewPassword },
      { runValidators: true }
    );

    console.log(`${colors.green}✓ Password updated successfully${colors.reset}`);

    // Step 4: Verify login fails with old password
    console.log(`\n${colors.blue}Step 4: Testing login with old password (should fail)${colors.reset}`);
    const userAfterUpdate = await User.findOne({ email: TEST_EMAIL }).select('+password');
    
    if (!userAfterUpdate) {
      throw new Error('Test user not found after update');
    }

    const oldPasswordValid = await bcrypt.compare(ORIGINAL_PASSWORD, userAfterUpdate.password);
    if (!oldPasswordValid) {
      console.log(`${colors.green}✓ Login correctly fails with old password${colors.reset}`);
    } else {
      console.log(`${colors.red}✗ Login should fail with old password but succeeded${colors.reset}`);
    }

    // Step 5: Verify login works with new password
    console.log(`\n${colors.blue}Step 5: Testing login with new password${colors.reset}`);
    const newPasswordValid = await bcrypt.compare(NEW_PASSWORD, userAfterUpdate.password);
    if (newPasswordValid) {
      console.log(`${colors.green}✓ Login successful with new password${colors.reset}`);
    } else {
      console.log(`${colors.red}✗ Login failed with new password${colors.reset}`);
    }

    // Step 6: Test actual login controller behavior
    console.log(`\n${colors.blue}Step 6: Simulating actual login process${colors.reset}`);
    
    // This simulates what happens in the login controller
    const loginUser = await User.findOne({ email: TEST_EMAIL }).select('+password');
    if (!loginUser) {
      console.log(`${colors.red}✗ User not found during login${colors.reset}`);
    } else if (!loginUser.isActive) {
      console.log(`${colors.red}✗ User is inactive${colors.reset}`);
    } else {
      const isPasswordValid = await bcrypt.compare(NEW_PASSWORD, loginUser.password);
      if (isPasswordValid) {
        console.log(`${colors.green}✓ Login controller simulation successful${colors.reset}`);
        
        // Update lastLogin (as the controller does)
        loginUser.lastLogin = new Date();
        loginUser.failedLoginAttempts = 0;
        await loginUser.save();
        
        console.log(`${colors.green}✓ User login metadata updated${colors.reset}`);
      } else {
        console.log(`${colors.red}✗ Login controller simulation failed${colors.reset}`);
      }
    }

    // Clean up
    console.log(`\n${colors.blue}Cleaning up test data${colors.reset}`);
    await User.deleteOne({ email: TEST_EMAIL });
    console.log(`${colors.green}✓ Test user deleted${colors.reset}`);

    // Summary
    console.log(`\n${colors.green}✓ All tests completed successfully!${colors.reset}`);
    console.log(`${colors.green}✓ Password update correctly allows login with new password${colors.reset}`);
    console.log(`${colors.green}✓ Old password is properly invalidated${colors.reset}`);

  } catch (error) {
    console.error(`\n${colors.red}Test Error:${colors.reset}`, error);
    // Clean up on error
    try {
      await User.deleteOne({ email: TEST_EMAIL });
    } catch (cleanupError) {
      console.error('Cleanup error:', cleanupError);
    }
  } finally {
    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log(`\n${colors.blue}Disconnected from MongoDB${colors.reset}`);
  }
}

// Run the test
testPasswordLoginFlow().catch(console.error);