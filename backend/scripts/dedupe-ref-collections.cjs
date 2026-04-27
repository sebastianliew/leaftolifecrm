/**
 * Dedupe lookup collections that have multiple docs with the EXACT same
 * name (no case folding — "Bottle" and "bottle" stay separate to honor the
 * Excel-is-source-of-truth rule).
 *
 * For each duplicate-name group:
 *   - winner = the doc that the most products already point to
 *     (tiebreak: oldest _id)
 *   - losers = the rest
 * For each loser:
 *   - repoint every reference field across the DB to the winner
 *   - delete the loser doc
 *
 * Read-only by default; pass --execute to apply.
 *
 * Usage:
 *   node scripts/dedupe-ref-collections.cjs --db l2l_prod
 *   node scripts/dedupe-ref-collections.cjs --db l2l_prod --execute
 *   --collections containertypes,categories,unitofmeasurements (default = all 3)
 */
const path = require('path');
const mongoose = require('mongoose');

if (!process.env.MONGODB_URI) {
  try { require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') }); } catch (_) {}
}
const arg = (n, d) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; };
const TARGET_DB = arg('--db');
const EXECUTE = process.argv.includes('--execute');
const ONLY = (arg('--collections', 'containertypes,categories,unitofmeasurements')).split(',').map(s => s.trim());

if (!TARGET_DB) { console.error('Missing --db'); process.exit(1); }

// Where each lookup collection's _id is referenced.
// { coll: 'mongoCollection', field: 'dot.path.to.id', isArrayPath?: true }
const REFS = {
  containertypes: [
    { coll: 'products', field: 'containerType' },
  ],
  categories: [
    { coll: 'products', field: 'category' },
    { coll: 'categories', field: 'parent' },
    { coll: 'suppliers', field: 'categories', isArrayPath: true },
  ],
  unitofmeasurements: [
    { coll: 'products', field: 'unitOfMeasurement' },
    { coll: 'categories', field: 'defaultUom' },
    { coll: 'bundles', field: 'unitOfMeasurementId' },
    { coll: 'blendtemplates', field: 'ingredients.unitOfMeasurementId' },
    { coll: 'blendtemplates', field: 'allowedUnitsForLooseSale', isArrayPath: true },
    { coll: 'customblendhistories', field: 'ingredients.unitOfMeasurementId' },
    { coll: 'inventorymovements', field: 'unitOfMeasurementId' },
  ],
};

(async () => {
  await mongoose.connect(process.env.MONGODB_URI, { dbName: TARGET_DB });
  const db = mongoose.connection.db;

  console.log('='.repeat(70));
  console.log(` REF DEDUPE — db=${TARGET_DB}  mode=${EXECUTE ? '🔴 EXECUTE' : '🟡 DRY-RUN'}`);
  console.log('='.repeat(70));

  let totalDeletes = 0;
  let totalRepoints = 0;

  for (const collName of ONLY) {
    if (!REFS[collName]) { console.log(`\n(skipping unknown collection ${collName})`); continue; }
    const refSpecs = REFS[collName];

    const docs = await db.collection(collName).find({}).toArray();
    const groups = new Map();
    for (const d of docs) {
      const key = d.name;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(d);
    }
    const dupGroups = [...groups.entries()].filter(([_, arr]) => arr.length > 1);

    console.log(`\n── ${collName}: ${docs.length} docs, ${dupGroups.length} exact-name duplicate group(s) ──`);
    if (!dupGroups.length) continue;

    for (const [name, arr] of dupGroups) {
      // Count products / refs pointing at each doc to pick the winner
      const counts = await Promise.all(arr.map(async (d) => {
        let n = 0;
        for (const r of refSpecs) {
          const filter = { [r.field]: d._id };
          n += await db.collection(r.coll).countDocuments(filter);
        }
        return n;
      }));
      // Winner = max ref count; tiebreak oldest _id
      let winnerIdx = 0;
      for (let i = 1; i < arr.length; i++) {
        if (counts[i] > counts[winnerIdx]) winnerIdx = i;
        else if (counts[i] === counts[winnerIdx] && String(arr[i]._id) < String(arr[winnerIdx]._id)) winnerIdx = i;
      }
      const winner = arr[winnerIdx];
      const losers = arr.filter((_, i) => i !== winnerIdx);

      console.log(`  "${name}" — winner=${String(winner._id)} (refs=${counts[winnerIdx]}), losers=${losers.length}`);
      for (let i = 0; i < arr.length; i++) {
        if (i === winnerIdx) continue;
        console.log(`     loser ${String(arr[i]._id)} (refs=${counts[i]})`);
      }

      for (const loser of losers) {
        for (const r of refSpecs) {
          if (r.isArrayPath) {
            // arrayField uses $ positional + arrayFilters across docs
            const matchFilter = { [r.field]: loser._id };
            const updateOp = { $set: { [`${r.field}.$[el]`]: winner._id } };
            const updateOpts = { arrayFilters: [{ el: loser._id }], multi: true };
            const cnt = await db.collection(r.coll).countDocuments(matchFilter);
            if (!cnt) continue;
            console.log(`       repoint ${r.coll}.${r.field}[] ×${cnt}: ${String(loser._id)} → ${String(winner._id)}`);
            totalRepoints += cnt;
            if (EXECUTE) {
              await db.collection(r.coll).updateMany(matchFilter, updateOp, updateOpts);
            }
          } else if (r.field.includes('.')) {
            // Nested field on a subdoc inside an array, e.g. ingredients.unitOfMeasurementId
            const arrayField = r.field.split('.')[0];
            const subField = r.field.split('.').slice(1).join('.');
            const matchFilter = { [r.field]: loser._id };
            const updateOp = { $set: { [`${arrayField}.$[el].${subField}`]: winner._id } };
            const updateOpts = { arrayFilters: [{ [`el.${subField}`]: loser._id }], multi: true };
            const cnt = await db.collection(r.coll).countDocuments(matchFilter);
            if (!cnt) continue;
            console.log(`       repoint ${r.coll}.${r.field} ×${cnt}: ${String(loser._id)} → ${String(winner._id)}`);
            totalRepoints += cnt;
            if (EXECUTE) {
              await db.collection(r.coll).updateMany(matchFilter, updateOp, updateOpts);
            }
          } else {
            // Plain scalar field
            const matchFilter = { [r.field]: loser._id };
            const updateOp = { $set: { [r.field]: winner._id } };
            const cnt = await db.collection(r.coll).countDocuments(matchFilter);
            if (!cnt) continue;
            console.log(`       repoint ${r.coll}.${r.field} ×${cnt}: ${String(loser._id)} → ${String(winner._id)}`);
            totalRepoints += cnt;
            if (EXECUTE) {
              await db.collection(r.coll).updateMany(matchFilter, updateOp);
            }
          }
        }
        // Delete loser
        if (EXECUTE) {
          const r = await db.collection(collName).deleteOne({ _id: loser._id });
          console.log(`       ✗ deleted loser ${String(loser._id)} (${r.deletedCount})`);
        } else {
          console.log(`       (would delete loser ${String(loser._id)})`);
        }
        totalDeletes++;
      }
    }
  }

  console.log(`\nTotal repoints: ${totalRepoints}, total deletes: ${totalDeletes}`);
  if (!EXECUTE) console.log(`🟡 DRY-RUN — re-run with --execute to apply.`);
  await mongoose.disconnect();
})().catch(async (e) => { console.error(e); try { await mongoose.disconnect(); } catch (_) {} process.exit(1); });
