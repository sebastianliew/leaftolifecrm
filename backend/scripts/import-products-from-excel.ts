/**
 * Import products from Excel into l2l_dev database.
 *
 * - Reads stock data from Excel file
 * - Maps SKUs to production l2l ObjectIds where possible
 * - Converts pricing: loose items store per-container price
 * - Resolves category/brand/unit/container references
 *
 * Safety: DRY RUN by default. Use --execute to apply.
 */

import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env.local') });

import mongoose from 'mongoose';
import dns from 'dns';
import { readFileSync } from 'fs';
import XLSX from 'xlsx';

dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const EXECUTE_MODE = process.argv.includes('--execute');
const EXCEL_PATH = '/Users/macbookm2pro16inch/Desktop/stockdata07042026.xlsx';
const PRODUCTION_IDS_PATH = '/tmp/l2l_products.json';

// ── Manual mapping overrides for category names ──
// Excel value (lowercase) → DB category name (lowercase)
const CATEGORY_ALIASES: Record<string, string> = {
  'tea': 'herbs & teas',
  'skin care': 'personal care',
  'test': 'general',
  'test ': 'general',
  'food': 'foods',
  'consult': 'general',
  '': 'general', // Consultation items with no category
};

// Excel value (lowercase) → DB container type name (lowercase)
const CONTAINER_TYPE_ALIASES: Record<string, string> = {
  'ml': 'bottle',
  'books': 'book',
};

// Excel value (lowercase) → DB unit name or abbreviation (lowercase)
const UNIT_ALIASES: Record<string, string> = {
  'box': 'unit',
  '': 'unit', // Consultation items with no unit
};

interface ExcelRow {
  'Product Name'?: string;
  'Name change '?: string;
  'SKU'?: string;
  'Sell by unit or loose'?: string;
  'Category'?: string;
  'Container Type'?: string;
  'Container size'?: string | number;
  'Brand'?: string;
  'Unit'?: string;
  'Selling Price'?: number | string;
  'Current Stock'?: number | string;
  'Reorder Point'?: number | string;
  'Status'?: string;
  'Cost Price'?: number | string;
  'Remarks '?: string;
  'Price per Container'?: number | string;
  'Price per Unit/Content'?: number | string;
}

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set in .env.local');

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  PRODUCT IMPORT FROM EXCEL`);
  console.log(`  Mode: ${EXECUTE_MODE ? '🔴 EXECUTE' : '🟡 DRY RUN'}`);
  console.log(`${'='.repeat(60)}\n`);

  await mongoose.connect(uri);
  console.log('Connected to MongoDB:', mongoose.connection.db!.databaseName);

  const db = mongoose.connection.db!;

  // ── Phase 1: Load reference data ──

  // 1a. Production SKU → ObjectId map
  const prodMap = new Map<string, string>();
  try {
    const prodJson = JSON.parse(readFileSync(PRODUCTION_IDS_PATH, 'utf-8'));
    for (const p of prodJson) {
      if (p.sku) prodMap.set(p.sku.trim(), p._id);
    }
    console.log(`Production ID map: ${prodMap.size} entries`);
  } catch (e) {
    console.warn('Could not load production IDs — all products will get new IDs');
  }

  // 1b. Reference collection lookups
  const categories = await db.collection('categories').find({}).toArray();
  const brands = await db.collection('brands').find({}).toArray();
  const units = await db.collection('unitofmeasurements').find({}).toArray();
  const containerTypes = await db.collection('containertypes').find({}).toArray();

  // Build case-insensitive maps
  const catMap = new Map<string, mongoose.Types.ObjectId>();
  for (const c of categories) catMap.set(c.name.toLowerCase().trim(), c._id);

  const brandMap = new Map<string, mongoose.Types.ObjectId>();
  for (const b of brands) brandMap.set(b.name.toLowerCase().trim(), b._id);

  const unitMap = new Map<string, mongoose.Types.ObjectId>();
  for (const u of units) {
    unitMap.set(u.name.toLowerCase().trim(), u._id);
    if (u.abbreviation) unitMap.set(u.abbreviation.toLowerCase().trim(), u._id);
  }

  const ctMap = new Map<string, mongoose.Types.ObjectId>();
  for (const c of containerTypes) ctMap.set(c.name.toLowerCase().trim(), c._id);

  // Pre-scan Excel to find missing brands and create them
  const wb0 = XLSX.readFile(EXCEL_PATH);
  const ws0 = wb0.Sheets[wb0.SheetNames[0]];
  const preRows: ExcelRow[] = XLSX.utils.sheet_to_json(ws0);
  const missingBrands = new Set<string>();
  for (const row of preRows) {
    const b = (row['Brand'] || '').toString().trim();
    if (b && !brandMap.has(b.toLowerCase().trim())) missingBrands.add(b);
  }
  if (missingBrands.size > 0) {
    console.log(`Creating ${missingBrands.size} missing brands: ${[...missingBrands].join(', ')}`);
    if (EXECUTE_MODE) {
      for (const brandName of missingBrands) {
        const result = await db.collection('brands').insertOne({
          name: brandName,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        brandMap.set(brandName.toLowerCase().trim(), result.insertedId as unknown as mongoose.Types.ObjectId);
      }
    } else {
      console.log('  (will be created on --execute)');
      // Add placeholders for dry-run so they don't show as unmatched
      for (const brandName of missingBrands) {
        brandMap.set(brandName.toLowerCase().trim(), new mongoose.Types.ObjectId());
      }
    }
  }

  console.log(`Reference maps: ${catMap.size} categories, ${brandMap.size} brands, ${unitMap.size} units, ${ctMap.size} container types\n`);

  // Helper: resolve with aliases
  function resolveCategory(text: string | undefined): mongoose.Types.ObjectId | null {
    const key = (text || '').toLowerCase().trim();
    return catMap.get(key) || catMap.get(CATEGORY_ALIASES[key] || '') || null;
  }

  function resolveBrand(text: string | undefined): mongoose.Types.ObjectId | null {
    const key = (text || '').toLowerCase().trim();
    if (!key) return null;
    return brandMap.get(key) || null;
  }

  function resolveUnit(text: string | undefined): mongoose.Types.ObjectId | null {
    const key = (text || '').toLowerCase().trim();
    return unitMap.get(key) || unitMap.get(UNIT_ALIASES[key] || '') || null;
  }

  function resolveContainerType(text: string | undefined): mongoose.Types.ObjectId | null {
    const key = (text || '').toLowerCase().trim();
    if (!key) return null;
    return ctMap.get(key) || ctMap.get(CONTAINER_TYPE_ALIASES[key] || '') || null;
  }

  // ── Phase 2: Parse Excel ──
  const wb = XLSX.readFile(EXCEL_PATH);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: ExcelRow[] = XLSX.utils.sheet_to_json(ws);

  console.log(`Excel rows parsed: ${rows.length}\n`);

  // ── Phase 3: Transform ──
  const documents: any[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  const seenSkus = new Set<string>();
  const unmatchedCategories = new Set<string>();
  const unmatchedBrands = new Set<string>();
  const unmatchedUnits = new Set<string>();
  const unmatchedContainers = new Set<string>();
  let matchedIdCount = 0;
  let newIdCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // Excel row (1-indexed header + data)

    // Skip empty/header rows
    const sku = (row['SKU'] || '').toString().trim();
    if (!sku) {
      warnings.push(`Row ${rowNum}: No SKU, skipping`);
      continue;
    }

    // Duplicate check
    if (seenSkus.has(sku)) {
      errors.push(`Row ${rowNum}: Duplicate SKU "${sku}", skipping`);
      continue;
    }
    seenSkus.add(sku);

    // Name
    const nameChange = (row['Name change '] || '').toString().trim();
    const productName = (row['Product Name'] || '').toString().trim();
    const name = nameChange || productName;
    if (!name) {
      errors.push(`Row ${rowNum}: No name for SKU "${sku}", skipping`);
      continue;
    }

    // References
    const categoryText = (row['Category'] || '').toString().trim();
    const brandText = (row['Brand'] || '').toString().trim();
    const unitText = (row['Unit'] || '').toString().trim();
    const containerTypeText = (row['Container Type'] || '').toString().trim();

    const category = resolveCategory(categoryText);
    const brand = resolveBrand(brandText);
    const unitOfMeasurement = resolveUnit(unitText);
    const containerType = resolveContainerType(containerTypeText);

    if (!category) {
      unmatchedCategories.add(categoryText);
      errors.push(`Row ${rowNum}: Category "${categoryText}" not found for SKU "${sku}", skipping`);
      continue;
    }
    if (!unitOfMeasurement) {
      unmatchedUnits.add(unitText);
      errors.push(`Row ${rowNum}: Unit "${unitText}" not found for SKU "${sku}", skipping`);
      continue;
    }
    if (brandText && !brand) unmatchedBrands.add(brandText);
    if (containerTypeText && !containerType) unmatchedContainers.add(containerTypeText);

    // Container capacity
    const containerCapacity = parseFloat((row['Container size'] || '').toString()) || 1;

    // Loose selling
    const sellLooseFlag = (row['Sell by unit or loose'] || '').toString().trim();
    const canSellLoose = ['y', 'Y'].includes(sellLooseFlag);

    // Stock
    const currentStock = parseFloat((row['Current Stock'] || '0').toString()) || 0;
    const reorderPoint = parseFloat((row['Reorder Point'] || '10').toString()) || 10;

    // Loose stock: one open container, clamped to currentStock
    const looseStock = canSellLoose
      ? Math.min(containerCapacity, Math.max(0, currentStock))
      : 0;

    // Pricing
    // The system stores sellingPrice as PER-CONTAINER.
    // Excel pattern:
    //   - If "Price per Container" is populated → Excel "Selling Price" is per-unit, use PPC as sellingPrice
    //   - If "Price per Container" is blank    → Excel "Selling Price" IS the per-container price
    const rawSellingPrice = parseFloat((row['Selling Price'] || '0').toString()) || 0;
    const rawCostPrice = parseFloat((row['Cost Price'] || '0').toString()) || 0;
    const excelPricePerContainer = parseFloat((row['Price per Container'] || '0').toString()) || 0;
    const excelPricePerUnit = parseFloat((row['Price per Unit/Content'] || '0').toString()) || 0;

    let sellingPrice: number;
    if (excelPricePerContainer > 0) {
      // Excel Selling Price is per-unit; use the provided per-container price
      sellingPrice = excelPricePerContainer;
    } else {
      // Excel Selling Price is already per-container
      sellingPrice = rawSellingPrice;
    }

    // Cross-verify: sellingPrice / containerCapacity should ≈ per-unit price
    if (excelPricePerUnit > 0 && containerCapacity > 1) {
      const computedUnitPrice = Math.round((sellingPrice / containerCapacity) * 10000) / 10000;
      if (Math.abs(computedUnitPrice - excelPricePerUnit) > 0.01) {
        warnings.push(`Row ${rowNum} SKU "${sku}": Computed unit price ${computedUnitPrice} != Excel PPU ${excelPricePerUnit} (sellingPrice=${sellingPrice}, cap=${containerCapacity})`);
      }
    }

    // Status
    const statusText = (row['Status'] || 'Active').toString().toLowerCase().trim();
    const status = ['active', 'inactive', 'discontinued', 'pending_approval'].includes(statusText)
      ? statusText : 'active';
    const isActive = status === 'active';

    const remarks = (row['Remarks '] || '').toString().trim();
    if (remarks.toLowerCase().includes('obsolete') && status === 'active') {
      warnings.push(`Row ${rowNum} SKU "${sku}": Remarks says "Obsolete" but status is Active`);
    }

    // ID mapping
    const productionId = prodMap.get(sku);
    const _id = productionId
      ? new mongoose.Types.ObjectId(productionId)
      : new mongoose.Types.ObjectId();

    if (productionId) matchedIdCount++;
    else newIdCount++;

    // Build document
    const doc: any = {
      _id,
      name,
      sku,
      category,
      unitOfMeasurement,
      containerCapacity,
      canSellLoose,
      looseStock,
      sellingPrice,
      costPrice: rawCostPrice,
      currentStock,
      quantity: Math.max(0, currentStock),
      totalQuantity: Math.max(0, currentStock),
      availableStock: Math.max(0, currentStock),
      reservedStock: 0,
      reorderPoint,
      status,
      isActive,
      isDeleted: false,
      autoReorderEnabled: false,
      restockFrequency: 30,
      averageRestockQuantity: 0,
      restockCount: 0,
      baseUnitSize: 1,
      discountFlags: {
        discountableForAll: true,
        discountableForMembers: true,
        discountableInBlends: false,
      },
      categoryName: categoryText,
      brandName: brandText,
      unitName: unitText,
      migrationData: {
        source: 'excel-import-2026-04-08',
        importedAt: new Date(),
        originalData: {
          excelSellingPrice: rawSellingPrice,
          excelPricePerContainer: excelPricePerContainer || null,
          excelPricePerUnit: parseFloat((row['Price per Unit/Content'] || '0').toString()) || null,
          remarks,
          nameChange: nameChange || null,
          sellLooseFlag: sellLooseFlag || null,
        },
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Optional fields
    if (brand) doc.brand = brand;
    if (containerType) doc.containerType = containerType;

    documents.push(doc);
  }

  // ── Phase 4: Report ──
  console.log(`\n${'─'.repeat(60)}`);
  console.log('  TRANSFORM SUMMARY');
  console.log(`${'─'.repeat(60)}`);
  console.log(`  Total Excel rows:        ${rows.length}`);
  console.log(`  Products to insert:      ${documents.length}`);
  console.log(`  Matched production IDs:  ${matchedIdCount}`);
  console.log(`  New IDs generated:       ${newIdCount}`);
  console.log(`  Loose-selling products:  ${documents.filter(d => d.canSellLoose).length}`);
  console.log(`  Rows skipped (errors):   ${errors.length}`);

  if (unmatchedCategories.size > 0)
    console.log(`\n  Unmatched categories: ${[...unmatchedCategories].join(', ')}`);
  if (unmatchedBrands.size > 0)
    console.log(`  Unmatched brands: ${[...unmatchedBrands].join(', ')}`);
  if (unmatchedUnits.size > 0)
    console.log(`  Unmatched units: ${[...unmatchedUnits].join(', ')}`);
  if (unmatchedContainers.size > 0)
    console.log(`  Unmatched containers: ${[...unmatchedContainers].join(', ')}`);

  if (errors.length > 0) {
    console.log(`\n  ERRORS:`);
    for (const e of errors) console.log(`    ❌ ${e}`);
  }

  if (warnings.length > 0) {
    console.log(`\n  WARNINGS:`);
    for (const w of warnings) console.log(`    ⚠️  ${w}`);
  }

  // Sample documents
  console.log(`\n${'─'.repeat(60)}`);
  console.log('  SAMPLE DOCUMENTS');
  console.log(`${'─'.repeat(60)}`);

  const looseProducts = documents.filter(d => d.canSellLoose);
  const containerProducts = documents.filter(d => !d.canSellLoose);

  if (looseProducts.length > 0) {
    const sample = looseProducts[0];
    console.log(`\n  Loose item: "${sample.name}" (${sample.sku})`);
    console.log(`    sellingPrice (per-container): ${sample.sellingPrice}`);
    console.log(`    containerCapacity: ${sample.containerCapacity}`);
    console.log(`    per-unit price: ${(sample.sellingPrice / sample.containerCapacity).toFixed(4)}`);
    console.log(`    Excel original price: ${sample.migrationData.originalData.excelSellingPrice}`);
    console.log(`    looseStock: ${sample.looseStock}`);
    console.log(`    currentStock: ${sample.currentStock}`);
  }

  if (containerProducts.length > 0) {
    const sample = containerProducts[0];
    console.log(`\n  Container item: "${sample.name}" (${sample.sku})`);
    console.log(`    sellingPrice: ${sample.sellingPrice}`);
    console.log(`    containerCapacity: ${sample.containerCapacity}`);
    console.log(`    currentStock: ${sample.currentStock}`);
  }

  // ── Phase 5: Insert ──
  if (EXECUTE_MODE) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log('  INSERTING...');
    console.log(`${'─'.repeat(60)}`);

    const collection = db.collection('products');

    // Check if collection already has data
    const existingCount = await collection.countDocuments();
    if (existingCount > 0) {
      console.log(`  ⚠️  products collection already has ${existingCount} documents!`);
      console.log(`  Aborting to prevent duplicates. Drop the collection first if you want to reimport.`);
      await mongoose.disconnect();
      process.exit(1);
    }

    const result = await collection.insertMany(documents, { ordered: false });
    console.log(`  ✅ Inserted ${result.insertedCount} products`);

    // Post-insert verification
    const finalCount = await collection.countDocuments();
    console.log(`  Final product count: ${finalCount}`);

    // Spot-check a loose item
    if (looseProducts.length > 0) {
      const check = await collection.findOne({ sku: looseProducts[0].sku });
      if (check) {
        const unitPrice = check.sellingPrice / (check.containerCapacity || 1);
        console.log(`\n  Verification (loose): "${check.name}"`);
        console.log(`    sellingPrice=${check.sellingPrice}, capacity=${check.containerCapacity}, unitPrice=${unitPrice.toFixed(4)}`);
        console.log(`    Excel original: ${check.migrationData?.originalData?.excelSellingPrice}`);
        console.log(`    Match: ${Math.abs(unitPrice - check.migrationData?.originalData?.excelSellingPrice) < 0.01 ? '✅' : '❌'}`);
      }
    }

    // Spot-check a container item
    if (containerProducts.length > 0) {
      const check = await collection.findOne({ sku: containerProducts[0].sku });
      if (check) {
        console.log(`\n  Verification (container): "${check.name}"`);
        console.log(`    sellingPrice=${check.sellingPrice}`);
        console.log(`    Excel original: ${check.migrationData?.originalData?.excelSellingPrice}`);
        console.log(`    Match: ${Math.abs(check.sellingPrice - check.migrationData?.originalData?.excelSellingPrice) < 0.01 ? '✅' : '❌'}`);
      }
    }
  } else {
    console.log(`\n  DRY RUN complete. Use --execute to insert ${documents.length} products.`);
  }

  await mongoose.disconnect();
  console.log('\nDone.');
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
