/**
 * Reconcile a target DB against the stock Excel.
 *
 *   Modes:
 *     --dry-run  (default) — print the plan, change nothing
 *     --execute            — apply the plan
 *
 *   Required:
 *     --db l2l_prod | l2l_dev
 *
 *   Optional:
 *     --excel "C:/path/file.xlsx"
 *     --json out.json
 *
 * Decisions baked in:
 *   - Excel rows with empty Product Name AND empty SKU are skipped.
 *   - Junk rows (TEST_BULK_DELETE, THROW_*, malformed Glycetract cell) are
 *     skipped with a warning rather than created.
 *   - For missing CONSULT_* rows lacking Cat/Unit, default Cat=General Unit=Unit
 *     (mirrors existing consultation products).
 *   - Ref name lookup is case-insensitive; create-with-verbatim if no match.
 *     Existing refs are NEVER renamed (preserves products outside the Excel).
 *   - Soft-deleted products that match an Excel row are un-deleted.
 */
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const mongoose = require('mongoose');

if (!process.env.MONGODB_URI) {
  try { require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') }); } catch (_) {}
}

const argv = process.argv.slice(2);
function arg(name, fallback) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : fallback;
}
const TARGET_DB = arg('--db');
const EXECUTE = argv.includes('--execute');
const EXCEL_PATH = arg('--excel', 'C:/Users/BEM ORCHESTRATOR/Downloads/stockdata24042026.xlsx');
const JSON_OUT = arg('--json');

if (!TARGET_DB) {
  console.error('Missing --db l2l_prod|l2l_dev');
  process.exit(1);
}

// ── Junk skip rules ──
const SKIP_SKUS = new Set(['TEST-BULK-001', 'THROW-20260316180826', 'UNK-GL-001', 'UNK-MH-001']);
function isMalformedNameCell(name) {
  // Heuristic: a Product Name cell containing many commas + numbers is a
  // CSV row that got pasted into a single column. Block creation.
  return name.includes(',') && name.split(',').length > 5;
}

// ── Defaults for missing CONSULT_* rows ──
// Other CONSULT_* rows in the same Excel use Cat="Consult" / Unit="Unit",
// so default the empty-cat consultation rows to those values for consistency.
const CONSULT_DEFAULT_CATEGORY = 'Consult';
const CONSULT_DEFAULT_UNIT = 'Unit';

function norm(s) { return (s == null ? '' : String(s)).trim(); }
function nlower(s) { return norm(s).toLowerCase(); }

async function main() {
  if (!process.env.MONGODB_URI) { console.error('MONGODB_URI not set.'); process.exit(1); }

  console.log(`Reading Excel: ${EXCEL_PATH}`);
  if (!fs.existsSync(EXCEL_PATH)) { console.error(`File not found: ${EXCEL_PATH}`); process.exit(1); }
  const wb = XLSX.readFile(EXCEL_PATH);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  await mongoose.connect(process.env.MONGODB_URI, { dbName: TARGET_DB });
  console.log(`\n${'='.repeat(70)}`);
  console.log(` STOCK FIX — db=${TARGET_DB} mode=${EXECUTE ? '🔴 EXECUTE' : '🟡 DRY-RUN'}`);
  console.log(`${'='.repeat(70)}\n`);
  const db = mongoose.connection.db;

  const cats = await db.collection('categories').find({}).toArray();
  const cts = await db.collection('containertypes').find({}).toArray();
  const units = await db.collection('unitofmeasurements').find({}).toArray();
  const products = await db.collection('products').find({}).toArray();

  // ID → doc (used to read the CURRENT name on a product).
  const catById = new Map(cats.map(c => [String(c._id), c]));
  const ctById = new Map(cts.map(c => [String(c._id), c]));
  const unitById = new Map(units.map(u => [String(u._id), u]));

  // EXACT case-sensitive lookup. Excel is source of truth — if Excel has
  // "Tea" we want a doc named exactly "Tea", not "tea" or "TEA".
  const catByExact = new Map();
  for (const c of cats) if (!catByExact.has(c.name)) catByExact.set(c.name, c);
  const ctByExact = new Map();
  for (const c of cts) if (!ctByExact.has(c.name)) ctByExact.set(c.name, c);
  const unitByExact = new Map();
  for (const u of units) {
    if (!unitByExact.has(u.name)) unitByExact.set(u.name, u);
    if (u.abbreviation && !unitByExact.has(u.abbreviation)) {
      unitByExact.set(u.abbreviation, u);
    }
  }
  const bySku = new Map();
  const byName = new Map();
  for (const p of products) {
    if (p.sku) bySku.set(nlower(p.sku), p);
    if (p.name && !byName.has(nlower(p.name))) byName.set(nlower(p.name), p);
  }

  // Plan accumulators.
  // Maps keyed by EXACT (case-sensitive) value → display name (also exact).
  // The Excel is the source of truth: if Excel has "tea"/"Tea"/"TEA",
  // we create three separate refs to match verbatim.
  const planCreateCategory = new Map();
  const planCreateContainer = new Map();
  const planCreateUnit = new Map();
  function planAdd(map, name) {
    if (!map.has(name)) map.set(name, name);
    return map.get(name);
  }
  const planCreateProduct = []; // {name, sku, cat, ct, unit, row}
  const planUpdateProduct = []; // {productId, sku, name, sets:{}, oldVals:{}, row}
  const planUndelete = [];      // {productId, sku, name}
  const skipped = [];           // {row, reason, ...}

  // Resolve refs lazily — track names to create. Returns:
  //   {kind:'existing', doc} | {kind:'toCreate', name} | {kind:'empty'}
  function resolveCat(name) {
    const n = norm(name);
    if (!n) return { kind: 'empty' };
    const hit = catByExact.get(n);
    if (hit) return { kind: 'existing', doc: hit };
    const exact = planAdd(planCreateCategory, n);
    return { kind: 'toCreate', name: exact };
  }
  function resolveCt(name) {
    const n = norm(name);
    if (!n) return { kind: 'empty' };
    const hit = ctByExact.get(n);
    if (hit) return { kind: 'existing', doc: hit };
    const exact = planAdd(planCreateContainer, n);
    return { kind: 'toCreate', name: exact };
  }
  function resolveUnit(name) {
    const n = norm(name);
    if (!n) return { kind: 'empty' };
    const hit = unitByExact.get(n);
    if (hit) return { kind: 'existing', doc: hit };
    const exact = planAdd(planCreateUnit, n);
    return { kind: 'toCreate', name: exact };
  }

  // Walk Excel rows
  for (let idx = 0; idx < rows.length; idx++) {
    const r = rows[idx];
    const rowN = idx + 2;
    const productName = norm(r['Product Name']);
    const nameChange = norm(r['Name change ']);
    const effectiveName = nameChange || productName;
    const sku = norm(r['SKU']);
    let excelCat = norm(r['Category']);
    const excelCt = norm(r['Container Type']);
    let excelUnit = norm(r['Unit']);

    if (!productName && !sku) continue;

    // SKU-based junk skip
    if (sku && SKIP_SKUS.has(sku)) {
      skipped.push({ row: rowN, sku, name: productName, reason: `SKU is in skip list` });
      continue;
    }
    if (productName && isMalformedNameCell(productName)) {
      skipped.push({ row: rowN, sku, name: productName.slice(0, 60) + '…', reason: 'product name cell looks like a flattened CSV row' });
      continue;
    }

    // Find existing
    let p = sku ? bySku.get(nlower(sku)) : null;
    if (!p && effectiveName) p = byName.get(nlower(effectiveName));
    if (!p && productName && productName !== effectiveName) p = byName.get(nlower(productName));

    // Apply CONSULT_* defaults if creating and Cat/Unit empty
    const isConsult = sku.startsWith('CONSULT_');
    if (!p && isConsult && !excelCat) excelCat = CONSULT_DEFAULT_CATEGORY;
    if (!p && isConsult && !excelUnit) excelUnit = CONSULT_DEFAULT_UNIT;

    if (!p) {
      // CREATE plan
      if (!excelCat || !excelUnit) {
        skipped.push({ row: rowN, sku, name: productName, reason: `cannot create: missing required ${!excelCat ? 'Category' : ''}${!excelCat && !excelUnit ? '+' : ''}${!excelUnit ? 'Unit' : ''}` });
        continue;
      }
      const catRes = resolveCat(excelCat);
      const ctRes = resolveCt(excelCt);
      const unitRes = resolveUnit(excelUnit);
      planCreateProduct.push({
        row: rowN, name: effectiveName, sku, isConsult,
        cat: catRes, ct: ctRes, unit: unitRes,
      });
      continue;
    }

    // UPDATE plan
    const sets = {};
    const oldVals = {};

    // Un-delete if needed
    if (p.isDeleted) {
      planUndelete.push({ productId: p._id, sku: p.sku, name: p.name, row: rowN });
    }

    // Current names on the product (via id→doc maps, tolerant of duplicate refs).
    const curCat = p.category ? (catById.get(String(p.category))?.name || '') : '';
    const curCt = p.containerType ? (ctById.get(String(p.containerType))?.name || '') : '';
    const curUnitDoc = p.unitOfMeasurement ? unitById.get(String(p.unitOfMeasurement)) : null;
    const curUnitName = curUnitDoc?.name || '';
    const curUnitAbbr = curUnitDoc?.abbreviation || '';

    // Category — change if current name doesn't EXACTLY match excel.
    // Excel is source of truth; "tea" and "Tea" are different categories.
    if (excelCat && curCat !== excelCat) {
      const catRes = resolveCat(excelCat);
      if (catRes.kind === 'existing') {
        sets.category = catRes.doc._id;
        sets.categoryName = catRes.doc.name;
        oldVals.category = `${curCat} (${String(p.category)})`;
      } else {
        sets.__catName = catRes.name;
        oldVals.category = `${curCat} (${String(p.category)})`;
      }
    }
    // (Empty Excel cat → leave product's current category alone — required field.)

    // Container type — exact case match.
    if (!excelCt) {
      if (p.containerType) {
        sets.containerType = null;
        oldVals.containerType = `${curCt} (${String(p.containerType)})`;
      }
    } else if (curCt !== excelCt) {
      const ctRes = resolveCt(excelCt);
      if (ctRes.kind === 'existing') {
        sets.containerType = ctRes.doc._id;
        oldVals.containerType = `${curCt} (${String(p.containerType || '')})`;
      } else {
        sets.__ctName = ctRes.name;
        oldVals.containerType = `${curCt} (${String(p.containerType || '')})`;
      }
    }

    // Unit — exact case match against name or abbreviation.
    if (excelUnit) {
      const matchesCurrent = curUnitName === excelUnit || curUnitAbbr === excelUnit;
      if (!matchesCurrent) {
        const unitRes = resolveUnit(excelUnit);
        if (unitRes.kind === 'existing') {
          sets.unitOfMeasurement = unitRes.doc._id;
          sets.unitName = unitRes.doc.name;
          oldVals.unitOfMeasurement = `${curUnitName} (${String(p.unitOfMeasurement)})`;
        } else {
          sets.__unitName = unitRes.name;
          oldVals.unitOfMeasurement = `${curUnitName} (${String(p.unitOfMeasurement)})`;
        }
      }
    }

    if (Object.keys(sets).length) {
      planUpdateProduct.push({ productId: p._id, sku: p.sku, name: p.name, sets, oldVals, row: rowN });
    }
  }

  // ── Print the plan ──
  console.log(`Excel rows scanned : ${rows.length}`);
  console.log(`Plan:`);
  console.log(`  create categories       : ${planCreateCategory.size}  ${[...planCreateCategory.values()].map(s => JSON.stringify(s)).join(', ')}`);
  console.log(`  create container types  : ${planCreateContainer.size}  ${[...planCreateContainer.values()].map(s => JSON.stringify(s)).join(', ')}`);
  console.log(`  create units            : ${planCreateUnit.size}  ${[...planCreateUnit.values()].map(s => JSON.stringify(s)).join(', ')}`);
  console.log(`  create products         : ${planCreateProduct.length}`);
  console.log(`  update products         : ${planUpdateProduct.length}`);
  console.log(`  un-delete products      : ${planUndelete.length}`);
  console.log(`  skipped rows            : ${skipped.length}`);

  if (skipped.length) {
    console.log(`\n── SKIPPED ──`);
    for (const s of skipped) console.log(`  row ${s.row} sku=${s.sku || '-'} name="${s.name}" → ${s.reason}`);
  }
  if (planCreateProduct.length) {
    console.log(`\n── PRODUCTS TO CREATE ──`);
    for (const c of planCreateProduct) {
      const catLabel = c.cat.kind === 'existing' ? c.cat.doc.name : `+create:${c.cat.name}`;
      const ctLabel = c.ct.kind === 'empty' ? '-' : (c.ct.kind === 'existing' ? c.ct.doc.name : `+create:${c.ct.name}`);
      const unitLabel = c.unit.kind === 'existing' ? c.unit.doc.name : `+create:${c.unit.name}`;
      console.log(`  row ${c.row} sku=${c.sku} "${c.name}" cat=${catLabel} ct=${ctLabel} unit=${unitLabel}`);
    }
  }
  if (planUndelete.length) {
    console.log(`\n── PRODUCTS TO UN-DELETE ──`);
    for (const u of planUndelete) console.log(`  row ${u.row} sku=${u.sku} "${u.name}"`);
  }
  if (planUpdateProduct.length) {
    console.log(`\n── PRODUCTS TO UPDATE (refs only) ──`);
    for (const u of planUpdateProduct) {
      const parts = [];
      if (u.sets.category || u.sets.__catName) parts.push(`cat→${u.sets.__catName ? '+create:' + u.sets.__catName : 'existing'}`);
      if ('containerType' in u.sets || u.sets.__ctName) parts.push(`ct→${u.sets.__ctName ? '+create:' + u.sets.__ctName : (u.sets.containerType ? 'existing' : 'unset')}`);
      if (u.sets.unitOfMeasurement || u.sets.__unitName) parts.push(`unit→${u.sets.__unitName ? '+create:' + u.sets.__unitName : 'existing'}`);
      console.log(`  row ${u.row} sku=${u.sku} "${u.name}" : ${parts.join(', ')}`);
    }
  }

  if (JSON_OUT) {
    fs.writeFileSync(JSON_OUT, JSON.stringify({
      db: TARGET_DB,
      executed: EXECUTE,
      planCreateCategory: [...planCreateCategory.values()],
      planCreateContainer: [...planCreateContainer.values()],
      planCreateUnit: [...planCreateUnit.values()],
      planCreateProduct, planUpdateProduct, planUndelete, skipped,
    }, null, 2));
    console.log(`\nFull plan JSON: ${JSON_OUT}`);
  }

  if (!EXECUTE) {
    console.log(`\n🟡 DRY-RUN — no changes written. Re-run with --execute to apply.`);
    await mongoose.disconnect();
    return;
  }

  // ── EXECUTE ──
  console.log(`\n🔴 EXECUTING…`);

  // 1) Create new categories / container types / units (exact-case)
  const createdCatByExact = new Map();
  for (const name of planCreateCategory.values()) {
    const doc = { name, level: 1, isActive: true, createdAt: new Date(), updatedAt: new Date() };
    const r = await db.collection('categories').insertOne(doc);
    createdCatByExact.set(name, { _id: r.insertedId, name });
    console.log(`  + category "${name}" (${r.insertedId})`);
  }
  const createdCtByExact = new Map();
  for (const name of planCreateContainer.values()) {
    const doc = { name, isActive: true, createdAt: new Date(), updatedAt: new Date() };
    const r = await db.collection('containertypes').insertOne(doc);
    createdCtByExact.set(name, { _id: r.insertedId, name });
    console.log(`  + containerType "${name}" (${r.insertedId})`);
  }
  const createdUnitByExact = new Map();
  for (const name of planCreateUnit.values()) {
    const doc = { name, abbreviation: name, isActive: true, createdAt: new Date(), updatedAt: new Date() };
    const r = await db.collection('unitofmeasurements').insertOne(doc);
    createdUnitByExact.set(name, { _id: r.insertedId, name, abbreviation: name });
    console.log(`  + unit "${name}" (${r.insertedId})`);
  }

  function getCat(name) {
    return catByExact.get(name) || createdCatByExact.get(name);
  }
  function getCt(name) {
    return ctByExact.get(name) || createdCtByExact.get(name);
  }
  function getUnit(name) {
    return unitByExact.get(name) || createdUnitByExact.get(name);
  }

  // 2) Un-delete
  for (const u of planUndelete) {
    const r = await db.collection('products').updateOne(
      { _id: u.productId },
      { $set: { isDeleted: false, isActive: true, status: 'active', updatedAt: new Date() }, $unset: { deletedAt: 1, deletedBy: 1, deleteReason: 1 } }
    );
    console.log(`  ↺ un-delete sku=${u.sku} name="${u.name}" matched=${r.matchedCount} modified=${r.modifiedCount}`);
  }

  // 3) Update products
  for (const u of planUpdateProduct) {
    const sets = { ...u.sets };
    if (sets.__catName) {
      const c = getCat(sets.__catName);
      sets.category = c._id; sets.categoryName = c.name;
      delete sets.__catName;
    }
    if (sets.__ctName) {
      const c = getCt(sets.__ctName);
      sets.containerType = c._id;
      delete sets.__ctName;
    }
    if (sets.__unitName) {
      const c = getUnit(sets.__unitName);
      sets.unitOfMeasurement = c._id; sets.unitName = c.name;
      delete sets.__unitName;
    }
    sets.updatedAt = new Date();

    const update = {};
    const unset = {};
    for (const [k, v] of Object.entries(sets)) {
      if (v === null) unset[k] = 1;
      else update[k] = v;
    }
    const op = {};
    if (Object.keys(update).length) op.$set = update;
    if (Object.keys(unset).length) op.$unset = unset;

    const r = await db.collection('products').updateOne({ _id: u.productId }, op);
    console.log(`  ✎ update sku=${u.sku} name="${u.name}" matched=${r.matchedCount} modified=${r.modifiedCount}`);
  }

  // 4) Create products
  for (const c of planCreateProduct) {
    const catDoc = c.cat.kind === 'existing' ? c.cat.doc : getCat(c.cat.name);
    const ctDoc = c.ct.kind === 'empty' ? null : (c.ct.kind === 'existing' ? c.ct.doc : getCt(c.ct.name));
    const unitDoc = c.unit.kind === 'existing' ? c.unit.doc : getUnit(c.unit.name);

    const doc = {
      name: c.name,
      sku: c.sku,
      category: catDoc._id,
      categoryName: catDoc.name,
      unitOfMeasurement: unitDoc._id,
      unitName: unitDoc.name,
      quantity: 0,
      currentStock: 0,
      totalQuantity: 0,
      availableStock: 0,
      reservedStock: 0,
      looseStock: 0,
      averageRestockQuantity: 0,
      restockCount: 0,
      status: 'active',
      isActive: true,
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    if (ctDoc) doc.containerType = ctDoc._id;

    const r = await db.collection('products').insertOne(doc);
    console.log(`  + product sku=${c.sku} name="${c.name}" id=${r.insertedId}`);
  }

  console.log(`\n✅ done.`);
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error('Error:', e);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(1);
});
