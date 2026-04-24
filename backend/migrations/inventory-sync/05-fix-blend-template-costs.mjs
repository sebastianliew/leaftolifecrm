// Remediation: historical blend templates have ingredients[].costPerUnit set to the
// product's selling price (due to the old buggy auto-correct). This script rewrites
// each template ingredient's costPerUnit to the current product.costPrice so that
// the template's cost calculation (and thus profit/margin) is accurate.
//
// Affected collections/DBs:
//   - By default targets l2l_prod (the new DB we just built).
//   - Optionally can target l2l_dev too with TARGET=l2l_dev env var.
//
// Does NOT touch:
//   - transactions (sold items — price snapshot at sale time, must stay immutable)
//   - customblendhistories (historical log of sales — immutable record)
//   - bundles (separate cost model; see Bundle.ts if needed later)
//
// Run with --execute to mutate. Without it, prints a dry-run diff.

import { MongoClient, ObjectId } from 'mongodb';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../../.env.local');
const envText = readFileSync(envPath, 'utf8');
const baseUri = envText.split('\n').find(l => l.startsWith('MONGODB_URI=')).slice('MONGODB_URI='.length);

const TARGET_DB = process.env.TARGET || 'l2l_prod';
const EXECUTE = process.argv.includes('--execute');

function uriFor(db) { return baseUri.replace(/\/l2l_dev\?/, `/${db}?`); }

async function main() {
  console.log(`Mode: ${EXECUTE ? 'EXECUTE' : 'DRY RUN'}  Target: ${TARGET_DB}`);
  if (!['l2l_prod', 'l2l_dev'].includes(TARGET_DB)) {
    throw new Error(`Refusing to target "${TARGET_DB}". Only l2l_prod or l2l_dev allowed.`);
  }

  const client = new MongoClient(uriFor(TARGET_DB));
  await client.connect();
  const db = client.db(TARGET_DB);

  const templates = await db.collection('blendtemplates').find({
    isDeleted: { $ne: true },
  }).toArray();

  console.log(`Scanning ${templates.length} blend templates…\n`);

  const productIds = new Set();
  for (const t of templates) for (const ing of (t.ingredients || [])) {
    if (ing.productId) productIds.add(String(ing.productId));
  }

  const products = await db.collection('products').find(
    { _id: { $in: [...productIds].map(id => new ObjectId(id)) } },
    { projection: { _id: 1, name: 1, costPrice: 1, sellingPrice: 1, containerCapacity: 1 } }
  ).toArray();
  const productMap = new Map(products.map(p => [String(p._id), p]));

  function perUnitCost(product) {
    if (product.costPrice == null) return null;
    const capacity = product.containerCapacity && product.containerCapacity > 0 ? product.containerCapacity : 1;
    // Round to 4dp to avoid floating noise diffs
    return Math.round((product.costPrice / capacity) * 10000) / 10000;
  }

  const updates = [];
  const warnings = [];
  let totalIngredients = 0;
  let changedIngredients = 0;
  let alreadyCorrect = 0;
  let missingCostPrice = 0;

  for (const t of templates) {
    let templateChanged = false;
    const newIngredients = (t.ingredients || []).map(ing => {
      totalIngredients++;
      const product = productMap.get(String(ing.productId));
      if (!product) {
        warnings.push({ template: t.name, ingredient: ing.name, reason: 'product-not-found' });
        return ing;
      }
      const targetCost = perUnitCost(product);
      if (targetCost == null) {
        missingCostPrice++;
        warnings.push({
          template: t.name,
          ingredient: ing.name,
          reason: 'product-has-no-costPrice',
          current: ing.costPerUnit,
          sellingPrice: product.sellingPrice,
        });
        return ing;
      }
      if (ing.costPerUnit != null && Math.abs(ing.costPerUnit - targetCost) < 0.0001) {
        alreadyCorrect++;
        return ing;
      }
      changedIngredients++;
      templateChanged = true;
      return { ...ing, costPerUnit: targetCost };
    });

    if (templateChanged) {
      updates.push({ _id: t._id, templateName: t.name, newIngredients });
    }
  }

  console.log(`Ingredient totals: ${totalIngredients}`);
  console.log(`  already correct (== product.costPrice): ${alreadyCorrect}`);
  console.log(`  would-change to product.costPrice:       ${changedIngredients}`);
  console.log(`  product has no costPrice (skipped):      ${missingCostPrice}`);
  console.log(`Templates affected: ${updates.length} of ${templates.length}`);

  // Show a small sample diff
  console.log('\nSample changes (up to 10):');
  let shown = 0;
  for (const u of updates) {
    if (shown >= 10) break;
    const orig = templates.find(t => String(t._id) === String(u._id));
    const diffs = u.newIngredients.map((ni, i) => {
      const oi = orig.ingredients[i];
      if (oi.costPerUnit !== ni.costPerUnit) {
        return `    ${ni.name}: ${oi.costPerUnit} → ${ni.costPerUnit}`;
      }
      return null;
    }).filter(Boolean);
    if (diffs.length) {
      console.log(`  [${u.templateName}]`);
      diffs.slice(0, 3).forEach(d => console.log(d));
      if (diffs.length > 3) console.log(`    …and ${diffs.length - 3} more`);
      shown++;
    }
  }

  if (warnings.length) {
    console.log(`\nWarnings: ${warnings.length} (first 5):`);
    warnings.slice(0, 5).forEach(w => console.log('  ', JSON.stringify(w)));
  }

  const report = { mode: EXECUTE ? 'execute' : 'dry-run', target: TARGET_DB, timestamp: new Date().toISOString(),
    totalIngredients, alreadyCorrect, changedIngredients, missingCostPrice,
    templatesAffected: updates.length, totalTemplates: templates.length,
    warnings };

  if (EXECUTE && updates.length) {
    console.log('\nExecuting updates…');
    const ops = updates.map(u => ({
      updateOne: {
        filter: { _id: u._id },
        update: { $set: { ingredients: u.newIngredients } },
      }
    }));
    const result = await db.collection('blendtemplates').bulkWrite(ops, { ordered: false });
    console.log(`Updated: matched=${result.matchedCount} modified=${result.modifiedCount}`);
    report.writeResult = { matched: result.matchedCount, modified: result.modifiedCount };
  }

  const outPath = resolve(__dirname, EXECUTE ? `fix-blend-costs-${TARGET_DB}-result.json` : `fix-blend-costs-${TARGET_DB}-dryrun.json`);
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\nWrote ${outPath}`);

  await client.close();
}

main().catch(err => { console.error(err); process.exit(1); });
