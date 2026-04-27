/**
 * Apply stock deductions for the inventorymovements synced from l2l → l2l_prod
 * on 2026-04-24. Scope is strictly the 17 transactions whose transactionDate
 * is after the 22/04 03:29 UTC cutover.
 *
 * Safe by default (dry-run). Pass --execute to write.
 *
 *   MONGODB_URI='<l2l_prod uri>' npx tsx scripts/apply-synced-movements-to-stock.ts
 *   MONGODB_URI='<l2l_prod uri>' npx tsx scripts/apply-synced-movements-to-stock.ts --execute
 */

import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const EXECUTE = process.argv.includes('--execute');
const CUTOVER = new Date('2026-04-22T03:29:24.484Z');
const DEDUCTION_TYPES = [
  'sale',
  'fixed_blend',
  'custom_blend',
  'bundle_sale',
  'bundle_blend_ingredient',
  'blend_ingredient',
];

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set');
  await mongoose.connect(uri);

  const dbName = mongoose.connection.db?.databaseName ?? '(unknown)';
  console.log(`connected: db=${dbName}  mode=${EXECUTE ? 'EXECUTE' : 'DRY-RUN'}`);

  const Txs = mongoose.connection.collection('transactions');
  const Mvs = mongoose.connection.collection('inventorymovements');
  const Prods = mongoose.connection.collection('products');

  const txs = await Txs.find(
    { transactionDate: { $gt: CUTOVER } },
    { projection: { transactionNumber: 1 } },
  ).toArray();
  const nums = txs.map((t: any) => t.transactionNumber);
  console.log(`transactions in scope: ${nums.length}`);

  const movs = await Mvs.find({
    reference: { $in: nums },
    movementType: { $in: DEDUCTION_TYPES },
  }).toArray();
  console.log(`deduction movements: ${movs.length}`);

  // aggregate per product
  const perProduct = new Map<
    string,
    { total: number; looseTotal: number; n: number; pools: Record<string, number> }
  >();
  for (const m of movs) {
    const pid = m.productId.toString();
    const qty = (m.convertedQuantity ?? m.quantity ?? 0) as number;
    const entry = perProduct.get(pid) ?? { total: 0, looseTotal: 0, n: 0, pools: {} };
    entry.total += qty;
    entry.n += 1;
    const pool = m.pool ?? '(none)';
    entry.pools[pool] = (entry.pools[pool] ?? 0) + qty;
    if (m.pool === 'loose') entry.looseTotal += qty;
    perProduct.set(pid, entry);
  }

  console.log(`unique products affected: ${perProduct.size}\n`);

  const pad = (s: any, n: number) => String(s).padEnd(n);
  const rpad = (s: any, n: number) => String(s).padStart(n);

  console.log(
    pad('Product', 44) +
      rpad('Movs', 5) +
      rpad('Deduct', 10) +
      rpad('OldStock', 12) +
      rpad('NewStock', 12) +
      rpad('ΔLoose', 10) +
      '  Pools',
  );
  console.log('-'.repeat(110));

  const plans: Array<{
    prodId: any;
    name: string;
    oldCurrent: number;
    newCurrent: number;
    oldAvail: number;
    newAvail: number;
    oldLoose: number;
    newLoose: number;
    entry: any;
  }> = [];

  for (const [pid, entry] of perProduct.entries()) {
    const prod = await Prods.findOne({ _id: new mongoose.Types.ObjectId(pid) });
    if (!prod) {
      console.log(`!! product ${pid} not found — ${entry.n} movements will have no effect`);
      continue;
    }
    const oldCurrent = (prod.currentStock ?? 0) as number;
    const oldAvail = (prod.availableStock ?? 0) as number;
    const oldLoose = (prod.looseStock ?? 0) as number;
    const newCurrent = oldCurrent - entry.total;
    const newAvail = oldAvail - entry.total;
    const newLoose = oldLoose - entry.looseTotal;
    plans.push({
      prodId: prod._id,
      name: String(prod.name ?? '(unnamed)'),
      oldCurrent,
      newCurrent,
      oldAvail,
      newAvail,
      oldLoose,
      newLoose,
      entry,
    });

    const poolSummary = Object.entries(entry.pools)
      .map(([p, q]) => `${p}=${q}`)
      .join(' ');
    console.log(
      pad(prod.name?.substring(0, 43) ?? '(unnamed)', 44) +
        rpad(entry.n, 5) +
        rpad(entry.total, 10) +
        rpad(oldCurrent, 12) +
        rpad(newCurrent, 12) +
        rpad(entry.looseTotal ? entry.looseTotal : '-', 10) +
        '  ' +
        poolSummary,
    );
  }

  const sumDeduct = plans.reduce((s, p) => s + p.entry.total, 0);
  const goesNegative = plans.filter(p => p.newCurrent < 0);

  console.log('');
  console.log(`total deduction units across all products: ${sumDeduct}`);
  console.log(`products whose stock would go negative: ${goesNegative.length}`);
  if (goesNegative.length) {
    goesNegative.forEach(p =>
      console.log(`  !! ${p.name}: ${p.oldCurrent} → ${p.newCurrent}`),
    );
  }

  if (!EXECUTE) {
    console.log('\nDRY-RUN complete. No writes. Re-run with --execute to apply.');
    await mongoose.disconnect();
    return;
  }

  console.log('\nEXECUTING writes...');
  let applied = 0;
  for (const p of plans) {
    const $set: Record<string, number> = {
      currentStock: p.newCurrent,
      availableStock: p.newAvail,
    };
    if (p.entry.looseTotal > 0) $set.looseStock = p.newLoose;
    await Prods.updateOne({ _id: p.prodId }, { $set });
    applied += 1;
  }
  console.log(`applied to ${applied} products`);
  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
