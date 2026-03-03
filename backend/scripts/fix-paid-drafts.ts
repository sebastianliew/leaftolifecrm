/**
 * Migration: Fix draft transactions with paymentStatus 'paid'
 *
 * Root cause: The POST /transactions/drafts/autosave endpoint used findOneAndUpdate($set)
 * which bypasses both the pre-save Mongoose middleware and the normalizeTransactionForPayment
 * utility. If the user filled in a full paid amount before clicking "Save as Draft" (or the
 * 3-second auto-save fired), the draft was persisted with status: 'draft' + paymentStatus: 'paid'.
 *
 * Fix applied: saveDraft controller now forces paymentStatus: 'pending' + status: 'draft'.
 * This script fixes any existing records that are already in the broken state.
 *
 * Run: npx ts-node scripts/fix-paid-drafts.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI!;

async function fixPaidDrafts() {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db!;

  // 1. Find all broken records
  const broken = await db.collection('transactions').find({
    status: 'draft',
    paymentStatus: 'paid'
  }).project({ transactionNumber: 1, customerName: 1, paidAmount: 1, totalAmount: 1 }).toArray();

  console.log(`Found ${broken.length} draft transaction(s) with paymentStatus 'paid':`);
  for (const t of broken) {
    console.log(`  - ${t.transactionNumber} | ${t.customerName} | paid: ${t.paidAmount} / total: ${t.totalAmount}`);
  }

  if (broken.length === 0) {
    console.log('Nothing to fix. Exiting.');
    await mongoose.disconnect();
    return;
  }

  // 2. Promote them to completed (paid = completed, not draft)
  const result = await db.collection('transactions').updateMany(
    { status: 'draft', paymentStatus: 'paid' },
    {
      $set: {
        status: 'completed',
        type: 'COMPLETED',
        updatedAt: new Date()
      }
    }
  );

  console.log(`\nFixed ${result.modifiedCount} transaction(s): status -> 'completed', type -> 'COMPLETED'`);
  await mongoose.disconnect();
  console.log('Done.');
}

fixPaidDrafts().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
