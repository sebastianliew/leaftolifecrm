/**
 * For every product in the target DB with currentStock <= 0, look up the
 * Excel Current Stock value and classify:
 *   - excel-also-zero          → consistent
 *   - excel-also-empty         → Excel has nothing tracked, treat as unknown
 *   - excel-positive           → Excel says we have stock; DB says we don't
 *   - not-in-excel             → DB has it but Excel doesn't list it
 *
 * Read-only.
 *
 * Usage:
 *   node scripts/compare-out-of-stock.cjs --db l2l_prod
 *   node scripts/compare-out-of-stock.cjs --db l2l_prod --json out.json
 */
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const mongoose = require('mongoose');

if (!process.env.MONGODB_URI) {
  try { require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') }); } catch (_) {}
}

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const TARGET_DB = arg('--db', 'l2l_prod');
const EXCEL_PATH = arg('--excel', 'C:/Users/BEM ORCHESTRATOR/Downloads/stockdata24042026.xlsx');
const JSON_OUT = arg('--json');

const norm = (s) => (s == null ? '' : String(s)).trim();
const nlower = (s) => norm(s).toLowerCase();

(async () => {
  const wb = XLSX.readFile(EXCEL_PATH);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });

  // Index Excel by SKU and by name
  const excelBySku = new Map();
  const excelByName = new Map();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const sku = norm(r.SKU);
    const name = norm(r['Name change ']) || norm(r['Product Name']);
    const stock = r['Current Stock'];
    const rec = { row: i + 2, name, sku, stock };
    if (sku) excelBySku.set(nlower(sku), rec);
    if (name && !excelByName.has(nlower(name))) excelByName.set(nlower(name), rec);
  }

  await mongoose.connect(process.env.MONGODB_URI, { dbName: TARGET_DB });
  const db = mongoose.connection.db;

  const oos = await db.collection('products').find(
    { currentStock: { $lte: 0 }, isDeleted: { $ne: true } },
    { projection: { name: 1, sku: 1, currentStock: 1, availableStock: 1, looseStock: 1 } }
  ).toArray();

  const buckets = {
    'excel-also-zero': [],
    'excel-also-empty': [],
    'excel-positive': [],
    'not-in-excel': [],
  };

  for (const p of oos) {
    const ex = (p.sku && excelBySku.get(nlower(p.sku))) || excelByName.get(nlower(p.name));
    if (!ex) {
      buckets['not-in-excel'].push({ id: String(p._id), name: p.name, sku: p.sku, dbStock: p.currentStock });
      continue;
    }
    const v = ex.stock;
    const numeric = typeof v === 'number' ? v : (v === '' ? null : Number(String(v).trim()));
    if (numeric === null || (typeof v === 'string' && norm(v) === '')) {
      buckets['excel-also-empty'].push({ name: p.name, sku: p.sku, excelRow: ex.row, dbStock: p.currentStock, excelStock: '' });
    } else if (Number.isFinite(numeric) && numeric === 0) {
      buckets['excel-also-zero'].push({ name: p.name, sku: p.sku, excelRow: ex.row, dbStock: p.currentStock, excelStock: numeric });
    } else if (Number.isFinite(numeric) && numeric > 0) {
      buckets['excel-positive'].push({ name: p.name, sku: p.sku, excelRow: ex.row, dbStock: p.currentStock, excelStock: numeric });
    } else {
      buckets['excel-also-empty'].push({ name: p.name, sku: p.sku, excelRow: ex.row, dbStock: p.currentStock, excelStock: String(v) });
    }
  }

  console.log('='.repeat(70));
  console.log(` OUT-OF-STOCK COMPARISON — db=${TARGET_DB}`);
  console.log('='.repeat(70));
  console.log(`DB out-of-stock products (currentStock <= 0, not deleted): ${oos.length}`);
  console.log('');
  console.log(`  excel-also-zero    : ${buckets['excel-also-zero'].length}  (consistent)`);
  console.log(`  excel-also-empty   : ${buckets['excel-also-empty'].length}  (Excel cell blank — unknown)`);
  console.log(`  excel-positive     : ${buckets['excel-positive'].length}  (Excel says in stock, DB says zero)`);
  console.log(`  not-in-excel       : ${buckets['not-in-excel'].length}  (DB product not in Excel)`);

  for (const [label, list] of Object.entries(buckets)) {
    if (!list.length) continue;
    console.log(`\n── ${label.toUpperCase()} ──`);
    for (const x of list) {
      const tag = x.excelRow ? `excel row ${x.excelRow}` : '';
      const ex = 'excelStock' in x ? `excel=${JSON.stringify(x.excelStock)}` : '';
      console.log(`  sku=${x.sku || '-'}  "${x.name}"  db=${x.dbStock}  ${ex}  ${tag}`.trim());
    }
  }

  if (JSON_OUT) {
    fs.writeFileSync(JSON_OUT, JSON.stringify({ db: TARGET_DB, totalOos: oos.length, buckets }, null, 2));
    console.log(`\nFull JSON: ${JSON_OUT}`);
  }

  await mongoose.disconnect();
})().catch(async (e) => { console.error(e); try { await mongoose.disconnect(); } catch (_) {} process.exit(1); });
