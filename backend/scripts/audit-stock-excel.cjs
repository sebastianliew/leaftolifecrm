/**
 * Audit script — read-only.
 *
 * For every row in the stockdata Excel:
 *  1. Confirm the product exists in l2l_prod (matched by SKU first, then name).
 *  2. Confirm Category, Container Type, and Unit on the DB record match the
 *     Excel value exactly (case-sensitive). Empty Excel value must mean
 *     null/missing on the product.
 *
 * Usage:
 *   MONGODB_URI="..." node scripts/audit-stock-excel.cjs
 *   MONGODB_URI="..." node scripts/audit-stock-excel.cjs --excel "C:/path/to/file.xlsx"
 *   MONGODB_URI="..." node scripts/audit-stock-excel.cjs --json out.json
 */
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const mongoose = require('mongoose');

if (!process.env.MONGODB_URI) {
  try { require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') }); } catch (_) {}
}

const TARGET_DB = (() => {
  const i = process.argv.indexOf('--db');
  return i >= 0 ? process.argv[i + 1] : 'l2l_prod';
})();
const EXCEL_PATH = (() => {
  const i = process.argv.indexOf('--excel');
  return i >= 0 ? process.argv[i + 1] : 'C:/Users/BEM ORCHESTRATOR/Downloads/stockdata24042026.xlsx';
})();
const JSON_OUT = (() => {
  const i = process.argv.indexOf('--json');
  return i >= 0 ? process.argv[i + 1] : null;
})();

function norm(s) {
  return (s == null ? '' : String(s)).trim();
}
function nlower(s) {
  return norm(s).toLowerCase();
}

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI not set.');
    process.exit(1);
  }

  console.log(`Reading Excel: ${EXCEL_PATH}`);
  if (!fs.existsSync(EXCEL_PATH)) {
    console.error(`File not found: ${EXCEL_PATH}`);
    process.exit(1);
  }
  const wb = XLSX.readFile(EXCEL_PATH);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  console.log(`Excel rows: ${rows.length} (sheet: ${wb.SheetNames[0]})`);

  await mongoose.connect(process.env.MONGODB_URI, { dbName: TARGET_DB });
  console.log(`Connected to ${TARGET_DB}\n`);

  const db = mongoose.connection.db;

  // Load lookup collections directly (avoid loading the full Mongoose model graph)
  const [categories, containerTypes, units, products] = await Promise.all([
    db.collection('categories').find({}, { projection: { name: 1 } }).toArray(),
    db.collection('containertypes').find({}, { projection: { name: 1 } }).toArray(),
    db.collection('unitofmeasurements').find({}, { projection: { name: 1, abbreviation: 1 } }).toArray(),
    db.collection('products').find({}, {
      projection: {
        name: 1, sku: 1, category: 1, containerType: 1, unitOfMeasurement: 1,
        isDeleted: 1, isActive: 1, status: 1
      }
    }).toArray(),
  ]);

  console.log(`DB counts — categories: ${categories.length}, containerTypes: ${containerTypes.length}, units: ${units.length}, products: ${products.length}\n`);

  // Build id → name maps
  const catById = new Map(categories.map(c => [String(c._id), c.name]));
  const ctById = new Map(containerTypes.map(c => [String(c._id), c.name]));
  const unitById = new Map(units.map(u => [String(u._id), { name: u.name, abbreviation: u.abbreviation }]));

  // Build product lookup maps
  const bySku = new Map();
  const byName = new Map();
  for (const p of products) {
    if (p.sku) bySku.set(nlower(p.sku), p);
    if (p.name) {
      const k = nlower(p.name);
      // Keep the first; stash duplicates separately for warning
      if (!byName.has(k)) byName.set(k, p);
    }
  }

  const missing = [];
  const mismatches = [];
  const matchedSoftDeleted = [];
  let matched = 0;
  let skippedEmpty = 0;

  for (let idx = 0; idx < rows.length; idx++) {
    const r = rows[idx];
    const excelRowNumber = idx + 2; // sheet header is row 1
    const productName = norm(r['Product Name']);
    const nameChange = norm(r['Name change ']);
    const effectiveName = nameChange || productName;
    const sku = norm(r['SKU']);
    const excelCat = norm(r['Category']);
    const excelCt = norm(r['Container Type']);
    const excelUnit = norm(r['Unit']);

    if (!productName && !sku) { skippedEmpty++; continue; }

    // Find DB product
    let p = sku ? bySku.get(nlower(sku)) : null;
    let matchedBy = p ? 'sku' : null;
    if (!p && effectiveName) {
      p = byName.get(nlower(effectiveName));
      if (p) matchedBy = 'name';
    }
    if (!p && productName && productName !== effectiveName) {
      p = byName.get(nlower(productName));
      if (p) matchedBy = 'name(original)';
    }

    if (!p) {
      missing.push({ row: excelRowNumber, productName, sku, excelCat, excelCt, excelUnit });
      continue;
    }

    matched++;
    if (p.isDeleted) {
      matchedSoftDeleted.push({ row: excelRowNumber, productName, sku, dbName: p.name, dbSku: p.sku });
    }

    // Resolve DB names
    const dbCat = p.category ? (catById.get(String(p.category)) || '') : '';
    const dbCt = p.containerType ? (ctById.get(String(p.containerType)) || '') : '';
    const dbUnitObj = p.unitOfMeasurement ? unitById.get(String(p.unitOfMeasurement)) : null;
    const dbUnitName = dbUnitObj ? dbUnitObj.name : '';
    const dbUnitAbbr = dbUnitObj ? dbUnitObj.abbreviation : '';

    const issues = [];
    if (excelCat !== dbCat) issues.push({ field: 'Category', excel: excelCat, db: dbCat });
    if (excelCt !== dbCt) issues.push({ field: 'Container Type', excel: excelCt, db: dbCt });
    // Unit: Excel "Unit" can match DB unit name OR abbreviation exactly.
    if (excelUnit !== dbUnitName && excelUnit !== dbUnitAbbr) {
      issues.push({ field: 'Unit', excel: excelUnit, db: dbUnitName + (dbUnitAbbr ? ` (${dbUnitAbbr})` : '') });
    }
    if (issues.length) {
      mismatches.push({
        row: excelRowNumber,
        productName: effectiveName,
        sku,
        dbSku: p.sku,
        matchedBy,
        issues,
      });
    }
  }

  // ── Output ──
  const lines = [];
  const log = (s) => { console.log(s); lines.push(s); };

  log('='.repeat(70));
  log(' STOCK EXCEL AUDIT — l2l_prod');
  log('='.repeat(70));
  log(`Excel rows scanned : ${rows.length}`);
  log(`  empty rows skipped: ${skippedEmpty}`);
  log(`  matched in DB    : ${matched}`);
  log(`  missing from DB  : ${missing.length}`);
  log(`  field mismatches : ${mismatches.length}`);
  log(`  matched but soft-deleted: ${matchedSoftDeleted.length}`);
  log('');

  if (missing.length) {
    log('─── MISSING PRODUCTS (in Excel, not in l2l_prod) ───');
    for (const m of missing) {
      log(`  row ${m.row}: "${m.productName}" sku="${m.sku}" cat="${m.excelCat}" container="${m.excelCt}" unit="${m.excelUnit}"`);
    }
    log('');
  }

  if (matchedSoftDeleted.length) {
    log('─── MATCHED BUT SOFT-DELETED (isDeleted=true) ───');
    for (const m of matchedSoftDeleted) {
      log(`  row ${m.row}: "${m.productName}" sku="${m.sku}" → DB sku="${m.dbSku}"`);
    }
    log('');
  }

  if (mismatches.length) {
    // Group by field for digestibility
    const byField = { 'Category': [], 'Container Type': [], 'Unit': [] };
    for (const m of mismatches) {
      for (const i of m.issues) byField[i.field].push({ ...m, issue: i });
    }
    for (const field of Object.keys(byField)) {
      const list = byField[field];
      if (!list.length) continue;
      log(`─── ${field.toUpperCase()} MISMATCHES (${list.length}) ───`);
      for (const m of list) {
        log(`  row ${m.row}: "${m.productName}" [sku ${m.sku || m.dbSku}]`);
        log(`     excel: "${m.issue.excel}"`);
        log(`     db   : "${m.issue.db}"`);
      }
      log('');
    }
  }

  if (!missing.length && !mismatches.length) {
    log('✅ All products found and all Category / Container Type / Unit values match exactly.');
  }

  if (JSON_OUT) {
    fs.writeFileSync(JSON_OUT, JSON.stringify({
      summary: {
        rowsScanned: rows.length,
        emptyRowsSkipped: skippedEmpty,
        matched, missingCount: missing.length, mismatchCount: mismatches.length,
        matchedSoftDeletedCount: matchedSoftDeleted.length,
      },
      missing, mismatches, matchedSoftDeleted,
    }, null, 2));
    log(`\nFull JSON written to ${JSON_OUT}`);
  }

  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error('Error:', e);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
