import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../../.env.local') });

async function debugLogin() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/l2l-backend';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    const email = 'calvindrakkez9@gmail.com';
    const password = '4RydgS4MzvQpTHn@';

    console.log('Step 1: Finding user by email...');
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      console.log('❌ User not found');
      process.exit(1);
    }
    console.log('✅ User found:', user.email);

    console.log('\nStep 2: Checking if user is active...');
    console.log('isActive:', user.isActive);

    if (!user.isActive) {
      console.log('❌ User is not active');
      process.exit(1);
    }
    console.log('✅ User is active');

    console.log('\nStep 3: Verifying password...');
    console.log('Password from input:', password);
    console.log('Password hash from DB:', user.password);

    // Test the password comparison exactly as the controller does
    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log('Password valid:', isPasswordValid);

    if (!isPasswordValid) {
      console.log('❌ Password is invalid');

      // Let's try to understand why
      console.log('\nDebugging password comparison:');
      console.log('Password length:', password.length);
      console.log('Password chars:', password.split('').map(c => c.charCodeAt(0)));
      console.log('Hash length:', user.password.length);

      // Try comparing with different variations
      console.log('\nTrying different variations:');
      const variations = [
        password,
        password.trim(),
        password.toLowerCase(),
        password.toUpperCase(),
      ];

      for (const variant of variations) {
        const result = await bcrypt.compare(variant, user.password);
        console.log(`"${variant}":`, result);
      }

    } else {
      console.log('✅ Password is valid');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

debugLogin();
