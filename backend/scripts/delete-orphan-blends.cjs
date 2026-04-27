/**
 * Delete blend templates whose ingredients reference product IDs that
 * don't exist in the products collection. Read-only by default.
 *
 * Usage:
 *   node scripts/delete-orphan-blends.cjs --db l2l_prod
 *   node scripts/delete-orphan-blends.cjs --db l2l_prod --execute
 */
const path = require('path');
const mongoose = require('mongoose');

if (!process.env.MONGODB_URI) {
  try { require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') }); } catch (_) {}
}
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const TARGET_DB = arg('--db');
const EXECUTE = process.argv.includes('--execute');
if (!TARGET_DB) { console.error('Missing --db'); process.exit(1); }

(async () => {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: TARGET_DB });
  const db = mongoose.connection.db;

  const products = await db.collection('products').find({}, { projection: { _id: 1 } }).toArray();
  const liveIds = new Set(products.map(p => String(p._id)));

  const blends = await db.collection('blendtemplates').find({}).toArray();
  const orphans = [];
  for (const b of blends) {
    const orphanIngs = (b.ingredients || []).filter(i => i.productId && !liveIds.has(String(i.productId)));
    if (orphanIngs.length) orphans.push({ id: b._id, name: b.name, count: orphanIngs.length });
  }

  console.log(`db=${TARGET_DB}  blend templates: ${blends.length}, orphaned: ${orphans.length}`);
  for (const o of orphans) console.log(`  - "${o.name}" (${String(o.id)}) → ${o.count} orphan ingredient(s)`);

  if (!EXECUTE) {
    console.log('\n🟡 DRY-RUN — re-run with --execute to delete.');
    await mongoose.disconnect();
    return;
  }
  console.log('\n🔴 EXECUTING…');
  for (const o of orphans) {
    const r = await db.collection('blendtemplates').deleteOne({ _id: o.id });
    console.log(`  ✗ deleted "${o.name}" (${r.deletedCount})`);
  }
  await mongoose.disconnect();
})().catch(async (e) => { console.error(e); try { await mongoose.disconnect(); } catch (_) {} process.exit(1); });
