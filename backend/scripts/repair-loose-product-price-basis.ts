/**
 * Repair loose-sell products that were entered with per-unit prices in the
 * canonical per-container fields.
 *
 * Dry-run by default:
 *   npx tsx scripts/repair-loose-product-price-basis.ts
 *
 * Apply reviewed products only:
 *   npx tsx scripts/repair-loose-product-price-basis.ts --execute --ids=id1,id2
 */

import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { Product } from '../models/Product.js';
import { roundMoney } from '../services/productPricingPolicy.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const EXECUTE_MODE = process.argv.includes('--execute');
const idsArg = process.argv.find(arg => arg.startsWith('--ids='));
const REVIEWED_IDS = new Set(
  idsArg
    ? idsArg.slice('--ids='.length).split(',').map(id => id.trim()).filter(Boolean)
    : []
);

async function run() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI not set');
  await mongoose.connect(process.env.MONGODB_URI);

  const suspects = await Product.find({
    isDeleted: { $ne: true },
    canSellLoose: true,
    containerCapacity: { $gt: 1 },
    sellingPrice: { $gt: 0, $lt: 1 },
  }).select('_id name sku sellingPrice costPrice containerCapacity migrationData').lean();

  console.log(`Mode: ${EXECUTE_MODE ? 'EXECUTE' : 'DRY RUN'}`);
  console.log(`Suspect loose products: ${suspects.length}`);

  for (const product of suspects) {
    const id = String(product._id);
    const cap = product.containerCapacity || 1;
    const nextSellingPrice = roundMoney((product.sellingPrice || 0) * cap);
    const nextCostPrice = product.costPrice == null ? undefined : roundMoney(product.costPrice * cap);
    const reviewed = REVIEWED_IDS.has(id);

    console.log([
      reviewed ? '[reviewed]' : '[dry]',
      product.name,
      `sku=${product.sku}`,
      `id=${id}`,
      `selling ${product.sellingPrice} -> ${nextSellingPrice}`,
      product.costPrice == null ? 'cost unchanged' : `cost ${product.costPrice} -> ${nextCostPrice}`,
      `capacity=${cap}`,
    ].join(' | '));

    if (!EXECUTE_MODE) continue;
    if (!reviewed) continue;

    await Product.updateOne(
      { _id: product._id, 'migrationData.originalData.priceBasisRepair.appliedAt': { $exists: false } },
      {
        $set: {
          sellingPrice: nextSellingPrice,
          ...(nextCostPrice !== undefined ? { costPrice: nextCostPrice } : {}),
          'migrationData.originalData.priceBasisRepair': {
            appliedAt: new Date(),
            reason: 'Converted loose product per-unit price to canonical per-container price',
            originalSellingPrice: product.sellingPrice,
            originalCostPrice: product.costPrice,
            originalContainerCapacity: cap,
            repairedSellingPrice: nextSellingPrice,
            repairedCostPrice: nextCostPrice,
          },
        },
      },
    );
  }

  if (EXECUTE_MODE && REVIEWED_IDS.size === 0) {
    console.warn('No --ids supplied; no products were updated.');
  }

  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
