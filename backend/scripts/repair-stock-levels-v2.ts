/**
 * Repair Script V2 (TARGETED): Fix incorrectly corrected inventory movements
 * 
 * TARGETED approach:
 * - Only corrects movements where we CAN match the transaction and determine saleType
 * - Only recalculates stock for products where ALL movements were successfully matched
 * - For products with unmatched movements, fixes individual movements but SKIPS stock recalc
 * 
 * Safety: DRY RUN by default. Use --execute to apply.
 */

import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env.local') });

import mongoose from 'mongoose';
import dns from 'dns';

dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const EXECUTE_MODE = process.argv.includes('--execute');

interface MovementResult {
  movementId: string;
  reference: string;
  saleType: string | null;
  oldConverted: number;
  newConverted: number;
  matched: boolean;
}

interface ProductReport {
  name: string;
  containerCapacity: number;
  totalMovements: number;
  matchedMovements: number;
  unmatchedMovements: number;
  correctedMovements: number;
  allMatched: boolean;
  oldStock: number;
  newStock: number | null; // null = skipped recalc
  stockDiff: number | null;
}

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set in .env.local');

  await mongoose.connect(uri);
  console.log(`✅ Connected to MongoDB\n`);
  console.log(EXECUTE_MODE
    ? '🔴 EXECUTE MODE — Changes WILL be written'
    : '🟡 DRY RUN MODE — No changes will be made');
  console.log('');

  const Products = mongoose.connection.collection('products');
  const Movements = mongoose.connection.collection('inventorymovements');
  const Transactions = mongoose.connection.collection('transactions');

  const products = await Products.find({
    containerCapacity: { $gt: 1 },
    isDeleted: { $ne: true }
  }).toArray();

  console.log(`Found ${products.length} products with containerCapacity > 1\n`);

  let totalCorrected = 0;
  let totalStockRecalculated = 0;
  let totalStockSkipped = 0;
  const reports: ProductReport[] = [];

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const cap = product.containerCapacity;
    const name = product.name;

    const movements = await Movements.find({ productId: product._id }).toArray();
    if (movements.length === 0) continue;

    console.log(`[${i + 1}/${products.length}] ${name} (cap: ${cap}, movements: ${movements.length})`);

    let matched = 0;
    let unmatched = 0;
    let corrected = 0;
    const corrections: Map<string, number> = new Map(); // movementId -> newConvertedQty

    for (const mov of movements) {
      if (!mov.reference) {
        // No reference = manual/system movement, can't match
        unmatched++;
        continue;
      }

      const txn = await Transactions.findOne({ transactionNumber: mov.reference });
      if (!txn) {
        unmatched++;
        continue;
      }

      const item = txn.items?.find((it: any) =>
        it.productId?.toString() === product._id.toString()
      );
      if (!item) {
        unmatched++;
        continue;
      }

      matched++;
      const saleType = item.saleType;

      let correctQty: number;
      if (saleType === 'quantity') {
        correctQty = mov.quantity * cap;
      } else if (saleType === 'volume') {
        correctQty = mov.quantity;
      } else {
        // Unknown saleType — treat as matched but don't correct
        continue;
      }

      if (mov.convertedQuantity !== correctQty) {
        corrections.set(mov._id.toString(), correctQty);
        corrected++;
        totalCorrected++;

        if (EXECUTE_MODE) {
          await Movements.updateOne(
            { _id: mov._id },
            { $set: { convertedQuantity: correctQty } }
          );
        }
      }
    }

    const allMatched = unmatched === 0;
    let newStock: number | null = null;
    let stockDiff: number | null = null;

    // Only recalculate stock if ALL movements were matched
    if (allMatched && movements.length > 0) {
      let calcStock = 0;
      for (const m of movements) {
        const correctedQty = corrections.get(m._id.toString());
        const qty = correctedQty !== undefined ? correctedQty : (m.convertedQuantity || m.quantity);

        const deductTypes = ['sale', 'fixed_blend', 'bundle_sale', 'bundle_blend_ingredient', 'blend_ingredient', 'custom_blend'];
        if (deductTypes.includes(m.movementType)) {
          calcStock -= qty;
        } else if (m.movementType === 'return') {
          calcStock += qty;
        } else if (m.movementType === 'adjustment') {
          calcStock += qty;
        } else if (m.movementType !== 'transfer') {
          calcStock += qty;
        }
      }

      newStock = calcStock;
      stockDiff = calcStock - product.currentStock;

      if (stockDiff !== 0 && EXECUTE_MODE) {
        await Products.updateOne(
          { _id: product._id },
          { $set: { currentStock: calcStock, availableStock: calcStock } }
        );
      }

      if (stockDiff !== 0) totalStockRecalculated++;
    } else if (unmatched > 0) {
      totalStockSkipped++;
    }

    if (corrected > 0 || (stockDiff !== null && stockDiff !== 0)) {
      const status = allMatched ? '✅ FULL' : '⚠️  PARTIAL (movements only)';
      console.log(`  ${status} — ${corrected} movements corrected, ${unmatched} unmatched`);
      if (stockDiff !== null && stockDiff !== 0) {
        console.log(`  Stock: ${product.currentStock} → ${newStock} (${stockDiff > 0 ? '+' : ''}${stockDiff})`);
      }
    }

    reports.push({
      name, containerCapacity: cap,
      totalMovements: movements.length, matchedMovements: matched,
      unmatchedMovements: unmatched, correctedMovements: corrected,
      allMatched, oldStock: product.currentStock,
      newStock, stockDiff
    });
  }

  // ═══════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════
  console.log('\n' + '='.repeat(100));
  console.log('TARGETED REPAIR SUMMARY');
  console.log('='.repeat(100));
  console.log(`Products examined: ${products.length}`);
  console.log(`Movements corrected: ${totalCorrected}`);
  console.log(`Products with stock recalculated: ${totalStockRecalculated}`);
  console.log(`Products with stock skipped (unmatched movements): ${totalStockSkipped}`);

  // Products where we corrected movements AND recalculated stock
  const fullFixes = reports.filter(r => r.allMatched && r.correctedMovements > 0 && r.stockDiff !== 0);
  if (fullFixes.length > 0) {
    console.log('\n✅ FULLY REPAIRED (movements + stock recalculated):');
    console.log(`${'Product'.padEnd(45)} ${'Cap'.padStart(5)} ${'Fixed'.padStart(7)} ${'Old Stock'.padStart(12)} ${'New Stock'.padStart(12)} ${'Diff'.padStart(10)}`);
    console.log('-'.repeat(95));
    for (const r of fullFixes.sort((a, b) => Math.abs(b.stockDiff!) - Math.abs(a.stockDiff!))) {
      console.log(
        `${r.name.substring(0, 44).padEnd(45)} ${String(r.containerCapacity).padStart(5)} ${String(r.correctedMovements).padStart(7)} ${String(r.oldStock).padStart(12)} ${String(r.newStock).padStart(12)} ${String(r.stockDiff! > 0 ? '+' + r.stockDiff : r.stockDiff).padStart(10)}`
      );
    }
  }

  // Products where we corrected movements but COULDN'T recalculate stock
  const partialFixes = reports.filter(r => !r.allMatched && r.correctedMovements > 0);
  if (partialFixes.length > 0) {
    console.log('\n⚠️  PARTIAL REPAIR (movements fixed, stock NOT recalculated — has unmatched movements):');
    console.log(`${'Product'.padEnd(45)} ${'Cap'.padStart(5)} ${'Fixed'.padStart(7)} ${'Unmatched'.padStart(10)} ${'Total Mvmts'.padStart(12)}`);
    console.log('-'.repeat(85));
    for (const r of partialFixes.sort((a, b) => b.correctedMovements - a.correctedMovements)) {
      console.log(
        `${r.name.substring(0, 44).padEnd(45)} ${String(r.containerCapacity).padStart(5)} ${String(r.correctedMovements).padStart(7)} ${String(r.unmatchedMovements).padStart(10)} ${String(r.totalMovements).padStart(12)}`
      );
    }
    console.log('\n⚠️  These products need MANUAL stock verification by the client.');
  }

  console.log('\n' + '='.repeat(100));
  if (EXECUTE_MODE) {
    console.log('✅ TARGETED REPAIRS APPLIED');
  } else {
    console.log('🟡 DRY RUN COMPLETE — No changes were made');
    console.log('   Run with --execute flag to apply changes');
  }
  console.log('='.repeat(100));

  await mongoose.disconnect();
  console.log('\n✅ Disconnected from MongoDB');
}

run().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
