import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env.local') });

async function resetPassword() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/l2l-backend';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Get email from command line argument
    const email = process.argv[2];
    const newPassword = process.argv[3];
    
    if (!email || !newPassword) {
      console.log('Usage: npx tsx scripts/reset-password.ts <email> <new-password>');
      process.exit(1);
    }

    // Find user
    const user = await User.findOne({ email });
    
    if (!user) {
      console.log('❌ User not found with email:', email);
      process.exit(1);
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update password using updateOne to avoid validation issues
    await User.updateOne(
      { _id: user._id },
      { 
        $set: { 
          password: hashedPassword,
          failedLoginAttempts: 0
        } 
      }
    );
    
    console.log('✅ Password reset successfully for:', email);
    console.log('New password:', newPassword);
    console.log('User role:', user.role);
    console.log('User active:', user.isActive);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

resetPassword();