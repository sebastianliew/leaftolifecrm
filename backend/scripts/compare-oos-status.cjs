/**
 * For each DB out-of-stock product, show what the Excel Status / Remarks /
 * Current Stock columns say. Read-only.
 */
const path = require('path');
const XLSX = require('xlsx');
const mongoose = require('mongoose');

if (!process.env.MONGODB_URI) {
  try { require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') }); } catch (_) {}
}
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const TARGET_DB = arg('--db', 'l2l_prod');
const EXCEL_PATH = arg('--excel', 'C:/Users/BEM ORCHESTRATOR/Downloads/stockdata24042026.xlsx');

const norm = (s) => (s == null ? '' : String(s)).trim();
const nlower = (s) => norm(s).toLowerCase();

(async () => {
  const wb = XLSX.readFile(EXCEL_PATH);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
  const bySku = new Map();
  const byName = new Map();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const sku = norm(r.SKU);
    const name = norm(r['Name change ']) || norm(r['Product Name']);
    const rec = {
      row: i + 2,
      name, sku,
      stock: r['Current Stock'],
      status: norm(r['Status']),
      remarks: norm(r['Remarks ']),
    };
    if (sku) bySku.set(nlower(sku), rec);
    if (name && !byName.has(nlower(name))) byName.set(nlower(name), rec);
  }

  await mongoose.connect(process.env.MONGODB_URI, { dbName: TARGET_DB });
  const db = mongoose.connection.db;
  const oos = await db.collection('products').find(
    { currentStock: { $lte: 0 }, isDeleted: { $ne: true } },
    { projection: { name: 1, sku: 1, currentStock: 1 } }
  ).toArray();

  // Tally
  const statusCounts = new Map();
  const remarksCounts = new Map();
  let withStockNumber = 0;
  let withEmptyStock = 0;
  for (const p of oos) {
    const ex = bySku.get(nlower(p.sku)) || byName.get(nlower(p.name));
    const status = ex ? (ex.status || '(blank)') : '(not in excel)';
    const remarks = ex ? (ex.remarks || '(blank)') : '(not in excel)';
    statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
    remarksCounts.set(remarks, (remarksCounts.get(remarks) || 0) + 1);
    if (ex && norm(ex.stock) !== '') withStockNumber++;
    else if (ex) withEmptyStock++;
  }

  console.log('='.repeat(70));
  console.log(` OOS-vs-EXCEL STATUS  db=${TARGET_DB}  total=${oos.length}`);
  console.log('='.repeat(70));
  console.log(`  Excel Current Stock has a value : ${withStockNumber}`);
  console.log(`  Excel Current Stock is blank    : ${withEmptyStock}`);
  console.log('');
  console.log('Excel "Status" column distribution:');
  for (const [k, v] of [...statusCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${v.toString().padStart(4)}  ${k}`);
  }
  console.log('');
  console.log('Excel "Remarks" column distribution:');
  for (const [k, v] of [...remarksCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${v.toString().padStart(4)}  ${k}`);
  }

  // Show the products grouped by Remarks since that's likely the OOS signal
  const byRemarks = new Map();
  for (const p of oos) {
    const ex = bySku.get(nlower(p.sku)) || byName.get(nlower(p.name));
    const k = ex ? (ex.remarks || '(blank)') : '(not in excel)';
    if (!byRemarks.has(k)) byRemarks.set(k, []);
    byRemarks.get(k).push({ name: p.name, sku: p.sku, dbStock: p.currentStock, excelStatus: ex?.status || '', excelStock: ex?.stock });
  }
  for (const [k, list] of byRemarks) {
    console.log(`\n── Remarks="${k}" (${list.length}) ──`);
    for (const x of list.slice(0, 10)) {
      console.log(`  ${(x.sku || '-').padEnd(30)} db=${x.dbStock}  excelStock=${JSON.stringify(x.excelStock)}  status="${x.excelStatus}"  ${x.name}`);
    }
    if (list.length > 10) console.log(`  …and ${list.length - 10} more`);
  }

  await mongoose.disconnect();
})().catch(async (e) => { console.error(e); try { await mongoose.disconnect(); } catch (_) {} process.exit(1); });
