/**
 * READ-ONLY diagnostic for leftover reorder fields + indexes.
 *
 * Reports:
 *   - How many `products` docs still have `reorderPoint`, `autoReorderEnabled`,
 *     or `restockFrequency`.
 *   - How many `bundles` docs still have `reorderPoint`.
 *   - The current list of indexes on both collections (so we can spot the
 *     stale compound indexes that mongoose no longer knows about).
 *
 * No writes. No `$unset`. No `dropIndex`. Safe to run against production.
 *
 * Usage (from backend/ dir):
 *   npx tsx scripts/diagnose-reorder-residue.ts
 *
 * It reads MONGODB_URI from backend/.env.local — same as the running backend.
 */

import dns from 'node:dns';
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI not set in backend/.env.local');
  process.exit(1);
}

function redact(u: string): string {
  return u.replace(/(mongodb(\+srv)?:\/\/)[^:]+:[^@]+@/, '$1***:***@');
}

async function main() {
  console.log(`[diagnose] Connecting to: ${redact(uri!)}`);
  console.log('[diagnose] READ-ONLY — no writes will be issued.\n');

  await mongoose.connect(uri!, {
    serverSelectionTimeoutMS: 15_000,
    readPreference: 'secondaryPreferred', // prefer secondary to reduce primary load
  });

  const db = mongoose.connection.db!;
  const dbName = db.databaseName;
  console.log(`[diagnose] Connected to database: ${dbName}\n`);

  const products = db.collection('products');
  const bundles = db.collection('bundles');

  // ── Field residue ───────────────────────────────────────────────
  const [
    totalProducts,
    productsWithReorderPoint,
    productsWithAutoReorder,
    productsWithRestockFreq,
    totalBundles,
    bundlesWithReorderPoint,
  ] = await Promise.all([
    products.countDocuments({}),
    products.countDocuments({ reorderPoint: { $exists: true } }),
    products.countDocuments({ autoReorderEnabled: { $exists: true } }),
    products.countDocuments({ restockFrequency: { $exists: true } }),
    bundles.countDocuments({}),
    bundles.countDocuments({ reorderPoint: { $exists: true } }),
  ]);

  console.log('── products ────────────────────────────────────────');
  console.log(`  total docs:                  ${totalProducts}`);
  console.log(`  with reorderPoint:           ${productsWithReorderPoint}`);
  console.log(`  with autoReorderEnabled:     ${productsWithAutoReorder}`);
  console.log(`  with restockFrequency:       ${productsWithRestockFreq}`);
  console.log();
  console.log('── bundles ─────────────────────────────────────────');
  console.log(`  total docs:                  ${totalBundles}`);
  console.log(`  with reorderPoint:           ${bundlesWithReorderPoint}`);
  console.log();

  // ── Samples (first 3 of each, redacted to just _id + the offending field) ──
  if (productsWithReorderPoint > 0) {
    console.log('── products sample (first 3 with reorderPoint) ─────');
    const sample = await products
      .find({ reorderPoint: { $exists: true } }, { projection: { _id: 1, name: 1, reorderPoint: 1, autoReorderEnabled: 1, restockFrequency: 1 } })
      .limit(3)
      .toArray();
    for (const doc of sample) {
      console.log(`  ${String(doc._id)}  name="${(doc as { name?: string }).name ?? '?'}"  reorderPoint=${(doc as { reorderPoint?: number }).reorderPoint}  autoReorderEnabled=${(doc as { autoReorderEnabled?: boolean }).autoReorderEnabled}  restockFrequency=${(doc as { restockFrequency?: number }).restockFrequency}`);
    }
    console.log();
  }

  // ── Indexes ─────────────────────────────────────────────────────
  const productIndexes = await products.indexes();
  const bundleIndexes = await bundles.indexes();

  const staleProductIndexes = productIndexes.filter((ix) => {
    const keys = Object.keys(ix.key || {});
    return keys.includes('reorderPoint') || keys.includes('autoReorderEnabled') || keys.includes('restockFrequency');
  });

  console.log('── products indexes referencing reorder fields ─────');
  if (staleProductIndexes.length === 0) {
    console.log('  (none — good)');
  } else {
    for (const ix of staleProductIndexes) {
      console.log(`  name=${ix.name}  key=${JSON.stringify(ix.key)}`);
    }
  }
  console.log();

  const staleBundleIndexes = bundleIndexes.filter((ix) =>
    Object.keys(ix.key || {}).includes('reorderPoint'),
  );
  console.log('── bundles indexes referencing reorder fields ──────');
  if (staleBundleIndexes.length === 0) {
    console.log('  (none — good)');
  } else {
    for (const ix of staleBundleIndexes) {
      console.log(`  name=${ix.name}  key=${JSON.stringify(ix.key)}`);
    }
  }
  console.log();

  // ── Verdict ─────────────────────────────────────────────────────
  const anyFieldResidue =
    productsWithReorderPoint + productsWithAutoReorder + productsWithRestockFreq + bundlesWithReorderPoint > 0;
  const anyStaleIndex = staleProductIndexes.length + staleBundleIndexes.length > 0;

  console.log('── verdict ─────────────────────────────────────────');
  if (!anyFieldResidue && !anyStaleIndex) {
    console.log('  CLEAN — no migration needed.');
  } else {
    if (anyFieldResidue) console.log('  RESIDUE — one or more docs still carry removed fields.');
    if (anyStaleIndex) console.log('  STALE INDEX — at least one index still references a removed field.');
    console.log('  A one-off migration is recommended but not urgent; reads already ignore the fields.');
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('[diagnose] FAILED:', err);
  process.exit(1);
});
