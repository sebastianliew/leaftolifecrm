// READ-ONLY audit: compare inventory between dev (l2l_dev) and prod (l2l),
// and count transactions/bundles/etc in prod that reference products.
//
// Usage:
//   node migrations/inventory-sync/audit.mjs
//
// Reads MONGODB_URI from backend/.env.local and swaps the db name for each target.

import { MongoClient } from 'mongodb';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../../.env.local');
const envText = readFileSync(envPath, 'utf8');
const baseUri = envText.split('\n').find(l => l.startsWith('MONGODB_URI=')).slice('MONGODB_URI='.length);

const DEV_DB = 'l2l_dev';
const PROD_DB = 'l2l';

function uriFor(db) {
  return baseUri.replace(/\/l2l_dev\?/, `/${db}?`);
}

const INVENTORY_COLLECTIONS = [
  'products',
  'categories',
  'brands',
  'suppliers',
  'suppliercategories',
  'unitofmeasurements',
  'containertypes',
];

// Collections that reference products by _id
const PRODUCT_CONSUMERS = [
  { col: 'transactions', path: 'items.productId', type: 'string' },
  { col: 'transactions', path: 'items.customBlendData.ingredients.productId', type: 'string' },
  { col: 'refunds', path: 'productId', type: 'string' },
  { col: 'bundles', path: 'products.productId', type: 'objectid' },
  { col: 'blendtemplates', path: 'ingredients.productId', type: 'objectid' },
  { col: 'customblendhistories', path: 'ingredients.productId', type: 'objectid' },
  { col: 'inventorymovements', path: 'productId', type: 'objectid' },
];

async function listCollections(db) {
  const names = (await db.listCollections().toArray()).map(c => c.name);
  return names;
}

async function collectionSummary(db, name) {
  try {
    const count = await db.collection(name).estimatedDocumentCount();
    return { exists: true, count };
  } catch {
    return { exists: false, count: 0 };
  }
}

async function auditInventoryCollection(devDb, prodDb, name) {
  const dev = devDb.collection(name);
  const prod = prodDb.collection(name);
  const devDocs = await dev.find({}, { projection: { _id: 1, name: 1, sku: 1, isDeleted: 1, status: 1 } }).toArray();
  const prodDocs = await prod.find({}, { projection: { _id: 1, name: 1, sku: 1, isDeleted: 1, status: 1 } }).toArray();

  const devById = new Map(devDocs.map(d => [String(d._id), d]));
  const prodById = new Map(prodDocs.map(d => [String(d._id), d]));

  const onlyInDev = [];
  const onlyInProd = [];
  const inBoth = [];
  for (const [id, d] of devById) {
    if (!prodById.has(id)) onlyInDev.push(d);
    else inBoth.push({ dev: d, prod: prodById.get(id) });
  }
  for (const [id, d] of prodById) {
    if (!devById.has(id)) onlyInProd.push(d);
  }

  // also check for SKU overlap when _ids differ (products only)
  let skuCollisions = [];
  if (name === 'products') {
    const devBySku = new Map(devDocs.filter(d => d.sku).map(d => [d.sku, d]));
    for (const p of onlyInProd) {
      if (p.sku && devBySku.has(p.sku)) {
        skuCollisions.push({ sku: p.sku, prod_id: String(p._id), dev_id: String(devBySku.get(p.sku)._id) });
      }
    }
  }

  return {
    collection: name,
    devCount: devDocs.length,
    prodCount: prodDocs.length,
    onlyInDev: onlyInDev.length,
    onlyInProd: onlyInProd.length,
    inBoth: inBoth.length,
    skuCollisions,
    samples: {
      onlyInDev: onlyInDev.slice(0, 5).map(d => ({ _id: String(d._id), name: d.name, sku: d.sku })),
      onlyInProd: onlyInProd.slice(0, 10).map(d => ({ _id: String(d._id), name: d.name, sku: d.sku, isDeleted: d.isDeleted, status: d.status })),
    }
  };
}

async function referencedProductIds(db, { col, path, type }) {
  const exists = (await db.listCollections({ name: col }).toArray()).length > 0;
  if (!exists) return { collection: col, path, totalDocs: 0, uniqueProductIds: new Set(), docsWithRefs: 0 };

  const parts = path.split('.');
  const pipeline = [];
  // Build a chain that unwinds arrays along the path
  let cur = '$' + parts[0];
  let pathSoFar = parts[0];
  // We need to unwind any array along the path. We don't know which are arrays, so try preserveNullAndEmptyArrays unwinds.
  // Use $reduce / $objectToArray approach: simpler to just pipeline with unwinds that tolerate scalars
  for (let i = 0; i < parts.length - 1; i++) {
    pipeline.push({ $unwind: { path: '$' + pathSoFar, preserveNullAndEmptyArrays: true } });
    pathSoFar += '.' + parts[i + 1];
  }
  pipeline.push({
    $group: {
      _id: null,
      ids: { $addToSet: '$' + path },
      docCount: { $sum: 1 },
      withRef: { $sum: { $cond: [{ $ifNull: ['$' + path, false] }, 1, 0] } },
    }
  });

  const [res] = await db.collection(col).aggregate(pipeline, { allowDiskUse: true }).toArray();
  const raw = res?.ids ?? [];
  const set = new Set(raw.filter(x => x != null).map(String));
  return {
    collection: col,
    path,
    type,
    totalDocs: res?.docCount ?? 0,
    docsWithRefs: res?.withRef ?? 0,
    uniqueProductIds: set,
  };
}

async function main() {
  console.error('Connecting to dev + prod (read-only)…');
  const devClient = new MongoClient(uriFor(DEV_DB), { readPreference: 'primary' });
  const prodClient = new MongoClient(uriFor(PROD_DB), { readPreference: 'secondaryPreferred' });
  await Promise.all([devClient.connect(), prodClient.connect()]);
  const devDb = devClient.db(DEV_DB);
  const prodDb = prodClient.db(PROD_DB);

  const report = {
    timestamp: new Date().toISOString(),
    dev: DEV_DB,
    prod: PROD_DB,
    devCollections: await listCollections(devDb),
    prodCollections: await listCollections(prodDb),
    inventory: {},
    productReferences: {},
    orphanAnalysis: {},
  };

  // Inventory diff
  for (const name of INVENTORY_COLLECTIONS) {
    const devExists = report.devCollections.includes(name);
    const prodExists = report.prodCollections.includes(name);
    if (!devExists || !prodExists) {
      report.inventory[name] = {
        skipped: true,
        reason: `exists dev=${devExists} prod=${prodExists}`,
        devCount: devExists ? await devDb.collection(name).estimatedDocumentCount() : 0,
        prodCount: prodExists ? await prodDb.collection(name).estimatedDocumentCount() : 0,
      };
      continue;
    }
    report.inventory[name] = await auditInventoryCollection(devDb, prodDb, name);
  }

  // Product references in prod
  const devProductIds = new Set((await devDb.collection('products').find({}, { projection: { _id: 1 } }).toArray()).map(d => String(d._id)));
  const prodProductIds = new Set((await prodDb.collection('products').find({}, { projection: { _id: 1 } }).toArray()).map(d => String(d._id)));

  for (const consumer of PRODUCT_CONSUMERS) {
    const r = await referencedProductIds(prodDb, consumer);
    const referenced = r.uniqueProductIds;
    const inProd = [...referenced].filter(id => prodProductIds.has(id));
    const inDev = [...referenced].filter(id => devProductIds.has(id));
    const orphanInProd = [...referenced].filter(id => !prodProductIds.has(id));
    const wouldBreakIfDevReplaces = [...referenced].filter(id => prodProductIds.has(id) && !devProductIds.has(id));

    report.productReferences[`${consumer.col}::${consumer.path}`] = {
      totalDocs: r.totalDocs,
      docsWithRefs: r.docsWithRefs,
      uniqueRefs: referenced.size,
      refsThatExistInProdProducts: inProd.length,
      refsThatExistInDevProducts: inDev.length,
      alreadyOrphanInProd: orphanInProd.length,
      wouldBecomeOrphanIfDevReplaces: wouldBreakIfDevReplaces.length,
      sampleAlreadyOrphan: orphanInProd.slice(0, 5),
      sampleWouldOrphan: wouldBreakIfDevReplaces.slice(0, 10),
    };
  }

  // Cross-summary: which prod-only products are referenced by historical data?
  const prodOnlyIds = [...prodProductIds].filter(id => !devProductIds.has(id));
  const allRefsInProd = new Set();
  for (const consumer of PRODUCT_CONSUMERS) {
    const r = await referencedProductIds(prodDb, consumer);
    for (const id of r.uniqueProductIds) allRefsInProd.add(id);
  }
  const prodOnlyReferenced = prodOnlyIds.filter(id => allRefsInProd.has(id));
  const prodOnlyUnreferenced = prodOnlyIds.filter(id => !allRefsInProd.has(id));

  report.orphanAnalysis = {
    prodProductsCount: prodProductIds.size,
    devProductsCount: devProductIds.size,
    inBoth: [...prodProductIds].filter(id => devProductIds.has(id)).length,
    prodOnly: prodOnlyIds.length,
    prodOnlyReferencedByHistoricalData: prodOnlyReferenced.length,
    prodOnlyUnreferenced: prodOnlyUnreferenced.length,
  };

  const outPath = resolve(__dirname, 'audit-report.json');
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.error('Wrote ' + outPath);

  // Console summary
  console.log('\n=== INVENTORY DIFF (dev vs prod) ===');
  for (const [name, r] of Object.entries(report.inventory)) {
    if (r.skipped) {
      console.log(`${name.padEnd(22)} SKIPPED  (${r.reason}) dev=${r.devCount} prod=${r.prodCount}`);
      continue;
    }
    console.log(`${name.padEnd(22)} dev=${String(r.devCount).padStart(4)} prod=${String(r.prodCount).padStart(4)}  inBoth=${r.inBoth}  onlyInDev=${r.onlyInDev}  onlyInProd=${r.onlyInProd}${r.skuCollisions?.length ? ' skuCollisions=' + r.skuCollisions.length : ''}`);
  }
  console.log('\n=== PROD HISTORICAL REFERENCES TO PRODUCTS ===');
  for (const [k, v] of Object.entries(report.productReferences)) {
    console.log(`${k}`);
    console.log(`  docs=${v.totalDocs} withRefs=${v.docsWithRefs} uniqueProductIds=${v.uniqueRefs}`);
    console.log(`  alreadyOrphanInProd=${v.alreadyOrphanInProd}  wouldBecomeOrphanIfDevReplaces=${v.wouldBecomeOrphanIfDevReplaces}`);
  }
  console.log('\n=== ORPHAN ANALYSIS ===');
  console.log(JSON.stringify(report.orphanAnalysis, null, 2));

  await Promise.all([devClient.close(), prodClient.close()]);
}

main().catch(err => { console.error(err); process.exit(1); });
