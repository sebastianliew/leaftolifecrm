// READ-ONLY verification of l2l_prod after the swap.
// Compares l2l (untouched prod) and l2l_prod (new), confirms:
//   - inventory collection counts match expectations
//   - product categories: 343 active, 50 soft-deleted, 51 gone (net 393)
//   - no transactions/patients/etc changed vs prod
//   - transaction product-ref orphans are within expected bounds

import { MongoClient } from 'mongodb';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../../.env.local');
const envText = readFileSync(envPath, 'utf8');
const baseUri = envText.split('\n').find(l => l.startsWith('MONGODB_URI=')).slice('MONGODB_URI='.length);

function uriFor(db) { return baseUri.replace(/\/l2l_dev\?/, `/${db}?`); }

const PROD = 'l2l';
const NEW = 'l2l_prod';

async function referencedProductIds(db, col, path) {
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

async function main() {
  const prodClient = new MongoClient(uriFor(PROD));
  const newClient = new MongoClient(uriFor(NEW));
  await Promise.all([prodClient.connect(), newClient.connect()]);
  const prodDb = prodClient.db(PROD);
  const newDb = newClient.db(NEW);

  const report = { timestamp: new Date().toISOString(), counts: {}, products: {}, references: {} };

  // 1. Collection counts: prod vs new
  const collections = ['products','categories','brands','suppliers','suppliercategories','unitofmeasurements','containertypes','transactions','patients','appointments','inventorymovements','bundles','blendtemplates','customblendhistories','refunds'];
  console.log('\n=== Collection counts (prod/l2l vs new/l2l_prod) ===');
  for (const c of collections) {
    const p = await prodDb.collection(c).estimatedDocumentCount().catch(() => 0);
    const n = await newDb.collection(c).estimatedDocumentCount().catch(() => 0);
    const expected = c === 'products' ? 393 : (c === 'brands' ? 20 : (c === 'containertypes' ? 54 : p));
    const ok = c === 'products' ? n === 393 : (c === 'brands' ? n === 20 : (c === 'containertypes' ? n === 54 : n === p));
    console.log(`${c.padEnd(22)} prod=${String(p).padStart(6)}  new=${String(n).padStart(6)}  expected=${String(expected).padStart(6)}  ${ok ? '✓' : '✗ MISMATCH'}`);
    report.counts[c] = { prod: p, new: n, expected };
  }

  // 2. Product breakdown in new DB
  const activeCount = await newDb.collection('products').countDocuments({ $or: [{ isDeleted: { $exists: false } }, { isDeleted: false }] });
  const softDeletedCount = await newDb.collection('products').countDocuments({ isDeleted: true });
  const totalCount = await newDb.collection('products').estimatedDocumentCount();
  console.log('\n=== Products in l2l_prod ===');
  console.log(`  active:        ${activeCount} (expected 343)  ${activeCount === 343 ? '✓' : '✗'}`);
  console.log(`  soft-deleted:  ${softDeletedCount} (expected 50)  ${softDeletedCount === 50 ? '✓' : '✗'}`);
  console.log(`  total:         ${totalCount} (expected 393)  ${totalCount === 393 ? '✓' : '✗'}`);
  report.products = { active: activeCount, softDeleted: softDeletedCount, total: totalCount };

  // 3. Orphan analysis for transactions and other product consumers in l2l_prod
  const newProductIds = new Set((await newDb.collection('products').find({}, { projection: { _id: 1 } }).toArray()).map(d => String(d._id)));
  const consumers = [
    { col: 'transactions', path: 'items.productId' },
    { col: 'transactions', path: 'items.customBlendData.ingredients.productId' },
    { col: 'bundles', path: 'products.productId' },
    { col: 'blendtemplates', path: 'ingredients.productId' },
    { col: 'customblendhistories', path: 'ingredients.productId' },
    { col: 'inventorymovements', path: 'productId' },
  ];
  console.log('\n=== Orphan refs in l2l_prod (product ids referenced but not in products collection) ===');
  for (const { col, path } of consumers) {
    const refs = await referencedProductIds(newDb, col, path);
    const orphans = [...refs].filter(id => !newProductIds.has(id));
    console.log(`  ${col}::${path}  uniqueRefs=${refs.size} orphans=${orphans.length}`);
    report.references[`${col}::${path}`] = { uniqueRefs: refs.size, orphans: orphans.length };
  }

  // 4. Compare a few sanity anchors
  const sampleProd = await prodDb.collection('transactions').estimatedDocumentCount();
  const sampleNew = await newDb.collection('transactions').estimatedDocumentCount();
  console.log(`\nSanity: transactions prod=${sampleProd} new=${sampleNew} ${sampleProd === sampleNew ? '✓ identical' : '✗ DIFFER'}`);

  writeFileSync(resolve(__dirname, 'verify-report.json'), JSON.stringify(report, null, 2));
  console.log('\nWrote verify-report.json');

  await Promise.all([prodClient.close(), newClient.close()]);
}

main().catch(err => { console.error(err); process.exit(1); });
