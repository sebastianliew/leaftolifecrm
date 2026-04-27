/**
 * Replace l2l_dev catalog collections with the contents of l2l_prod.
 *
 * SYNCED collections (drop + bulk-insert, preserving prod _id values):
 *   - products
 *   - categories
 *   - containertypes
 *   - unitofmeasurements
 *   - brands
 *   - suppliers
 *   - blendtemplates
 *   - bundles
 *
 * NOT TOUCHED in dev:
 *   - users, patients, transactions, refunds, inventorymovements,
 *     adminActivityLogs, userAuditLogs, customblendhistories, etc.
 *
 * Read-only by default; pass --execute to apply.
 */
const path = require('path');
const mongoose = require('mongoose');

if (!process.env.MONGODB_URI) {
  try { require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') }); } catch (_) {}
}
const EXECUTE = process.argv.includes('--execute');

const COLLECTIONS = [
  'products',
  'categories',
  'containertypes',
  'unitofmeasurements',
  'brands',
  'suppliers',
  'blendtemplates',
  'bundles',
];

const SOURCE = 'l2l_prod';
const TARGET = 'l2l_dev';

(async () => {
  console.log('='.repeat(70));
  console.log(` SYNC ${TARGET} ← ${SOURCE}   mode=${EXECUTE ? '🔴 EXECUTE' : '🟡 DRY-RUN'}`);
  console.log('='.repeat(70));

  // Connect using two clients: same URI, different dbName.
  const srcConn = await mongoose.createConnection(process.env.MONGODB_URI, { dbName: SOURCE }).asPromise();
  const tgtConn = await mongoose.createConnection(process.env.MONGODB_URI, { dbName: TARGET }).asPromise();
  const src = srcConn.db;
  const tgt = tgtConn.db;

  for (const c of COLLECTIONS) {
    const before = await tgt.collection(c).countDocuments();
    const srcCount = await src.collection(c).countDocuments();
    console.log(`\n${c}:  ${SOURCE}=${srcCount}   ${TARGET}=${before}  (target will become ${srcCount})`);

    if (!EXECUTE) continue;

    // Pull all docs from prod
    const docs = await src.collection(c).find({}).toArray();

    // Drop the entire dev collection (and its indexes) — dev had stricter
    // unique constraints than prod on some fields (e.g. bundles.sku) that
    // would reject prod's data.
    try {
      await tgt.collection(c).drop();
    } catch (err) {
      // Collection may not exist yet — that's fine.
      if (err.codeName !== 'NamespaceNotFound') throw err;
    }

    if (docs.length === 0) {
      console.log(`  (source empty — ${TARGET}.${c} is now empty)`);
      continue;
    }

    // Bulk insert preserving _id
    const res = await tgt.collection(c).insertMany(docs, { ordered: false });
    console.log(`  ✔ replaced ${TARGET}.${c}: inserted ${res.insertedCount}`);
  }

  await srcConn.close();
  await tgtConn.close();

  if (!EXECUTE) console.log(`\n🟡 DRY-RUN — re-run with --execute to apply.`);
  else console.log(`\n✅ done.`);
})().catch(async (e) => {
  console.error('Error:', e);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
