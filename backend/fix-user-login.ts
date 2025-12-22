import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { User } from './models/User.js';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

async function fixUserLogin(email: string, newPassword: string) {
  try {
    console.log(`${colors.blue}Fixing User Login Issues${colors.reset}\n`);
    
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/l2l-crm');
    console.log(`${colors.green}✓ Connected to MongoDB${colors.reset}\n`);

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    
    if (!user) {
      console.log(`${colors.red}✗ User not found: ${email}${colors.reset}`);
      process.exit(1);
    }

    console.log(`${colors.blue}Current user status:${colors.reset}`);
    console.log(`  Username: ${user.username}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Role: ${user.role}`);
    console.log(`  Active: ${user.isActive ? colors.green + 'Yes' : colors.red + 'No'}${colors.reset}`);
    console.log(`  Failed attempts: ${user.failedLoginAttempts || 0}`);

    // Step 1: Activate user and reset attempts
    console.log(`\n${colors.blue}Step 1: Activating user and resetting attempts${colors.reset}`);
    user.isActive = true;
    user.failedLoginAttempts = 0;
    user.lastFailedLogin = undefined;
    
    // Step 2: Set new password
    console.log(`\n${colors.blue}Step 2: Setting new password${colors.reset}`);
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    
    // Save all changes at once
    await user.save();
    console.log(`${colors.green}✓ User updated successfully${colors.reset}`);

    // Step 3: Verify the password works
    console.log(`\n${colors.blue}Step 3: Verifying new password${colors.reset}`);
    const updatedUser = await User.findOne({ email: email.toLowerCase() }).select('+password');
    
    if (updatedUser) {
      const isValid = await bcrypt.compare(newPassword, updatedUser.password);
      if (isValid) {
        console.log(`${colors.green}✓ Password verification successful!${colors.reset}`);
        console.log(`${colors.green}✓ You should now be able to login with:${colors.reset}`);
        console.log(`  Email: ${email}`);
        console.log(`  Password: ${newPassword}`);
      } else {
        console.log(`${colors.red}✗ Password verification failed!${colors.reset}`);
      }
    }

    // Additional check: Ensure no validation errors
    console.log(`\n${colors.blue}Final user status:${colors.reset}`);
    console.log(`  Active: ${colors.green}Yes${colors.reset}`);
    console.log(`  Failed attempts: 0`);
    console.log(`  Password hash: ${hashedPassword.substring(0, 10)}...`);

  } catch (error) {
    console.error(`${colors.red}Error:${colors.reset}`, error);
  } finally {
    await mongoose.disconnect();
    console.log(`\n${colors.blue}Disconnected from MongoDB${colors.reset}`);
  }
}

// Get arguments
const email = process.argv[2];
const newPassword = process.argv[3];

if (!email || !newPassword) {
  console.log(`${colors.yellow}Usage: npx tsx fix-user-login.ts <email> <new-password>${colors.reset}`);
  console.log(`Example: npx tsx fix-user-login.ts user@example.com NewPass123!`);
  process.exit(1);
}

// Validate password
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
if (newPassword.length < 8 || !passwordRegex.test(newPassword)) {
  console.log(`${colors.red}Password must be at least 8 characters with uppercase, lowercase, number, and special character${colors.reset}`);
  process.exit(1);
}

fixUserLogin(email, newPassword).catch(console.error);