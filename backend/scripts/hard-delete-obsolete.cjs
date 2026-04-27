/**
 * Hard-delete products that the Excel marks as Remarks="Obsolete".
 *
 * Read-only by default; pass --execute to delete.
 *
 * Reports references in dependent collections (bundles, blendtemplates,
 * customblendhistories, inventorymovements, transactions, refunds) so you
 * can see the blast radius before applying.
 *
 * Usage:
 *   node scripts/hard-delete-obsolete.cjs --db l2l_prod
 *   node scripts/hard-delete-obsolete.cjs --db l2l_prod --execute
 */
const path = require('path');
const XLSX = require('xlsx');
const mongoose = require('mongoose');

if (!process.env.MONGODB_URI) {
  try { require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') }); } catch (_) {}
}
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const TARGET_DB = arg('--db');
const EXECUTE = process.argv.includes('--execute');
const EXCEL_PATH = arg('--excel', 'C:/Users/BEM ORCHESTRATOR/Downloads/stockdata24042026.xlsx');

if (!TARGET_DB) { console.error('Missing --db'); process.exit(1); }

const norm = (s) => (s == null ? '' : String(s)).trim();
const nlower = (s) => norm(s).toLowerCase();

(async () => {
  // 1) Read Excel and collect obsolete SKUs/names
  const wb = XLSX.readFile(EXCEL_PATH);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
  const obsolete = []; // {row, name, sku}
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const remarks = norm(r['Remarks ']);
    if (remarks.toLowerCase() !== 'obsolete') continue;
    const name = norm(r['Name change ']) || norm(r['Product Name']);
    const sku = norm(r.SKU);
    if (!name && !sku) continue;
    obsolete.push({ row: i + 2, name, sku });
  }

  console.log(`Excel rows marked Obsolete: ${obsolete.length}`);
  console.log('='.repeat(70));
  console.log(` HARD-DELETE OBSOLETE — db=${TARGET_DB}  mode=${EXECUTE ? '🔴 EXECUTE' : '🟡 DRY-RUN'}`);
  console.log('='.repeat(70));

  await mongoose.connect(process.env.MONGODB_URI, { dbName: TARGET_DB });
  const db = mongoose.connection.db;

  // 2) Find matching products
  const skuList = obsolete.map(o => o.sku).filter(Boolean);
  const nameList = obsolete.map(o => o.name).filter(Boolean);

  const matches = await db.collection('products').find({
    $or: [
      { sku: { $in: skuList } },
      { name: { $in: nameList } },
    ],
  }).toArray();

  // De-dupe by _id
  const byId = new Map();
  for (const p of matches) byId.set(String(p._id), p);
  const products = [...byId.values()];

  console.log(`Matched products in DB: ${products.length}`);
  console.log('');

  // 3) Count references for each product
  const collections = [
    { name: 'bundles', field: 'productId' },              // ObjectId ref
    { name: 'bundles_subProducts', collection: 'bundles', field: 'subProducts.productId' },
    { name: 'blendtemplates', field: 'ingredients.productId' },
    { name: 'customblendhistories', field: 'ingredients.productId' },
    { name: 'inventorymovements', field: 'productId' },
    { name: 'transactions', field: 'items.productId', isString: true },
    { name: 'refunds', field: 'productId', isString: true },
  ];

  const report = [];
  for (const p of products) {
    const id = p._id;
    const idStr = String(p._id);
    const refs = {};
    let totalRefs = 0;
    for (const c of collections) {
      const col = c.collection || c.name;
      const filter = { [c.field]: c.isString ? idStr : id };
      try {
        const n = await db.collection(col).countDocuments(filter);
        refs[c.name] = n;
        totalRefs += n;
      } catch {
        refs[c.name] = '?';
      }
    }
    report.push({ id: idStr, name: p.name, sku: p.sku, isDeleted: !!p.isDeleted, refs, totalRefs });
  }

  // Print report
  for (const r of report) {
    const refsStr = Object.entries(r.refs).filter(([_, v]) => v).map(([k, v]) => `${k}=${v}`).join(', ') || '(no refs)';
    console.log(`  sku=${r.sku.padEnd(34)} ${r.isDeleted ? '[soft-deleted] ' : ''}"${r.name}"`);
    console.log(`     id=${r.id}  refs: ${refsStr}`);
  }

  // Identify Excel obsolete rows that didn't match any DB product
  const matchedSkus = new Set(products.map(p => nlower(p.sku)));
  const matchedNames = new Set(products.map(p => nlower(p.name)));
  const unmatched = obsolete.filter(o => !matchedSkus.has(nlower(o.sku)) && !matchedNames.has(nlower(o.name)));
  if (unmatched.length) {
    console.log(`\n── Excel obsolete rows with no DB match (skipped) ──`);
    for (const o of unmatched) console.log(`  row ${o.row} sku=${o.sku} "${o.name}"`);
  }

  if (!EXECUTE) {
    console.log(`\n🟡 DRY-RUN — no deletes. Re-run with --execute.`);
    await mongoose.disconnect();
    return;
  }

  // 4) Execute
  console.log('\n🔴 EXECUTING hard delete…');
  let deleted = 0;
  for (const r of report) {
    const res = await db.collection('products').deleteOne({ _id: new mongoose.Types.ObjectId(r.id) });
    deleted += res.deletedCount;
    console.log(`  ✗ deleted sku=${r.sku} name="${r.name}" deletedCount=${res.deletedCount}`);
  }
  console.log(`\nTotal deleted from products: ${deleted}`);
  console.log(`Note: references in transactions/refunds (string SKUs) and inventorymovements (ObjectId) remain as historical records.`);
  await mongoose.disconnect();
})().catch(async (e) => { console.error(e); try { await mongoose.disconnect(); } catch (_) {} process.exit(1); });
