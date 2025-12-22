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

async function createAdmin() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/l2l-backend';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Create admin user
    const email = 'admin@example.com';
    const password = 'admin123';
    const hashedPassword = await bcrypt.hash(password, 10);

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log('❌ User already exists with email:', email);
      process.exit(1);
    }

    const adminUser = new User({
      email,
      username: 'admin',
      password: hashedPassword,
      name: 'Admin User',
      role: 'super_admin',
      isActive: true,
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

    await adminUser.save();
    console.log('✅ Admin user created successfully');
    console.log('Email:', email);
    console.log('Password:', password);
    console.log('Role:', adminUser.role);

  } catch (error) {
    console.error('❌ Error creating admin:', error);
  } finally {
    await mongoose.disconnect();
  }
}

createAdmin();