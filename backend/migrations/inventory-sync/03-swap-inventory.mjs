// Applies dev inventory onto l2l_prod (which at this point is a clone of prod).
// Strategy (confirmed with user):
//  - Lookup collections (categories, brands, suppliers, suppliercategories,
//    unitofmeasurements, containertypes): UNION by _id. Upsert every dev doc.
//    Never delete prod-only rows.
//  - Products: upsert all 343 dev products by _id. For the 101 prod-only products:
//       * those referenced by historical data → soft-delete (isDeleted:true,
//         status:'inactive', isActive:false, deletedAt:now, deleteReason)
//       * those NOT referenced → hard-delete.
//
// Safety: this script only writes to l2l_prod. It never writes to l2l or l2l_dev.
// Run with --execute to actually write. Without it, runs a dry run.

import { MongoClient, ObjectId } from 'mongodb';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../../.env.local');
const envText = readFileSync(envPath, 'utf8');
const baseUri = envText.split('\n').find(l => l.startsWith('MONGODB_URI=')).slice('MONGODB_URI='.length);

const DEV_DB = 'l2l_dev';
const TARGET_DB = 'l2l_prod';
const PROD_DB = 'l2l'; // read-only, for orphan analysis

const EXECUTE = process.argv.includes('--execute');

const INVENTORY_COLLECTIONS = [
  'categories',
  'brands',
  'suppliers',
  'suppliercategories',
  'unitofmeasurements',
  'containertypes',
  // products handled specially below
];

const PRODUCT_CONSUMERS = [
  { col: 'transactions', path: 'items.productId' },
  { col: 'transactions', path: 'items.customBlendData.ingredients.productId' },
  { col: 'refunds', path: 'productId' },
  { col: 'bundles', path: 'products.productId' },
  { col: 'blendtemplates', path: 'ingredients.productId' },
  { col: 'customblendhistories', path: 'ingredients.productId' },
  { col: 'inventorymovements', path: 'productId' },
];

function uriFor(db) { return baseUri.replace(/\/l2l_dev\?/, `/${db}?`); }

async function safetyCheckTargetExists(client) {
  const admin = client.db('admin').admin();
  const dbs = await admin.listDatabases();
  const target = dbs.databases.find(d => d.name === TARGET_DB);
  if (!target) {
    throw new Error(`Refusing to run: ${TARGET_DB} does not exist. Run 02-clone-to-l2l_prod.sh first.`);
  }
  return target.sizeOnDisk;
}

async function referencedProductIds(db, { col, path }) {
  const exists = (await db.listCollections({ name: col }).toArray()).length > 0;
  if (!exists) return new Set();
  const parts = path.split('.');
  const pipeline = [];
  let pathSoFar = parts[0];
  for (let i = 0; i < parts.length - 1; i++) {
    pipeline.push({ $unwind: { path: '$' + pathSoFar, preserveNullAndEmptyArrays: true } });
    pathSoFar += '.' + parts[i + 1];
  }
  pipeline.push({ $group: { _id: null, ids: { $addToSet: '$' + path } } });
  const [res] = await db.collection(col).aggregate(pipeline, { allowDiskUse: true }).toArray();
  return new Set((res?.ids ?? []).filter(x => x != null).map(String));
}

async function upsertAllByIdFromDev(devDb, targetDb, name) {
  const devDocs = await devDb.collection(name).find({}).toArray();
  if (!EXECUTE) {
    const targetDocs = await targetDb.collection(name).find({}, { projection: { _id: 1 } }).toArray();
    const targetIds = new Set(targetDocs.map(d => String(d._id)));
    const upserts = devDocs.length;
    const newDocs = devDocs.filter(d => !targetIds.has(String(d._id))).length;
    const updates = upserts - newDocs;
    return { name, devCount: devDocs.length, targetCountBefore: targetDocs.length, wouldInsert: newDocs, wouldUpdate: updates };
  }
  if (devDocs.length === 0) return { name, upserted: 0, matched: 0 };
  const ops = devDocs.map(d => {
    const { _id, ...rest } = d;
    return {
      replaceOne: {
        filter: { _id },
        replacement: { _id, ...rest },
        upsert: true,
      }
    };
  });
  try {
    const result = await targetDb.collection(name).bulkWrite(ops, { ordered: false });
    return { name, upserted: result.upsertedCount, matched: result.matchedCount, modified: result.modifiedCount };
  } catch (err) {
    // With ordered:false, the driver still throws but result carries partial success
    const r = err.result || err;
    const writeErrors = (err.writeErrors || []).map(we => {
      const e = we.err || we;
      return { code: e.code, index: e.index, keyValue: e.keyValue || e.op };
    });
    return {
      name,
      upserted: r.upsertedCount ?? r.nUpserted ?? 0,
      matched: r.matchedCount ?? r.nMatched ?? 0,
      modified: r.modifiedCount ?? r.nModified ?? 0,
      failed: writeErrors.length,
      errorSamples: writeErrors.slice(0, 5),
    };
  }
}

async function syncProducts(devDb, targetDb, prodDb) {
  const devProducts = await devDb.collection('products').find({}).toArray();
  const devIds = new Set(devProducts.map(d => String(d._id)));
  const targetProdDocs = await targetDb.collection('products').find({}, { projection: { _id: 1, name: 1, sku: 1 } }).toArray();
  const targetIds = new Set(targetProdDocs.map(d => String(d._id)));

  // 1) Upsert dev products into target (343 expected)
  const upsertReport = await upsertAllByIdFromDev(devDb, targetDb, 'products');

  // 2) For target-only products, classify referenced vs unreferenced (based on REFERENCES IN TARGET DB, which is a clone of prod)
  const targetOnlyIds = [...targetIds].filter(id => !devIds.has(id));
  const allReferenced = new Set();
  for (const consumer of PRODUCT_CONSUMERS) {
    const refs = await referencedProductIds(targetDb, consumer);
    for (const id of refs) allReferenced.add(id);
  }
  const toSoftDelete = targetOnlyIds.filter(id => allReferenced.has(id));
  const toHardDelete = targetOnlyIds.filter(id => !allReferenced.has(id));

  // 3) Apply soft/hard deletes to target
  let softResult = { count: 0 };
  let hardResult = { count: 0 };
  if (EXECUTE) {
    if (toSoftDelete.length) {
      const r = await targetDb.collection('products').updateMany(
        { _id: { $in: toSoftDelete.map(id => new ObjectId(id)) } },
        { $set: {
            isDeleted: true,
            isActive: false,
            status: 'inactive',
            deletedAt: new Date(),
            deletedBy: 'migration-2026-04-22',
            deleteReason: 'Removed in inventory cleanup 2026-04-22 (soft-delete preserves historical transaction/blend references)',
          } }
      );
      softResult = { matched: r.matchedCount, modified: r.modifiedCount };
    }
    if (toHardDelete.length) {
      const r = await targetDb.collection('products').deleteMany({
        _id: { $in: toHardDelete.map(id => new ObjectId(id)) }
      });
      hardResult = { deleted: r.deletedCount };
    }
  }

  return {
    devProducts: devProducts.length,
    targetProductsBefore: targetProdDocs.length,
    upsertReport,
    targetOnlyCount: targetOnlyIds.length,
    toSoftDelete: { count: toSoftDelete.length, sample: toSoftDelete.slice(0, 5) },
    toHardDelete: { count: toHardDelete.length, sample: toHardDelete.slice(0, 5) },
    softResult,
    hardResult,
  };
}

async function main() {
  console.log(`Mode: ${EXECUTE ? 'EXECUTE (will write to ' + TARGET_DB + ')' : 'DRY RUN (no writes)'}`);
  const devClient = new MongoClient(uriFor(DEV_DB));
  const targetClient = new MongoClient(uriFor(TARGET_DB));
  const prodClient = new MongoClient(uriFor(PROD_DB));
  await Promise.all([devClient.connect(), targetClient.connect(), prodClient.connect()]);
  const devDb = devClient.db(DEV_DB);
  const targetDb = targetClient.db(TARGET_DB);
  const prodDb = prodClient.db(PROD_DB);

  await safetyCheckTargetExists(targetClient);

  const report = { mode: EXECUTE ? 'execute' : 'dry-run', timestamp: new Date().toISOString(), lookups: {}, products: null };

  console.log('\n--- Lookup collections (union by _id) ---');
  for (const name of INVENTORY_COLLECTIONS) {
    const r = await upsertAllByIdFromDev(devDb, targetDb, name);
    report.lookups[name] = r;
    console.log(name, JSON.stringify(r));
  }

  console.log('\n--- Products ---');
  report.products = await syncProducts(devDb, targetDb, prodDb);
  console.log(JSON.stringify(report.products, null, 2));

  const outPath = resolve(__dirname, EXECUTE ? 'swap-result.json' : 'swap-dryrun.json');
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\nWrote ${outPath}`);

  await Promise.all([devClient.close(), targetClient.close(), prodClient.close()]);
}

main().catch(err => { console.error(err); process.exit(1); });
