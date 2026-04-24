/**
 * Idempotent helper for issue #21: enable canSellLoose on every product whose
 * category name matches a loose-friendly dosage form (tablets, capsules, liquids,
 * drops, syrup, …). Front desk asked that B-Destress-style bottles be sellable
 * by the capsule without manually toggling each product.
 *
 * Also flips `defaultCanSellLoose` on those categories so new products created
 * under them inherit the toggle (see Category.defaultCanSellLoose).
 *
 * Dry-run by default. Pass --commit to actually write.
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { Product } from '../models/Product.js';
import { Category } from '../models/Category.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const LOOSE_FRIENDLY_PATTERNS = [
  /tablet/i,
  /capsule/i,
  /caplet/i,
  /softgel/i,
  /liquid/i,
  /syrup/i,
  /drops?/i,
  /solution/i,
  /tincture/i,
  /oil/i,
];

const commit = process.argv.includes('--commit');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || '');
  console.log(`Connected. Mode: ${commit ? 'COMMIT' : 'DRY RUN'}`);

  const categories = await Category.find({ isActive: true });
  const looseCategoryIds: mongoose.Types.ObjectId[] = [];

  for (const cat of categories) {
    const matches = LOOSE_FRIENDLY_PATTERNS.some((re) => re.test(cat.name));
    if (matches) looseCategoryIds.push(cat._id);
  }

  console.log(`\nLoose-friendly categories (${looseCategoryIds.length}):`);
  categories
    .filter((c) => looseCategoryIds.some((id) => id.equals(c._id)))
    .forEach((c) => console.log(`  - ${c.name}${c.defaultCanSellLoose ? ' (already flagged)' : ''}`));

  if (commit) {
    const catResult = await Category.updateMany(
      { _id: { $in: looseCategoryIds }, defaultCanSellLoose: { $ne: true } },
      { $set: { defaultCanSellLoose: true } },
    );
    console.log(`\nCategories updated: ${catResult.modifiedCount}`);
  }

  const candidateProducts = await Product.find({
    category: { $in: looseCategoryIds },
    canSellLoose: { $ne: true },
    isDeleted: { $ne: true },
  }).select('name sku category canSellLoose containerCapacity');

  console.log(`\nProducts to flip canSellLoose → true: ${candidateProducts.length}`);
  candidateProducts.slice(0, 20).forEach((p) => console.log(`  - ${p.name} (${p.sku})`));
  if (candidateProducts.length > 20) console.log(`  … and ${candidateProducts.length - 20} more`);

  if (commit) {
    const prodResult = await Product.updateMany(
      {
        category: { $in: looseCategoryIds },
        canSellLoose: { $ne: true },
        isDeleted: { $ne: true },
      },
      { $set: { canSellLoose: true } },
    );
    console.log(`\nProducts updated: ${prodResult.modifiedCount}`);
  } else {
    console.log('\nDry run complete. Re-run with --commit to apply.');
  }

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
