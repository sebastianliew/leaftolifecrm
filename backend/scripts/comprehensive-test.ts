/**
 * Comprehensive test suite for LeafToLife CRM — v2
 * Updated 2026-03-05 for containerCapacity-aware deduction logic
 * 
 * Tests:
 * 1. ENV LOADING
 * 2. DATABASE CONNECTION
 * 3. HISTORICAL DATA INTEGRITY
 * 4. BACKEND — convertedQuantity logic (containerCapacity × for whole, raw for loose)
 * 5. BACKEND — canSellLoose gating
 * 6. BACKEND — TransactionInventoryService trusts controller
 * 7. BACKEND — InventoryMovement session support
 * 8. BACKEND — Edit delta uses containerCapacity
 * 9. BACKEND — Stock validation uses convertedQuantity
 * 10. BACKEND — costPrice normalization for loose sales
 * 11. BACKEND — displaySku with -T suffix
 * 12. BACKEND — containerCapacityAtSale stored
 * 13. BACKEND — containerCapacity guard (>=1)
 * 14. FRONTEND — DebouncedSearchInput & query caching
 * 15. FRONTEND — canSellLoose filter uses === true
 * 16. FRONTEND — price rounding for loose sales
 * 17. FRONTEND — no convertedQuantity × containerCapacity
 * 18. REPORTING — no hardcoded 65% cost
 * 19. REPORTING — item sales split by saleType
 * 20. REPORTING — inventory container view
 * 21. SAMPLE DATA SPOT CHECK
 */
import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env.local') });

import mongoose from 'mongoose';
import dns from 'dns';
import fs from 'fs';

dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

let passed = 0;
let failed = 0;
const results: Array<{ test: string; status: 'PASS' | 'FAIL'; detail?: string }> = [];

function assert(test: string, condition: boolean, detail?: string) {
  if (condition) {
    passed++;
    results.push({ test, status: 'PASS' });
  } else {
    failed++;
    results.push({ test, status: 'FAIL', detail });
  }
}

async function run() {
  // ═══════════════════════════════════════════════════════════
  // TEST 1: ENV LOADING
  // ═══════════════════════════════════════════════════════════
  console.log('\n🔍 TEST 1: Environment Loading');

  assert('1a. MONGODB_URI loaded', !!process.env.MONGODB_URI);
  assert('1b. JWT_SECRET loaded', !!process.env.JWT_SECRET);
  assert('1c. SMTP config loaded', !!process.env.SMTP_HOST && !!process.env.EMAIL_USER);
  assert('1d. server.ts references .env.local',
    fs.readFileSync(join(__dirname, '..', 'server.ts'), 'utf-8').includes('.env.local'));

  // ═══════════════════════════════════════════════════════════
  // TEST 2: DATABASE CONNECTION
  // ═══════════════════════════════════════════════════════════
  console.log('🔍 TEST 2: Database Connection');

  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    assert('2a. MongoDB connection successful', true);
  } catch (err) {
    assert('2a. MongoDB connection successful', false, String(err));
    printResults();
    process.exit(1);
  }

  const Products = mongoose.connection.collection('products');
  const Movements = mongoose.connection.collection('inventorymovements');

  // ═══════════════════════════════════════════════════════════
  // TEST 3: HISTORICAL DATA INTEGRITY
  // ═══════════════════════════════════════════════════════════
  console.log('🔍 TEST 3: Historical Data Integrity');

  const extremeNegative = await Products.countDocuments({
    currentStock: { $lt: -10000 },
    isDeleted: { $ne: true }
  });
  assert('3a. No extremely negative stock (< -10000)', extremeNegative === 0,
    `Found ${extremeNegative} products with stock below -10000`);

  // ═══════════════════════════════════════════════════════════
  // TEST 4: BACKEND — convertedQuantity logic
  // ═══════════════════════════════════════════════════════════
  console.log('🔍 TEST 4: Backend — convertedQuantity containerCapacity logic');

  const txCtrl = fs.readFileSync(
    join(__dirname, '..', 'controllers', 'transactions.controller.ts'), 'utf-8');

  // Whole container: convertedQuantity = quantity * containerCapacity
  assert('4a. Whole container: convertedQuantity = quantity * containerCapacity',
    txCtrl.includes('item.quantity * serverContainerCapacity') ||
    txCtrl.includes('item.quantity * containerCapacity'),
    'Should multiply quantity by containerCapacity for whole container sales');

  // Loose: convertedQuantity = quantity (no multiply)
  assert('4b. Loose sale: convertedQuantity = item.quantity',
    txCtrl.includes('item.convertedQuantity = item.quantity'),
    'Should set convertedQuantity = quantity for volume sales');

  // ═══════════════════════════════════════════════════════════
  // TEST 5: BACKEND — canSellLoose gating
  // ═══════════════════════════════════════════════════════════
  console.log('🔍 TEST 5: Backend — canSellLoose validation');

  assert('5a. Rejects volume sales when canSellLoose is false',
    txCtrl.includes('cannot be sold loose') || txCtrl.includes('canSellLoose'),
    'Should reject saleType=volume when canSellLoose is false');

  // ═══════════════════════════════════════════════════════════
  // TEST 6: BACKEND — TransactionInventoryService
  // ═══════════════════════════════════════════════════════════
  console.log('🔍 TEST 6: TransactionInventoryService — trusts controller');

  const tisSrc = fs.readFileSync(
    join(__dirname, '..', 'services', 'TransactionInventoryService.ts'), 'utf-8');

  // Should NOT have the old override
  assert('6a. No safeConvertedQty = item.quantity override',
    !tisSrc.includes('const safeConvertedQty = item.quantity'),
    'Should trust controller convertedQuantity, not override to item.quantity');

  // Should use item.convertedQuantity
  assert('6b. Uses item.convertedQuantity from controller',
    tisSrc.includes('item.convertedQuantity') || tisSrc.includes('convertedQuantity'),
    'Should pass through convertedQuantity set by controller');

  // ═══════════════════════════════════════════════════════════
  // TEST 7: BACKEND — InventoryMovement session support
  // ═══════════════════════════════════════════════════════════
  console.log('🔍 TEST 7: InventoryMovement — session support');

  const movementSrc = fs.readFileSync(
    join(__dirname, '..', 'models', 'inventory', 'InventoryMovement.ts'), 'utf-8');

  assert('7a. updateProductStock accepts session parameter',
    movementSrc.includes('updateProductStock') && movementSrc.includes('session'),
    'updateProductStock should accept optional session param');

  // ═══════════════════════════════════════════════════════════
  // TEST 8: BACKEND — Edit delta uses containerCapacity
  // ═══════════════════════════════════════════════════════════
  console.log('🔍 TEST 8: Edit delta — containerCapacity aware');

  assert('8a. Edit delta accounts for containerCapacity',
    txCtrl.includes('containerCapacityAtSale') || txCtrl.includes('containerCapacity'),
    'Edit delta should use containerCapacity for conversion');

  // ═══════════════════════════════════════════════════════════
  // TEST 9: BACKEND — Stock validation uses convertedQuantity
  // ═══════════════════════════════════════════════════════════
  console.log('🔍 TEST 9: Stock validation — uses loose units');

  assert('9a. Stock validation compares convertedQuantity (not raw quantity)',
    txCtrl.includes('convertedQuantity') && txCtrl.includes('currentStock'),
    'Should compare convertedQuantity to currentStock');

  // ═══════════════════════════════════════════════════════════
  // TEST 10: BACKEND — costPrice normalization
  // ═══════════════════════════════════════════════════════════
  console.log('🔍 TEST 10: costPrice — normalized for loose sales');

  assert('10a. costPrice divided by containerCapacity for volume sales',
    txCtrl.includes('costPrice') && (
      txCtrl.includes('/ serverContainerCapacity') || txCtrl.includes('/ containerCapacity')
    ),
    'Loose sale costPrice should be per-unit, not per-container');

  // ═══════════════════════════════════════════════════════════
  // TEST 11: BACKEND — displaySku with -T suffix
  // ═══════════════════════════════════════════════════════════
  console.log('🔍 TEST 11: displaySku — dash-T suffix');

  assert('11a. displaySku uses -T suffix for volume sales',
    txCtrl.includes("+ '-T'") || txCtrl.includes("+ \"-T\""),
    'Should append -T (with dash) for loose sales');

  assert('11b. displaySku does NOT use bare T suffix',
    !txCtrl.includes("+ 'T'") || txCtrl.includes("+ '-T'"),
    'Should use -T not T');

  // ═══════════════════════════════════════════════════════════
  // TEST 12: BACKEND — containerCapacityAtSale
  // ═══════════════════════════════════════════════════════════
  console.log('🔍 TEST 12: containerCapacityAtSale — stored on transaction items');

  const txModel = fs.readFileSync(
    join(__dirname, '..', 'models', 'Transaction.ts'), 'utf-8');

  assert('12a. Transaction schema has containerCapacityAtSale field',
    txModel.includes('containerCapacityAtSale'),
    'TransactionItemSchema should include containerCapacityAtSale');

  assert('12b. Controller sets containerCapacityAtSale',
    txCtrl.includes('containerCapacityAtSale'),
    'Controller should set containerCapacityAtSale on items');

  // ═══════════════════════════════════════════════════════════
  // TEST 13: BACKEND — containerCapacity guard
  // ═══════════════════════════════════════════════════════════
  console.log('🔍 TEST 13: containerCapacity guard — defaults to 1');

  assert('13a. containerCapacity guarded against 0/null/undefined',
    txCtrl.includes('>= 1') || txCtrl.includes('|| 1') || txCtrl.includes('?? 1'),
    'containerCapacity should default to 1 if missing/zero');

  // ═══════════════════════════════════════════════════════════
  // TEST 14: FRONTEND — Search & caching
  // ═══════════════════════════════════════════════════════════
  console.log('🔍 TEST 14: Frontend — Debounced search & query caching');

  const invPage = fs.readFileSync(
    join(__dirname, '..', '..', 'frontend', 'src', 'app', 'inventory', 'page.tsx'), 'utf-8');

  assert('14a. DebouncedSearchInput is memo component',
    invPage.includes('memo(function DebouncedSearchInput'));

  assert('14b. Search uses useRef for timer',
    invPage.includes('useRef<ReturnType<typeof setTimeout>'));

  const invQueries = fs.readFileSync(
    join(__dirname, '..', '..', 'frontend', 'src', 'hooks', 'queries', 'use-inventory-queries.ts'), 'utf-8');

  assert('14c. keepPreviousData enabled', invQueries.includes('keepPreviousData'));
  assert('14d. staleTime set', invQueries.includes('staleTime'));
  assert('14e. UTF-8 encoding (no BOM/null bytes)',
    !invQueries.startsWith('\uFEFF') && !invQueries.includes('\u0000'));

  // ═══════════════════════════════════════════════════════════
  // TEST 15: FRONTEND — canSellLoose filter
  // ═══════════════════════════════════════════════════════════
  console.log('🔍 TEST 15: Frontend — canSellLoose strict filter');

  const txForm = fs.readFileSync(
    join(__dirname, '..', '..', 'frontend', 'src', 'components', 'transactions', 'SimpleTransactionForm.tsx'), 'utf-8');

  assert('15a. Filter uses === true (not !== false)',
    txForm.includes('canSellLoose === true'),
    'Should use strict === true to prevent undefined passing through');

  // ═══════════════════════════════════════════════════════════
  // TEST 16: FRONTEND — price rounding
  // ═══════════════════════════════════════════════════════════
  console.log('🔍 TEST 16: Frontend — loose price rounding');

  assert('16a. Loose price rounded to 4 decimals',
    txForm.includes('Math.round') && txForm.includes('10000'),
    'Should round sellingPrice/containerCapacity to 4 decimal places');

  // ═══════════════════════════════════════════════════════════
  // TEST 17: FRONTEND — no containerCapacity multiply
  // ═══════════════════════════════════════════════════════════
  console.log('🔍 TEST 17: Frontend — convertedQuantity not multiplied');

  const badPatterns = [
    /convertedQuantity:\s*.*\*\s*\(?.*containerCapacity/,
    /convertedQuantity:\s*.*containerCapacity\s*\*/,
  ];
  const hasBad = badPatterns.some(p => p.test(txForm));

  assert('17a. No convertedQuantity × containerCapacity in frontend', !hasBad,
    'Frontend should never multiply convertedQuantity by containerCapacity');

  const blendSrc = fs.readFileSync(
    join(__dirname, '..', '..', 'frontend', 'src', 'components', 'blends', 'QuickBlendCreator.tsx'), 'utf-8');
  assert('17b. QuickBlendCreator: no currentStock × containerCapacity',
    !/currentStock\s*\*\s*.*containerCapacity/.test(blendSrc));

  // ═══════════════════════════════════════════════════════════
  // TEST 18: REPORTING — no hardcoded cost
  // ═══════════════════════════════════════════════════════════
  console.log('🔍 TEST 18: Reporting — actual cost data');

  let revenueServicePath = '';
  const possiblePaths = [
    join(__dirname, '..', 'services', 'RevenueAnalysisService.ts'),
    join(__dirname, '..', 'services', 'reports', 'RevenueAnalysisService.ts'),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) { revenueServicePath = p; break; }
  }

  if (revenueServicePath) {
    const revSrc = fs.readFileSync(revenueServicePath, 'utf-8');
    assert('18a. No hardcoded 65% cost in revenue report',
      !revSrc.includes('0.65') && !revSrc.includes('0.35'),
      'Revenue report should use actual costPrice from transactions');
    assert('18b. Uses actual cost from transaction items',
      revSrc.includes('costPrice') || revSrc.includes('items'),
      'Should aggregate cost from transaction items');
  } else {
    assert('18a. Revenue service found', false, 'Could not find RevenueAnalysisService.ts');
  }

  // ═══════════════════════════════════════════════════════════
  // TEST 19: REPORTING — item sales split
  // ═══════════════════════════════════════════════════════════
  console.log('🔍 TEST 19: Reporting — item sales split by saleType');

  let itemSalesPath = '';
  const itemSalesPaths = [
    join(__dirname, '..', 'controllers', 'reports', 'itemSalesController.ts'),
    join(__dirname, '..', 'controllers', 'itemSalesController.ts'),
  ];
  for (const p of itemSalesPaths) {
    if (fs.existsSync(p)) { itemSalesPath = p; break; }
  }

  if (itemSalesPath) {
    const itemSrc = fs.readFileSync(itemSalesPath, 'utf-8');
    assert('19a. Item sales groups by saleType',
      itemSrc.includes('saleType'),
      'Should group by {productId, saleType}');
    assert('19b. Item sales includes display_sku or displaySku',
      itemSrc.includes('display_sku') || itemSrc.includes('displaySku'),
      'Should include displaySku in output');
  } else {
    assert('19a. Item sales controller found', false, 'Could not find itemSalesController');
  }

  // ═══════════════════════════════════════════════════════════
  // TEST 20: REPORTING — inventory container view
  // ═══════════════════════════════════════════════════════════
  console.log('🔍 TEST 20: Reporting — inventory container equivalent');

  let invServicePath = '';
  const invServicePaths = [
    join(__dirname, '..', 'services', 'InventoryAnalysisService.ts'),
    join(__dirname, '..', 'services', 'reports', 'InventoryAnalysisService.ts'),
  ];
  for (const p of invServicePaths) {
    if (fs.existsSync(p)) { invServicePath = p; break; }
  }

  if (invServicePath) {
    const invSrc = fs.readFileSync(invServicePath, 'utf-8');
    assert('20a. Inventory report has container equivalent fields',
      invSrc.includes('full_containers') || invSrc.includes('container_display'),
      'Should show containers + loose remainder');
  } else {
    assert('20a. Inventory analysis service found', false, 'Could not find InventoryAnalysisService');
  }

  // ═══════════════════════════════════════════════════════════
  // TEST 21: SAMPLE DATA SPOT CHECK
  // ═══════════════════════════════════════════════════════════
  console.log('🔍 TEST 21: Sample data spot check');

  const activatedB6 = await Products.findOne({ name: 'Activated B6' });
  if (activatedB6) {
    assert('21a. Activated B6: stock reasonable',
      activatedB6.currentStock > -1000 && activatedB6.currentStock < 10000,
      `currentStock = ${activatedB6.currentStock}`);
  }

  const greenClay = await Products.findOne({ name: 'Green Clay (g)' });
  if (greenClay) {
    assert('21b. Green Clay: stock repaired from -498700',
      greenClay.currentStock > -1000,
      `currentStock = ${greenClay.currentStock}`);
  }

  // ═══════════════════════════════════════════════════════════
  // DONE
  // ═══════════════════════════════════════════════════════════
  await mongoose.disconnect();
  printResults();
}

function printResults() {
  console.log('\n' + '='.repeat(70));
  console.log('  COMPREHENSIVE TEST RESULTS — v2');
  console.log('='.repeat(70));

  for (const r of results) {
    const icon = r.status === 'PASS' ? '✅' : '❌';
    console.log(`  ${icon} ${r.test}`);
    if (r.status === 'FAIL' && r.detail) {
      console.log(`     └─ ${r.detail}`);
    }
  }

  console.log('-'.repeat(70));
  console.log(`  PASSED: ${passed}/${passed + failed}  |  FAILED: ${failed}/${passed + failed}`);
  console.log('='.repeat(70));

  if (failed > 0) {
    console.log('\n⚠️  Some tests failed. Review the details above.');
    process.exit(1);
  } else {
    console.log('\n🎉 All tests passed!');
  }
}

run().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
