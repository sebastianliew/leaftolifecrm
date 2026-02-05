/**
 * Migration: Update legacy name-based productIds in historical transactions
 * 
 * This script:
 * 1. Finds all transaction items with non-ObjectId productIds
 * 2. Matches them to actual Products using multiple strategies
 * 3. Updates productId to the real ObjectId
 * 4. Stamps costPrice on each item (captured retroactively from Product)
 * 
 * Run with --dry-run first to review changes without applying them.
 * Run with --apply to actually update the database.
 * 
 * Usage:
 *   node scripts/migrate-legacy-productids.cjs --dry-run
 *   node scripts/migrate-legacy-productids.cjs --apply
 */
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const DRY_RUN = !process.argv.includes('--apply');

// ============================================================================
// MATCHING ENGINE
// ============================================================================

// Brand prefix normalization
const BRAND_MAPPINGS = [
  [/^MEDIHERB\s*/i, 'MH '],
  [/^MediHerb\s*/i, 'MH '],
  [/^Mediherb\s*/i, 'MH '],
];

function stripParenthetical(s) {
  return s.replace(/\s*\([^)]*\)/g, '').trim();
}

function normalizeBrand(s) {
  for (const [pattern, replacement] of BRAND_MAPPINGS) {
    if (pattern.test(s)) return s.replace(pattern, replacement);
  }
  return s;
}

function normalizeForMatch(s) {
  return normalizeBrand(stripParenthetical(s))
    .toUpperCase()
    .replace(/[''`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripQuantitySuffix(s) {
  // Remove trailing quantity indicators: "x 3", "3x", "3 x", "x3"
  return s.replace(/\s*x\s*\d+\s*$/i, '').replace(/\s*\d+\s*x\s*$/i, '').trim();
}

function stripUnitSuffix(s) {
  // Remove trailing units: 60c, 90, 100ml, 30ml, 200, 118ml, etc.
  return s.replace(/\s+\d+\s*(c|ml|g|tabs?|tablets?|capsules?|pack)?\s*$/i, '').trim();
}

class ProductMatcher {
  constructor(products) {
    this.products = products;
    this.exactMap = new Map();        // exact uppercase name → product
    this.normalizedMap = new Map();   // normalized name → product
    this.strippedMap = new Map();     // normalized + stripped of units → product
    this.coreWordsMap = new Map();    // core words → product

    for (const p of products) {
      const upper = p.name.toUpperCase();
      const norm = normalizeForMatch(p.name);
      const stripped = stripUnitSuffix(stripQuantitySuffix(norm));
      
      this.exactMap.set(upper, p);
      if (!this.normalizedMap.has(norm)) this.normalizedMap.set(norm, p);
      if (!this.strippedMap.has(stripped)) this.strippedMap.set(stripped, p);
      
      // Core words (3+ chars)
      const words = norm.replace(/[^A-Z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length >= 3);
      const key = words.sort().join('|');
      if (key && !this.coreWordsMap.has(key)) this.coreWordsMap.set(key, p);
    }
  }

  match(legacyId, itemName) {
    // Try matching using both legacyId and itemName
    const candidates = [legacyId, itemName].filter(Boolean);
    
    for (const candidate of candidates) {
      // Strategy 1: Exact uppercase match
      const upper = candidate.toUpperCase();
      if (this.exactMap.has(upper)) {
        return { product: this.exactMap.get(upper), method: 'exact' };
      }
    }

    for (const candidate of candidates) {
      // Strategy 2: Normalized match (brand prefix, parenthetical removed)
      const norm = normalizeForMatch(candidate);
      if (this.normalizedMap.has(norm)) {
        return { product: this.normalizedMap.get(norm), method: 'normalized' };
      }
    }

    for (const candidate of candidates) {
      // Strategy 3: Stripped of quantity suffixes (x3, 3x) and unit suffixes
      const norm = normalizeForMatch(candidate);
      const stripped = stripUnitSuffix(stripQuantitySuffix(norm));
      if (stripped.length >= 3 && this.strippedMap.has(stripped)) {
        return { product: this.strippedMap.get(stripped), method: 'stripped' };
      }
    }

    for (const candidate of candidates) {
      // Strategy 4: Clean match (remove all spaces and compare)
      const clean = normalizeForMatch(candidate).replace(/[\s\-]/g, '');
      for (const [, prod] of this.normalizedMap) {
        const prodClean = normalizeForMatch(prod.name).replace(/[\s\-]/g, '');
        if (clean === prodClean) {
          return { product: prod, method: 'clean' };
        }
        // Also check startsWith for cases like "PHYTOEFA" matching "PHYTOEFA OLD"
        if (clean.length >= 4 && (prodClean.startsWith(clean) || clean.startsWith(prodClean))) {
          return { product: prod, method: 'prefix' };
        }
      }
    }

    for (const candidate of candidates) {
      // Strategy 5: Word overlap (>= 60% match)
      const norm = normalizeForMatch(candidate);
      const words = norm.replace(/[^A-Z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length >= 3);
      if (words.length === 0) continue;
      
      let bestScore = 0;
      let bestProduct = null;
      
      for (const prod of this.products) {
        const prodNorm = normalizeForMatch(prod.name);
        const prodWords = prodNorm.replace(/[^A-Z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length >= 3);
        if (prodWords.length === 0) continue;
        
        let overlap = 0;
        for (const w of words) {
          if (prodWords.some(pw => pw === w || pw.includes(w) || w.includes(pw))) overlap++;
        }
        
        const score = overlap / words.length;
        if (score > bestScore && score >= 0.6) {
          bestScore = score;
          bestProduct = prod;
        }
      }
      
      if (bestProduct) {
        return { product: bestProduct, method: `word_overlap(${bestScore.toFixed(2)})` };
      }
    }

    return null;
  }
}

// ============================================================================
// NON-PRODUCT CATEGORIES (skip these — they're not real products)
// ============================================================================
function isNonProduct(pid, name) {
  const combined = `${pid} ${name}`.toLowerCase();
  const patterns = [
    /^manual_\d+$/,
    /^unknown_\d+$/,
    /^misc_/,
    /^custom_blend_/,
    /^consultation/,
    /consultation\s*\d+/,
    /^consultation-/,
    /^delivery$/,
    /^shipping$/,
    /^postage/,
    /^credit/,
    /^pay\s*now/,
    /^offset/,
    /retreat/,
    /workshop/,
    /seminar/,
    /epimapping/i,
    /microbiome/i,
    /dutch.*test/i,
    /organic.*acid/i,
    /food.*intol/i,
    /hair.*mineral/i,
    /^epi-?map/i,
    /^(test|aaa|asd|xxx)\b/i,
    /unknown\s*(item|product)/i,
    /^rental/i,
    /credit.*card.*fee/i,
    /advanced.*hormone/i,
    /essential.*mineral.*heavy/i,
  ];
  return patterns.some(p => p.test(pid) || p.test(name));
}

// ============================================================================
// MAIN MIGRATION
// ============================================================================
async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(DRY_RUN ? '  DRY RUN — No changes will be made' : '  ⚠️  APPLYING CHANGES TO DATABASE');
  console.log(`${'='.repeat(60)}\n`);

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB\n');

  const TransactionCol = mongoose.connection.collection('transactions');
  const ProductCol = mongoose.connection.collection('products');

  // Load all products
  const allProducts = await ProductCol.find({}, { name: 1, costPrice: 1, sellingPrice: 1 }).toArray();
  console.log(`Loaded ${allProducts.length} products`);

  const matcher = new ProductMatcher(allProducts);

  // Find all completed transactions
  const transactions = await TransactionCol.find(
    { type: 'COMPLETED', status: 'completed' },
    { items: 1, transactionNumber: 1, createdAt: 1 }
  ).toArray();
  console.log(`Found ${transactions.length} completed transactions\n`);

  // Also build a map of ObjectId products for costPrice stamping
  const productByIdMap = new Map();
  allProducts.forEach(p => productByIdMap.set(String(p._id), p));

  let txnsUpdated = 0;
  let itemsUpdated = 0;
  let itemsSkipped = 0;
  let itemsNonProduct = 0;
  let itemsCostStamped = 0;
  let itemsAlreadyGood = 0;
  const matchMethodCounts = {};
  const unmatchedItems = [];
  const bulkOps = [];

  for (const txn of transactions) {
    if (!txn.items || !Array.isArray(txn.items)) continue;

    let txnModified = false;
    const updatedItems = txn.items.map(item => {
      const pid = String(item.productId || '');
      const isObjectId = pid.length === 24 && /^[a-fA-F0-9]{24}$/.test(pid);
      const itemCopy = { ...item };

      // Case 1: Already a valid ObjectId — just stamp costPrice if missing
      if (isObjectId) {
        if (itemCopy.costPrice === undefined || itemCopy.costPrice === null) {
          const prod = productByIdMap.get(pid);
          if (prod && prod.costPrice > 0) {
            itemCopy.costPrice = prod.costPrice;
            itemsCostStamped++;
            txnModified = true;
          }
        } else {
          itemsAlreadyGood++;
        }
        return itemCopy;
      }

      // Case 2: Non-product item (consultation, delivery, etc.) — skip matching
      if (isNonProduct(pid, item.name || '')) {
        // Still stamp costPrice = 0 for services
        if (itemCopy.costPrice === undefined || itemCopy.costPrice === null) {
          itemCopy.costPrice = 0;
          itemsCostStamped++;
          txnModified = true;
        }
        itemsNonProduct++;
        return itemCopy;
      }

      // Case 3: Legacy name-based ID — try to match
      const result = matcher.match(pid, item.name || '');
      if (result) {
        itemCopy.productId = String(result.product._id);
        itemCopy.costPrice = result.product.costPrice || 0;
        matchMethodCounts[result.method] = (matchMethodCounts[result.method] || 0) + 1;
        itemsUpdated++;
        txnModified = true;
      } else {
        // Unmatched — stamp costPrice 0 so it's not null
        if (itemCopy.costPrice === undefined || itemCopy.costPrice === null) {
          itemCopy.costPrice = 0;
          txnModified = true;
        }
        itemsSkipped++;
        const revenue = item.totalPrice || 0;
        if (revenue > 0) {
          unmatchedItems.push({ pid, name: item.name, revenue });
        }
      }

      return itemCopy;
    });

    if (txnModified) {
      txnsUpdated++;
      bulkOps.push({
        updateOne: {
          filter: { _id: txn._id },
          update: { $set: { items: updatedItems } }
        }
      });
    }
  }

  // Apply changes
  if (!DRY_RUN && bulkOps.length > 0) {
    console.log(`\nApplying ${bulkOps.length} transaction updates...`);
    // Process in batches of 500
    for (let i = 0; i < bulkOps.length; i += 500) {
      const batch = bulkOps.slice(i, i + 500);
      const result = await TransactionCol.bulkWrite(batch);
      console.log(`  Batch ${Math.floor(i / 500) + 1}: ${result.modifiedCount} modified`);
    }
    console.log('Done!\n');
  }

  // Report
  console.log('=== Migration Summary ===');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'APPLIED'}`);
  console.log(`Transactions modified: ${txnsUpdated} / ${transactions.length}`);
  console.log(`Items with legacy ID → matched to Product: ${itemsUpdated}`);
  console.log(`Items with valid ObjectId (costPrice stamped): ${itemsCostStamped}`);
  console.log(`Items already had costPrice: ${itemsAlreadyGood}`);
  console.log(`Non-product items (consultation/delivery/etc): ${itemsNonProduct}`);
  console.log(`Unmatched product items: ${itemsSkipped}`);

  console.log('\n=== Match Methods ===');
  Object.entries(matchMethodCounts).sort((a, b) => b[1] - a[1]).forEach(([m, c]) => {
    console.log(`  ${m}: ${c}`);
  });

  // Show top unmatched by revenue
  unmatchedItems.sort((a, b) => b.revenue - a.revenue);
  const totalUnmatchedRevenue = unmatchedItems.reduce((s, i) => s + i.revenue, 0);
  console.log(`\n=== Top Unmatched Items ($${totalUnmatchedRevenue.toFixed(2)} total revenue) ===`);
  unmatchedItems.slice(0, 20).forEach(i => {
    console.log(`  $${i.revenue.toFixed(2)} | ${i.pid} | ${i.name}`);
  });

  // Write full report
  const reportPath = path.join(__dirname, 'migration-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    mode: DRY_RUN ? 'dry-run' : 'applied',
    txnsModified: txnsUpdated,
    itemsMatched: itemsUpdated,
    itemsCostStamped: itemsCostStamped,
    itemsNonProduct: itemsNonProduct,
    itemsUnmatched: itemsSkipped,
    matchMethods: matchMethodCounts,
    unmatchedItems: unmatchedItems.slice(0, 50),
  }, null, 2));
  console.log(`\nFull report: ${reportPath}`);

  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
