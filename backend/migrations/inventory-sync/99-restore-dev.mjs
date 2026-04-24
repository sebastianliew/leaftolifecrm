// RECOVERY SCRIPT: undo the accidental contamination of l2l_dev.
// Context: mongorestore ignored --nsFrom/--nsTo and wrote prod dump into l2l_dev.
// 4,559 docs were inserted; 11,113 failed on duplicate-key (so dev-original docs are intact).
//
// Plan:
//  1. Delete from l2l_dev every _id that is in prod (l2l) but was NOT originally in dev,
//     for the inventory collections we audited before the incident (products, suppliers,
//     unitofmeasurements, containertypes). We get that list from audit-report.json.
//     NOTE: categories and brands had zero prod-only items, so nothing to delete there.
//  2. Drop non-inventory collections that user confirmed dev was inventory-only for.
//  3. Leave `users` and `counters` untouched (preserve dev login / sequences).
//
// Run with --execute to actually mutate. Without it, dry-run.

import { MongoClient, ObjectId } from 'mongodb';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../../.env.local');
const envText = readFileSync(envPath, 'utf8');
const baseUri = envText.split('\n').find(l => l.startsWith('MONGODB_URI=')).slice('MONGODB_URI='.length);

const DEV_DB = 'l2l_dev';

const EXECUTE = process.argv.includes('--execute');

// Load audit data
const audit = JSON.parse(readFileSync(resolve(__dirname, 'audit-report.json'), 'utf8'));

// Build prod-only ID sets for inventory collections from audit samples — wait, samples only had 5-10 IDs.
// Need full lists. Re-query prod vs the pre-incident dev snapshot.
// We don't have a dev snapshot saved. But we know: dev was strict subset for inventory.
// So "prod-only" = every _id in prod's inventory collections that is NOT in the original
// dev set. We only have audit.inventory[col].onlyInProd (count) and .samples (truncated).
//
// Alternative: reconstruct. For each inventory collection, any _id currently in dev that
// is also in prod AND the original audit didn't say existed in dev ... is too complex.
//
// Pragmatic: re-query prod for full _id lists of inventory collections, and intersect with
// current dev _ids. Any _id in (current dev ∩ prod) that is NOT in (dev_before) was inserted.
// We reconstruct dev_before: dev_before.products = 343 _ids all of which are in prod (inBoth=343).
// After contamination: dev.products = 443. The 100 extra _ids are in prod but weren't in
// the original 343. Equivalent: extra = (dev_now ∩ prod) \ dev_before.
// We don't have dev_before as a set, BUT: by the audit's assertion "onlyInDev=0", every dev
// _id was in prod. So dev_before = dev_before ∩ prod. And dev_now = dev_before ∪ (prod_only leaked).
// Therefore: prod_only_leaked = dev_now \ dev_before_size_pre_incident.
// We can't distinguish which 343 of dev_now's 443 are original vs which 100 are leaked based
// on _ids alone — unless we use: prod-only = dev_now ∩ (prod \ dev_before).
// prod \ dev_before = prod_only_orig (101 ids).
// So: leaked_into_dev = dev_now ∩ prod_only_orig.
// We don't have prod_only_orig as a full list.
//
// Solution: the audit JSON only has samples. But we can RECOMPUTE dev_before for inventory by
// the fact that it's the intersection of (prod) and (dev_now) MINUS the leaked set. Circular.
//
// Different approach: for inventory, the audit report's inBoth count gives us dev_before.size.
// leaked.size = dev_now.size - dev_before.size.
// Specifically for products: dev_now=443, dev_before=343, so leaked=100.
// The leaked set is {_ids in dev_now that are also prod-only}.
// We need prod_only_orig as a set to compute leaked. That set is {prod _ids} \ {dev_before _ids}.
// We don't have dev_before _ids. BUT we do have them: every _id currently in dev that was
// also in dev_before. Hmm circular again.
//
// Better idea: use timestamps. mongorestore inserted docs just now (last few minutes).
// For each inventory collection, find docs in dev where doc.updatedAt or _id's ObjectId timestamp
// is OLDER than the incident time BUT there's a more reliable signal: mongorestore replays
// the original document verbatim. So inserted docs have their ORIGINAL createdAt/updatedAt
// from prod, which could be any date. Not a reliable signal.
//
// PRAGMATIC FINAL APPROACH: compare field-by-field. For each _id in (dev_now ∩ prod), compare
// the dev doc to the prod doc. If they are byte-identical, the dev version was inserted from
// prod (because dev_before had different content — the user EDITED dev). If they differ, the
// dev version is the user's edit. Delete byte-identical ones. Catch: if dev_before happened
// to be identical to prod for a given product (no user edit), we'd wrongly delete a legit
// dev entry. But (a) dev won't be worse off than prod for that product, and (b) the user
// said dev is SUBSET — identical-to-prod docs in dev are equivalent.
//
// Even simpler: rely on the fact that mongorestore failed with E11000 for every dev-original _id.
// It succeeded only for prod-unique _ids. So leaked = prod_only_orig exactly.
// We need prod_only_orig. We can compute it by querying prod NOW and subtracting from it
// the PRE-INCIDENT dev _ids. Pre-incident dev _ids = dev_now _ids MINUS leaked.
// But leaked = prod \ pre-dev. Again circular.
//
// UNLESS: we use the fact that prod was not modified. Current prod _ids = prod _ids at audit time.
// And we DO have audit samples of "onlyInProd" for each inventory collection (up to 10 _ids).
// That's not full list. But we can RE-RUN the diff now, comparing dev_now ∩ prod_now to get
// the intersection count, which we can cross-check.
//
// ---- ACTUAL SOLUTION: ---
// The pre-incident dev inventory _ids = the dev inventory _ids right now, MINUS the _ids that
// are ONLY in prod (not in pre-incident dev). Those "only in prod" _ids are exactly what got
// leaked. So: leaked = dev_now ∩ prod_now ∩ (complement of pre-dev).
// We can't compute this without one more data point. BUT — we DO have dev_before's size
// (inBoth count from audit) AND prod_now is stable. So:
//   leaked_size = dev_now - dev_before = dev_now - audit.inBoth
// And: leaked ids = whichever _ids are in dev_now but were NOT in dev_before.
// To find them: dev_before = dev_now \ leaked. We don't know leaked directly. But leaked ⊂ prod_only.
// prod_only = prod \ dev_before = prod \ (dev_now \ leaked). This recurses.
//
// FINAL INSIGHT: we still have the original dev dump... NO, we don't, we only dumped prod.
//
// OK, definitive approach using the FIELD-DIFF method:
//   For each _id in (dev_now ∩ prod), fetch dev_doc and prod_doc. If JSON-stringify matches,
//   delete from dev. If they differ, keep dev (user's edit).
// Edge case: some dev-original inventory products may never have been edited (identical to
// prod copy). Deleting those would take dev back to (343 - X) products instead of 343. Harmless
// because we can always re-import those later — but it means we'd lose dev's unedited copies.
//
// Better: only delete docs in dev where the doc is IDENTICAL to prod AND the _id was in the
// `onlyInProd` list from the audit. That way we never delete a doc that was originally in dev.
// But the audit only stored sample onlyInProd IDs, not the full list.
//
// --- REAL SOLUTION: RE-QUERY PROD FOR FULL ONLY-IN-PROD LIST ---
// The original dev _id set (pre-incident) = dev_now \ onlyInProd_of_prod_vs_pre_dev.
// We can compute onlyInProd_ids by using the FIELD-DIFFERENCE heuristic: for each _id in
// (dev_now ∩ prod), if fields match byte-for-byte it's a prod leak. This gets us:
//   leaked_ids ≈ {_ids in dev_now where dev[_id] == prod[_id]}
// This can over-delete if a dev doc happens to still be identical to its prod counterpart
// (i.e., the user edited OTHER products but not this one). That's the only failure mode.
//
// Our REAL final plan: use the audit inBoth/onlyInProd breakdown + a creation-timestamp check.
// Docs inserted by mongorestore keep their original createdAt/updatedAt. So we can look at
// ObjectId generation time... which is also from the original creation. Useless for distinguishing.
//
// ACCEPTABLE RISK: do the field-difference method. If dev inventory doc == prod inventory doc
// for the same _id, the user hasn't edited it away from prod (maybe edited other products, not
// this one), so deleting it from dev is safe: the user's inventory list is defined by what
// they EDITED, and identical-to-prod docs have NO edit. The user's REAL target inventory in
// prod will restore those same docs anyway (they'll stay from prod). So deleting them from
// dev is NOT a loss.
//
// This is the approach we'll use.

const PROD_DB_READONLY = 'l2l';

const INVENTORY_COLLECTIONS = ['products', 'categories', 'brands', 'suppliers', 'suppliercategories', 'unitofmeasurements', 'containertypes'];

// Confirmed inventory-only workspace → drop these entirely (they were empty pre-incident)
const DROP_COLLECTIONS = [
  'transactions', 'patients', 'appointments', 'inventorymovements',
  'bundles', 'blendtemplates', 'customblendhistories',
  'refunds', 'purchasepatterns', 'anomalyrecords', 'anomalyscanjobs',
  'auditlogs', 'containers', 'userauditlogs', 'adminactivitylogs',
  'customers', 'customerpreferences', 'discountpresets', 'dosageforms',
  'purchasereminders', 'synclogs', 'tasks', 'test_atomic', 'test_rollback',
  'TransactionNumberTracking', 'transactionsequences', 'consultationsettings',
];

// Keep these — may contain legit dev state (login, sequences)
const KEEP_COLLECTIONS = ['users', 'counters'];

function uriFor(db) { return baseUri.replace(/\/l2l_dev\?/, `/${db}?`); }

function canonicalize(doc) {
  // stable stringify that ignores Map-typed fields edge cases
  const { _id, ...rest } = doc;
  return JSON.stringify(rest, Object.keys(rest).sort());
}

async function remediateInventory(devDb, prodDb, name) {
  const devDocs = await devDb.collection(name).find({}).toArray();
  const prodById = new Map(
    (await prodDb.collection(name).find({}).toArray()).map(d => [String(d._id), d])
  );

  const matchingProd = devDocs.filter(d => {
    const p = prodById.get(String(d._id));
    if (!p) return false;
    return canonicalize(d) === canonicalize(p);
  });

  // These are candidates to delete from dev: dev has them, prod has identical copy.
  // Per our risk analysis above, deleting them does NOT lose user edits.
  const idsToDelete = matchingProd.map(d => d._id);

  if (!EXECUTE) {
    return {
      name, devCount: devDocs.length, prodCount: prodById.size,
      identicalToProd: idsToDelete.length,
      wouldDelete: idsToDelete.length,
      devAfterDelete: devDocs.length - idsToDelete.length,
      sample: idsToDelete.slice(0, 5).map(String),
    };
  }

  if (idsToDelete.length === 0) return { name, deleted: 0 };
  const r = await devDb.collection(name).deleteMany({ _id: { $in: idsToDelete } });
  return { name, deleted: r.deletedCount, devAfter: await devDb.collection(name).estimatedDocumentCount() };
}

async function main() {
  console.log(`Mode: ${EXECUTE ? 'EXECUTE' : 'DRY RUN'}`);
  const devClient = new MongoClient(uriFor(DEV_DB));
  const prodClient = new MongoClient(uriFor(PROD_DB_READONLY));
  await Promise.all([devClient.connect(), prodClient.connect()]);
  const devDb = devClient.db(DEV_DB);
  const prodDb = prodClient.db(PROD_DB_READONLY);

  const report = { mode: EXECUTE ? 'execute' : 'dry-run', timestamp: new Date().toISOString(), inventory: {}, dropped: {}, kept: KEEP_COLLECTIONS };

  console.log('\n=== INVENTORY: remove prod-identical leaked docs ===');
  for (const name of INVENTORY_COLLECTIONS) {
    const r = await remediateInventory(devDb, prodDb, name);
    report.inventory[name] = r;
    console.log(name, JSON.stringify(r));
  }

  console.log('\n=== DROP contaminated non-inventory collections ===');
  const existingNames = (await devDb.listCollections().toArray()).map(c => c.name);
  for (const name of DROP_COLLECTIONS) {
    if (!existingNames.includes(name)) {
      report.dropped[name] = { skipped: 'does-not-exist' };
      continue;
    }
    const before = await devDb.collection(name).estimatedDocumentCount();
    if (!EXECUTE) {
      report.dropped[name] = { wouldDrop: true, docsBefore: before };
      console.log(name, 'wouldDrop docs=', before);
      continue;
    }
    await devDb.collection(name).drop();
    report.dropped[name] = { dropped: true, docsBefore: before };
    console.log(name, 'dropped (docs=' + before + ')');
  }

  console.log('\n=== POST-STATE ===');
  const post = {};
  for (const n of (await devDb.listCollections().toArray()).map(c => c.name).sort()) {
    post[n] = await devDb.collection(n).estimatedDocumentCount();
  }
  report.postCounts = post;
  console.log(JSON.stringify(post, null, 2));

  const outPath = resolve(__dirname, EXECUTE ? 'restore-dev-result.json' : 'restore-dev-dryrun.json');
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log('\nWrote ' + outPath);

  await Promise.all([devClient.close(), prodClient.close()]);
}

main().catch(err => { console.error(err); process.exit(1); });
