/**
 * Read-only. Find blend templates and bundles that reference product IDs
 * that no longer exist in the products collection.
 */
const path = require('path');
const mongoose = require('mongoose');

if (!process.env.MONGODB_URI) {
  try { require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') }); } catch (_) {}
}
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const TARGET_DB = arg('--db');
if (!TARGET_DB) { console.error('Missing --db'); process.exit(1); }

(async () => {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: TARGET_DB });
  const db = mongoose.connection.db;

  const products = await db.collection('products').find({}, { projection: { _id: 1 } }).toArray();
  const liveIds = new Set(products.map(p => String(p._id)));

  console.log(`db=${TARGET_DB}  live products: ${liveIds.size}`);

  // Blend templates
  const blends = await db.collection('blendtemplates').find({}).toArray();
  const orphanBlends = [];
  for (const b of blends) {
    const orphans = (b.ingredients || []).filter(i => i.productId && !liveIds.has(String(i.productId)));
    if (orphans.length) orphanBlends.push({ id: String(b._id), name: b.name, orphanCount: orphans.length, orphanIds: orphans.map(o => String(o.productId)) });
  }
  console.log(`\nBlend templates with orphan product refs: ${orphanBlends.length}`);
  for (const b of orphanBlends) {
    console.log(`  blend "${b.name}" (${b.id}) → ${b.orphanCount} orphan ingredient(s): ${b.orphanIds.join(', ')}`);
  }

  // Bundles
  const bundles = await db.collection('bundles').find({}).toArray();
  const orphanBundles = [];
  for (const b of bundles) {
    const orphans = [];
    if (b.productId && !liveIds.has(String(b.productId))) orphans.push(String(b.productId));
    for (const sp of (b.subProducts || [])) {
      if (sp.productId && !liveIds.has(String(sp.productId))) orphans.push(String(sp.productId));
    }
    if (orphans.length) orphanBundles.push({ id: String(b._id), name: b.name, orphanCount: orphans.length, orphanIds: orphans });
  }
  console.log(`\nBundles with orphan product refs: ${orphanBundles.length}`);
  for (const b of orphanBundles) {
    console.log(`  bundle "${b.name}" (${b.id}) → ${b.orphanCount} orphan(s): ${b.orphanIds.join(', ')}`);
  }

  await mongoose.disconnect();
})().catch(async (e) => { console.error(e); try { await mongoose.disconnect(); } catch (_) {} process.exit(1); });
