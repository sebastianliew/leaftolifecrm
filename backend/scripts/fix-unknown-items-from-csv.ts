/**
 * Script to fix all "Unknown Item" entries in transactions
 * by cross-referencing with the original CSV data.
 *
 * Run with: npx tsx scripts/fix-unknown-items-from-csv.ts
 *
 * Add --dry-run flag to preview changes without saving:
 *   npx tsx scripts/fix-unknown-items-from-csv.ts --dry-run
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Transaction } from '../models/Transaction.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const CSV_PATH = 'G:/sql_to_csv_extraction/base_invoicedetails.csv';
const DRY_RUN = process.argv.includes('--dry-run');

interface CSVItem {
  transactionNo: string;
  type: string;
  manualName: string;
  qty: number;
  charge: number;
  componentName: string;
  inventoryName: string;
}

function parseCSV(filePath: string): CSVItem[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const items: CSVItem[] = [];

  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Parse CSV line (handle commas in values)
    const values = line.split(',');

    // CSV columns: id,type_choice,manual_Name,qty,charge,tax_amount,discountGiven,updated,created,
    //              blend_Name_id,component_Name_id,inventory_Name_id,transactionNo_id,...
    const item: CSVItem = {
      type: values[1] || '',
      manualName: values[2] || '',
      qty: parseFloat(values[3]) || 0,
      charge: parseFloat(values[4]) || 0,
      componentName: values[10] || '',  // component_Name_id
      inventoryName: values[11] || '',  // inventory_Name_id
      transactionNo: values[12] || '',  // transactionNo_id
    };

    items.push(item);
  }

  return items;
}

function buildLookupMap(csvItems: CSVItem[]): Map<string, CSVItem[]> {
  const map = new Map<string, CSVItem[]>();

  for (const item of csvItems) {
    if (!item.transactionNo) continue;

    if (!map.has(item.transactionNo)) {
      map.set(item.transactionNo, []);
    }
    map.get(item.transactionNo)!.push(item);
  }

  return map;
}

function findMatchingCSVItem(
  csvItems: CSVItem[],
  qty: number,
  unitPrice: number
): CSVItem | null {
  // Find item with matching qty and charge (unit price)
  for (const item of csvItems) {
    // Match by quantity and price (with small tolerance for floating point)
    if (Math.abs(item.qty - qty) < 0.01 && Math.abs(item.charge - unitPrice) < 0.01) {
      return item;
    }
  }
  return null;
}

function getItemName(csvItem: CSVItem): string {
  // Priority: componentName (for type B) > inventoryName (for type A) > manualName
  if (csvItem.type === 'B' && csvItem.componentName) {
    return csvItem.componentName;
  }
  if (csvItem.inventoryName) {
    return csvItem.inventoryName;
  }
  if (csvItem.manualName) {
    return csvItem.manualName;
  }
  return '';
}

async function fixUnknownItems() {
  console.log('═'.repeat(80));
  console.log('  FIX UNKNOWN ITEMS FROM CSV DATA');
  console.log('═'.repeat(80));

  if (DRY_RUN) {
    console.log('\n⚠️  DRY RUN MODE - No changes will be saved\n');
  }

  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error('ERROR: MONGODB_URI not found');
      process.exit(1);
    }

    console.log('📂 Loading CSV data...');
    const csvItems = parseCSV(CSV_PATH);
    console.log(`   Loaded ${csvItems.length} invoice detail records`);

    const lookupMap = buildLookupMap(csvItems);
    console.log(`   Built lookup map for ${lookupMap.size} transactions\n`);

    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('   Connected!\n');

    // Find all transactions with "Unknown Item"
    console.log('🔍 Searching for transactions with Unknown Items...');
    const transactions = await Transaction.find({
      'items.name': 'Unknown Item'
    }).lean();

    console.log(`   Found ${transactions.length} transactions with Unknown Items\n`);

    if (transactions.length === 0) {
      console.log('✅ No Unknown Items found - database is clean!');
      await mongoose.disconnect();
      return;
    }

    let totalFixed = 0;
    let totalNotFound = 0;
    const fixedTransactions: string[] = [];
    const notFoundItems: Array<{ txn: string; qty: number; price: number }> = [];

    for (const txn of transactions) {
      const txnNumber = txn.transactionNumber;
      const csvItemsForTxn = lookupMap.get(txnNumber) || [];

      let txnModified = false;
      const updates: Array<{ index: number; oldName: string; newName: string }> = [];

      for (let i = 0; i < txn.items.length; i++) {
        const item = txn.items[i];

        if (item.name === 'Unknown Item') {
          // Try to find matching item in CSV
          const matchingCSV = findMatchingCSVItem(
            csvItemsForTxn,
            item.quantity,
            item.unitPrice
          );

          if (matchingCSV) {
            const newName = getItemName(matchingCSV);
            if (newName) {
              updates.push({
                index: i,
                oldName: item.name,
                newName: newName
              });
              totalFixed++;
              txnModified = true;
            } else {
              totalNotFound++;
              notFoundItems.push({ txn: txnNumber, qty: item.quantity, price: item.unitPrice });
            }
          } else {
            totalNotFound++;
            notFoundItems.push({ txn: txnNumber, qty: item.quantity, price: item.unitPrice });
          }
        }
      }

      if (txnModified) {
        fixedTransactions.push(txnNumber);

        console.log(`\n📋 ${txnNumber}:`);
        for (const update of updates) {
          console.log(`   Item ${update.index + 1}: "${update.oldName}" → "${update.newName}"`);
        }

        if (!DRY_RUN) {
          // Apply updates to database
          const updateOps: Record<string, string> = {};
          for (const update of updates) {
            updateOps[`items.${update.index}.name`] = update.newName;
          }

          await Transaction.updateOne(
            { _id: txn._id },
            { $set: updateOps }
          );
        }
      }
    }

    console.log('\n' + '═'.repeat(80));
    console.log('  SUMMARY');
    console.log('═'.repeat(80));
    console.log(`\n✅ Fixed: ${totalFixed} items in ${fixedTransactions.length} transactions`);

    if (totalNotFound > 0) {
      console.log(`\n⚠️  Could not find CSV match for ${totalNotFound} items:`);
      for (const item of notFoundItems.slice(0, 10)) {
        console.log(`   - ${item.txn}: qty=${item.qty}, price=$${item.price.toFixed(2)}`);
      }
      if (notFoundItems.length > 10) {
        console.log(`   ... and ${notFoundItems.length - 10} more`);
      }
    }

    if (DRY_RUN) {
      console.log('\n⚠️  DRY RUN - No changes were saved. Run without --dry-run to apply fixes.');
    } else {
      console.log('\n✅ All changes have been saved to the database.');
    }

    await mongoose.disconnect();
    console.log('\nDone!');

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixUnknownItems();
