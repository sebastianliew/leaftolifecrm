/**
 * Duplicate Transaction Detection Script (READ-ONLY)
 *
 * This script runs aggregation queries to identify potential duplicate:
 * - Inventory movements
 * - Transactions
 *
 * NO DATA IS MODIFIED - this is strictly for reporting.
 *
 * Usage: npx tsx scripts/find-duplicate-transactions.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('Error: MONGODB_URI not found in environment variables');
  process.exit(1);
}

interface DuplicateMovement {
  _id: {
    ref: string;
    productId: mongoose.Types.ObjectId;
    type: string;
  };
  count: number;
  movements: Array<{
    _id: mongoose.Types.ObjectId;
    createdAt: Date;
    quantity: number;
  }>;
}

interface DuplicateTransaction {
  _id: {
    patient: mongoose.Types.ObjectId;
    total: number;
    date: string;
  };
  count: number;
  transactions: Array<{
    _id: mongoose.Types.ObjectId;
    transactionNumber: string;
    createdAt: Date;
    status: string;
  }>;
}

interface CloseCreatedAtTransaction {
  _id: {
    patient: mongoose.Types.ObjectId;
    total: number;
  };
  count: number;
  transactions: Array<{
    _id: mongoose.Types.ObjectId;
    transactionNumber: string;
    createdAt: Date;
    status: string;
  }>;
  timeDiffMs: number;
}

async function findDuplicates() {
  console.log('='.repeat(80));
  console.log('DUPLICATE TRANSACTION DETECTION REPORT');
  console.log('Generated:', new Date().toISOString());
  console.log('='.repeat(80));
  console.log('\nConnecting to MongoDB...');

  try {
    await mongoose.connect(MONGODB_URI as string);
    console.log('Connected successfully.\n');

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not available');
    }

    // ============================================================
    // 1. Check for duplicate inventory movements
    // ============================================================
    console.log('-'.repeat(80));
    console.log('1. DUPLICATE INVENTORY MOVEMENTS');
    console.log('-'.repeat(80));
    console.log('Query: Grouping by (reference, productId, movementType)\n');

    const duplicateMovements = await db.collection('inventorymovements').aggregate<DuplicateMovement>([
      {
        $group: {
          _id: {
            ref: '$reference',
            productId: '$productId',
            type: '$movementType'
          },
          count: { $sum: 1 },
          movements: {
            $push: {
              _id: '$_id',
              createdAt: '$createdAt',
              quantity: '$quantity'
            }
          }
        }
      },
      { $match: { count: { $gt: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();

    if (duplicateMovements.length === 0) {
      console.log('✅ No duplicate inventory movements found.\n');
    } else {
      console.log(`⚠️  Found ${duplicateMovements.length} sets of duplicate movements:\n`);

      for (const dup of duplicateMovements) {
        console.log(`  Reference: ${dup._id.ref}`);
        console.log(`  Product ID: ${dup._id.productId}`);
        console.log(`  Movement Type: ${dup._id.type}`);
        console.log(`  Duplicate Count: ${dup.count}`);
        console.log('  Movements:');
        for (const mov of dup.movements) {
          console.log(`    - ID: ${mov._id}, Created: ${mov.createdAt}, Qty: ${mov.quantity}`);
        }
        console.log('');
      }
    }

    // ============================================================
    // 2. Check for duplicate transactions (same patient, total, date)
    // ============================================================
    console.log('-'.repeat(80));
    console.log('2. DUPLICATE TRANSACTIONS (Same Patient + Total + Date)');
    console.log('-'.repeat(80));
    console.log('Query: Grouping by (patient, total, date)\n');

    const duplicateTransactions = await db.collection('transactions').aggregate<DuplicateTransaction>([
      {
        $match: {
          status: { $ne: 'cancelled' } // Exclude cancelled transactions
        }
      },
      {
        $group: {
          _id: {
            patient: '$patient',
            total: '$total',
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
          },
          count: { $sum: 1 },
          transactions: {
            $push: {
              _id: '$_id',
              transactionNumber: '$transactionNumber',
              createdAt: '$createdAt',
              status: '$status'
            }
          }
        }
      },
      { $match: { count: { $gt: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();

    if (duplicateTransactions.length === 0) {
      console.log('✅ No duplicate transactions found (same patient + total + date).\n');
    } else {
      console.log(`⚠️  Found ${duplicateTransactions.length} sets of potential duplicates:\n`);

      for (const dup of duplicateTransactions) {
        console.log(`  Patient ID: ${dup._id.patient}`);
        console.log(`  Total: ${dup._id.total}`);
        console.log(`  Date: ${dup._id.date}`);
        console.log(`  Duplicate Count: ${dup.count}`);
        console.log('  Transactions:');
        for (const txn of dup.transactions) {
          console.log(`    - ${txn.transactionNumber} | Status: ${txn.status} | Created: ${txn.createdAt}`);
        }
        console.log('');
      }
    }

    // ============================================================
    // 3. Check for transactions created within seconds of each other
    // ============================================================
    console.log('-'.repeat(80));
    console.log('3. RAPID DUPLICATE TRANSACTIONS (Within 60 seconds)');
    console.log('-'.repeat(80));
    console.log('Query: Same patient + total, created within 60 seconds\n');

    const rapidDuplicates = await db.collection('transactions').aggregate<CloseCreatedAtTransaction>([
      {
        $match: {
          status: { $ne: 'cancelled' }
        }
      },
      {
        $group: {
          _id: {
            patient: '$patient',
            total: '$total'
          },
          transactions: {
            $push: {
              _id: '$_id',
              transactionNumber: '$transactionNumber',
              createdAt: '$createdAt',
              status: '$status'
            }
          },
          count: { $sum: 1 }
        }
      },
      { $match: { count: { $gt: 1 } } },
      { $unwind: { path: '$transactions', includeArrayIndex: 'idx' } },
      { $sort: { '_id.patient': 1, '_id.total': 1, 'transactions.createdAt': 1 } },
      {
        $group: {
          _id: { patient: '$_id.patient', total: '$_id.total' },
          transactions: { $push: '$transactions' },
          count: { $sum: 1 }
        }
      },
      { $match: { count: { $gt: 1 } } }
    ]).toArray();

    // Filter to only those within 60 seconds
    const closeTimeDuplicates: CloseCreatedAtTransaction[] = [];

    for (const group of rapidDuplicates) {
      const sortedTxns = group.transactions.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      for (let i = 1; i < sortedTxns.length; i++) {
        const timeDiff = new Date(sortedTxns[i].createdAt).getTime() -
                         new Date(sortedTxns[i-1].createdAt).getTime();

        if (timeDiff <= 60000) { // 60 seconds
          closeTimeDuplicates.push({
            _id: group._id,
            count: 2,
            transactions: [sortedTxns[i-1], sortedTxns[i]],
            timeDiffMs: timeDiff
          });
        }
      }
    }

    if (closeTimeDuplicates.length === 0) {
      console.log('✅ No rapid duplicate transactions found.\n');
    } else {
      console.log(`⚠️  Found ${closeTimeDuplicates.length} pairs of rapid duplicates:\n`);

      for (const dup of closeTimeDuplicates) {
        console.log(`  Patient ID: ${dup._id.patient}`);
        console.log(`  Total: ${dup._id.total}`);
        console.log(`  Time Difference: ${dup.timeDiffMs}ms (${(dup.timeDiffMs / 1000).toFixed(2)}s)`);
        console.log('  Transactions:');
        for (const txn of dup.transactions) {
          console.log(`    - ${txn.transactionNumber} | Status: ${txn.status} | Created: ${txn.createdAt}`);
        }
        console.log('');
      }
    }

    // ============================================================
    // 4. Summary Statistics
    // ============================================================
    console.log('-'.repeat(80));
    console.log('4. SUMMARY STATISTICS');
    console.log('-'.repeat(80));

    const totalMovements = await db.collection('inventorymovements').countDocuments();
    const totalTransactions = await db.collection('transactions').countDocuments();
    const activeTransactions = await db.collection('transactions').countDocuments({ status: { $ne: 'cancelled' } });

    console.log(`  Total Inventory Movements: ${totalMovements}`);
    console.log(`  Total Transactions: ${totalTransactions}`);
    console.log(`  Active Transactions (non-cancelled): ${activeTransactions}`);
    console.log(`  Duplicate Movement Sets: ${duplicateMovements.length}`);
    console.log(`  Potential Duplicate Transaction Sets: ${duplicateTransactions.length}`);
    console.log(`  Rapid Duplicate Pairs (< 60s): ${closeTimeDuplicates.length}`);

    // ============================================================
    // 5. Inventory Consistency Check
    // ============================================================
    console.log('\n' + '-'.repeat(80));
    console.log('5. INVENTORY CONSISTENCY CHECK (Sample of 10 products)');
    console.log('-'.repeat(80));

    const sampleProducts = await db.collection('products').find({ currentStock: { $exists: true } })
      .limit(10)
      .toArray();

    for (const product of sampleProducts) {
      const movements = await db.collection('inventorymovements').aggregate([
        { $match: { productId: product._id } },
        {
          $group: {
            _id: null,
            totalIn: {
              $sum: {
                $cond: [
                  { $in: ['$movementType', ['purchase', 'adjustment_in', 'return', 'cancellation_reversal']] },
                  '$quantity',
                  0
                ]
              }
            },
            totalOut: {
              $sum: {
                $cond: [
                  { $in: ['$movementType', ['sale', 'adjustment_out', 'damage', 'expired']] },
                  '$quantity',
                  0
                ]
              }
            }
          }
        }
      ]).toArray();

      if (movements.length > 0) {
        const calculatedStock = movements[0].totalIn - movements[0].totalOut;
        const recordedStock = product.currentStock || 0;
        const discrepancy = recordedStock - calculatedStock;

        if (Math.abs(discrepancy) > 0.01) {
          console.log(`\n  ⚠️  ${product.name}`);
          console.log(`     Recorded Stock: ${recordedStock}`);
          console.log(`     Calculated Stock (from movements): ${calculatedStock}`);
          console.log(`     Discrepancy: ${discrepancy}`);
        }
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('END OF REPORT');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('Error running duplicate detection:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB.');
  }
}

// Run the script
findDuplicates();
