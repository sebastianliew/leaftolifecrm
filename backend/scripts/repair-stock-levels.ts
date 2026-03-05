/**
 * Repair Script: Fix over-deducted stock levels
 * 
 * Problem: convertedQuantity was set to quantity × containerCapacity instead of quantity.
 * The backend deducts convertedQuantity from currentStock (which tracks loose units).
 * This caused massive over-deductions across 258+ movements.
 *
 * This script:
 * 1. Finds all affected movements (convertedQuantity = quantity × containerCapacity)
 * 2. Fixes each movement's convertedQuantity to equal quantity
 * 3. Recalculates currentStock for each affected product from ALL movements
 * 
 * Run with --dry-run first to preview changes, then without to apply.
 */
import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env.local') });

import mongoose from 'mongoose';
import dns from 'dns';

dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const DRY_RUN = process.argv.includes('--dry-run');

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set');

  await mongoose.connect(uri);
  console.log(`✅ Connected to MongoDB ${DRY_RUN ? '(DRY RUN — no changes will be made)' : '(LIVE — changes will be applied)'}\n`);

  const Products = mongoose.connection.collection('products');
  const Movements = mongoose.connection.collection('inventorymovements');

  // Step 1: Find all products with containerCapacity > 1
  const products = await Products.find({
    containerCapacity: { $gt: 1 },
    isDeleted: { $ne: true }
  }).toArray();

  console.log(`Found ${products.length} products with containerCapacity > 1\n`);

  let totalMovementsFixed = 0;
  let totalProductsFixed = 0;
  const repairs: Array<{
    name: string;
    oldStock: number;
    newStock: number;
    movementsFixed: number;
    totalExcessReversed: number;
  }> = [];

  for (const product of products) {
    // Find over-deducted sale movements for this product
    const badMovements = await Movements.find({
      productId: product._id,
      movementType: { $in: ['sale', 'bundle_sale'] },
      quantity: { $gt: 0 },
      $expr: {
        $and: [
          { $gt: ['$convertedQuantity', '$quantity'] },
          { $eq: ['$convertedQuantity', { $multiply: ['$quantity', product.containerCapacity] }] }
        ]
      }
    }).toArray();

    if (badMovements.length === 0) continue;

    // Calculate total excess deduction
    let totalExcess = 0;
    for (const m of badMovements) {
      const correctConverted = m.quantity;
      const excess = m.convertedQuantity - correctConverted;
      totalExcess += excess;
    }

    // Step 2: Fix each movement's convertedQuantity
    if (!DRY_RUN) {
      for (const m of badMovements) {
        await Movements.updateOne(
          { _id: m._id },
          { $set: { convertedQuantity: m.quantity } }
        );
      }
    }

    // Step 3: Recalculate stock from ALL movements for this product
    // Instead of just adding back the excess (which could miss other issues),
    // we recalculate from scratch using corrected movement data
    const allMovements = await Movements.find({ productId: product._id }).toArray();

    let calculatedStock = 0;
    // We need a baseline — find the earliest restock/adjustment or assume 0
    // Actually, we need to account for restocks too. Let's sum all movements.
    for (const m of allMovements) {
      // Use the CORRECTED convertedQuantity for bad movements
      const isBadMovement = badMovements.some(bm => bm._id.equals(m._id));
      const qty = isBadMovement ? m.quantity : (m.convertedQuantity || m.quantity);

      switch (m.movementType) {
        case 'sale':
        case 'fixed_blend':
        case 'bundle_sale':
        case 'bundle_blend_ingredient':
        case 'blend_ingredient':
        case 'custom_blend':
          calculatedStock -= qty;
          break;
        case 'return':
        case 'adjustment':
        case 'restock':
        case 'initial':
          calculatedStock += qty;
          break;
        // transfer: no change
      }
    }

    const oldStock = product.currentStock;

    // Only update if there's actually a difference
    if (oldStock !== calculatedStock || badMovements.length > 0) {
      if (!DRY_RUN) {
        await Products.updateOne(
          { _id: product._id },
          { $set: { currentStock: calculatedStock, availableStock: calculatedStock } }
        );
      }

      repairs.push({
        name: product.name,
        oldStock,
        newStock: calculatedStock,
        movementsFixed: badMovements.length,
        totalExcessReversed: totalExcess,
      });

      totalMovementsFixed += badMovements.length;
      totalProductsFixed++;
    }
  }

  // Print results
  console.log('='.repeat(90));
  console.log(`${DRY_RUN ? 'PREVIEW' : 'APPLIED'}: Stock Level Repairs`);
  console.log('='.repeat(90));
  console.log(`${'Product'.padEnd(40)} ${'Old Stock'.padStart(12)} ${'New Stock'.padStart(12)} ${'Moves Fixed'.padStart(12)} ${'Excess'.padStart(12)}`);
  console.log('-'.repeat(90));

  for (const r of repairs.sort((a, b) => b.totalExcessReversed - a.totalExcessReversed)) {
    const stockDiff = r.newStock - r.oldStock;
    console.log(
      `${r.name.substring(0, 39).padEnd(40)} ${String(r.oldStock).padStart(12)} ${String(r.newStock).padStart(12)} ${String(r.movementsFixed).padStart(12)} ${('+' + r.totalExcessReversed).padStart(12)}`
    );
  }

  console.log('-'.repeat(90));
  console.log(`TOTAL: ${totalProductsFixed} products, ${totalMovementsFixed} movements fixed`);
  
  if (DRY_RUN) {
    console.log('\n⚠️  This was a DRY RUN. No changes were made.');
    console.log('   Run without --dry-run to apply the fixes.');
  } else {
    console.log('\n✅ All repairs applied successfully.');
  }

  await mongoose.disconnect();
}

run().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
