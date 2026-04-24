/**
 * One-off migration: strip orphan reorder fields and drop the stale indexes
 * that went with them when the reorder system was retired.
 *
 * What this touches:
 *   - products.{reorderPoint, autoReorderEnabled, restockFrequency}   ← $unset
 *   - bundles.reorderPoint                                            ← $unset
 *   - index products.currentStock_1_reorderPoint_1                    ← drop
 *   - index products.autoReorderEnabled_1_lastRestockDate_1           ← drop
 *
 * Safety:
 *   - Default mode is DRY-RUN. You must pass `--execute` to issue writes.
 *   - All operations are idempotent: re-running after success is a no-op.
 *   - Reads MONGODB_URI from backend/.env.local unless MONGODB_URI is set
 *     in the shell environment (which takes precedence). To target prod:
 *       MONGODB_URI='mongodb+srv://...l2l_prod?...' npx tsx scripts/migrate-reorder-removal.ts
 *
 * Usage (from backend/):
 *   # 1. Dry run (default). Prints what would happen, writes nothing.
 *   npx tsx scripts/migrate-reorder-removal.ts
 *
 *   # 2. Execute against the database that MONGODB_URI points to.
 *   npx tsx scripts/migrate-reorder-removal.ts --execute
 *
 *   # 3. Execute against prod explicitly (recommended form — URI is visible):
 *   MONGODB_URI='mongodb+srv://...l2l_prod?...' \
 *     npx tsx scripts/migrate-reorder-removal.ts --execute
 */

import dns from 'node:dns';
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Shell MONGODB_URI wins over .env.local so you can point at prod without
// editing files. dotenv.config() with override:false is the default.
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI not set (check backend/.env.local or the shell env).');
  process.exit(1);
}

const EXECUTE = process.argv.includes('--execute');

function redact(u: string): string {
  return u.replace(/(mongodb(\+srv)?:\/\/)[^:]+:[^@]+@/, '$1***:***@');
}

const STALE_PRODUCT_INDEXES = [
  'currentStock_1_reorderPoint_1',
  'autoReorderEnabled_1_lastRestockDate_1',
];

async function main() {
  const banner = EXECUTE ? 'EXECUTE — writes will be issued' : 'DRY-RUN — no writes (pass --execute to write)';
  console.log(`[migrate] ${banner}`);
  console.log(`[migrate] Target: ${redact(uri!)}`);
  console.log();

  await mongoose.connect(uri!, { serverSelectionTimeoutMS: 15_000 });
  const db = mongoose.connection.db!;
  console.log(`[migrate] Connected to database: ${db.databaseName}\n`);

  const products = db.collection('products');
  const bundles = db.collection('bundles');

  // ── Step 1: count documents that still carry the fields ───────────
  const beforeProducts = await products.countDocuments({
    $or: [
      { reorderPoint: { $exists: true } },
      { autoReorderEnabled: { $exists: true } },
      { restockFrequency: { $exists: true } },
    ],
  });
  const beforeBundles = await bundles.countDocuments({ reorderPoint: { $exists: true } });
  console.log(`[migrate] Products needing $unset: ${beforeProducts}`);
  console.log(`[migrate] Bundles needing $unset:  ${beforeBundles}`);

  // ── Step 2: list indexes that will be dropped ──────────────────────
  const currentProductIndexes = await products.indexes();
  const currentIndexNames = new Set(currentProductIndexes.map((i) => i.name));
  const indexesToDrop = STALE_PRODUCT_INDEXES.filter((n) => currentIndexNames.has(n));
  console.log(`[migrate] Stale indexes to drop:   ${indexesToDrop.length === 0 ? '(none)' : indexesToDrop.join(', ')}`);
  console.log();

  // ── Step 3: execute (or preview) ───────────────────────────────────
  if (!EXECUTE) {
    console.log('[migrate] Preview — would run:');
    if (beforeProducts > 0) {
      console.log('  db.products.updateMany(');
      console.log("    { $or: [{ reorderPoint: { $exists: true } }, { autoReorderEnabled: { $exists: true } }, { restockFrequency: { $exists: true } }] },");
      console.log("    { $unset: { reorderPoint: '', autoReorderEnabled: '', restockFrequency: '' } }");
      console.log('  )');
    }
    if (beforeBundles > 0) {
      console.log('  db.bundles.updateMany(');
      console.log("    { reorderPoint: { $exists: true } },");
      console.log("    { $unset: { reorderPoint: '' } }");
      console.log('  )');
    }
    for (const ix of indexesToDrop) {
      console.log(`  db.products.dropIndex('${ix}')`);
    }
    if (beforeProducts === 0 && beforeBundles === 0 && indexesToDrop.length === 0) {
      console.log('  (nothing to do — database is already clean)');
    }
    console.log('\n[migrate] Re-run with --execute to apply.');
    await mongoose.disconnect();
    return;
  }

  // Writes — idempotent. All re-runnable safely.
  const productResult = await products.updateMany(
    {
      $or: [
        { reorderPoint: { $exists: true } },
        { autoReorderEnabled: { $exists: true } },
        { restockFrequency: { $exists: true } },
      ],
    },
    { $unset: { reorderPoint: '', autoReorderEnabled: '', restockFrequency: '' } },
  );
  console.log(`[migrate] products: matched=${productResult.matchedCount} modified=${productResult.modifiedCount}`);

  const bundleResult = await bundles.updateMany(
    { reorderPoint: { $exists: true } },
    { $unset: { reorderPoint: '' } },
  );
  console.log(`[migrate] bundles:  matched=${bundleResult.matchedCount} modified=${bundleResult.modifiedCount}`);

  for (const ix of indexesToDrop) {
    try {
      await products.dropIndex(ix);
      console.log(`[migrate] dropped index: ${ix}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('index not found')) {
        console.log(`[migrate] index already absent: ${ix}`);
      } else {
        console.error(`[migrate] dropIndex ${ix} FAILED: ${msg}`);
        throw err;
      }
    }
  }

  // ── Step 4: verify ─────────────────────────────────────────────────
  const afterProducts = await products.countDocuments({
    $or: [
      { reorderPoint: { $exists: true } },
      { autoReorderEnabled: { $exists: true } },
      { restockFrequency: { $exists: true } },
    ],
  });
  const afterBundles = await bundles.countDocuments({ reorderPoint: { $exists: true } });
  const afterProductIndexes = await products.indexes();
  const remainingStale = STALE_PRODUCT_INDEXES.filter((n) =>
    afterProductIndexes.some((i) => i.name === n),
  );

  console.log();
  console.log('[migrate] post-migration counts:');
  console.log(`  products with any residue: ${afterProducts}  (expected 0)`);
  console.log(`  bundles with reorderPoint: ${afterBundles}  (expected 0)`);
  console.log(`  stale indexes remaining:   ${remainingStale.length === 0 ? '(none)' : remainingStale.join(', ')}  (expected none)`);

  if (afterProducts === 0 && afterBundles === 0 && remainingStale.length === 0) {
    console.log('\n[migrate] ✅ complete.');
  } else {
    console.log('\n[migrate] ⚠️  incomplete — re-run or investigate.');
    process.exitCode = 1;
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('[migrate] FAILED:', err);
  process.exit(1);
});
