import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { Transaction } from '../models/Transaction.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env.local') });

async function fixTransactionTypes() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/l2l-backend';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    // Show current state
    const beforeSummary = await Transaction.aggregate([
      { $group: { _id: { type: '$type', status: '$status' }, count: { $sum: 1 } } },
      { $sort: { '_id.type': 1, '_id.status': 1 } }
    ]);

    console.log('📊 Before Fix - Transaction Summary:');
    beforeSummary.forEach(item => {
      console.log(`  ${item._id.type} / ${item._id.status}: ${item.count}`);
    });
    console.log('');

    // Fix 1: Update transactions with type='DRAFT' but status is not 'draft'
    // (These are completed/pending transactions that should have type='COMPLETED')
    const draftFix = await Transaction.updateMany(
      {
        type: 'DRAFT',
        status: { $ne: 'draft' }
      },
      { $set: { type: 'COMPLETED' } }
    );
    console.log(`✅ Fixed ${draftFix.modifiedCount} transactions: DRAFT type with non-draft status -> COMPLETED`);

    // Fix 2: Update transactions with legacy type='sale' to proper type
    const saleFix = await Transaction.updateMany(
      { type: 'sale' },
      [
        {
          $set: {
            type: {
              $cond: {
                if: { $eq: ['$status', 'draft'] },
                then: 'DRAFT',
                else: 'COMPLETED'
              }
            }
          }
        }
      ]
    );
    console.log(`✅ Fixed ${saleFix.modifiedCount} transactions: legacy 'sale' type -> COMPLETED/DRAFT`);

    // Show a summary
    const summary = await Transaction.aggregate([
      { $group: { _id: { type: '$type', status: '$status' }, count: { $sum: 1 } } },
      { $sort: { '_id.type': 1, '_id.status': 1 } }
    ]);

    console.log('\n📊 Transaction Summary:');
    summary.forEach(item => {
      console.log(`  ${item._id.type} / ${item._id.status}: ${item.count}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
  }
}

fixTransactionTypes();
