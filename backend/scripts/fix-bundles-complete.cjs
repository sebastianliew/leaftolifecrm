/**
 * Complete Bundle Fix Script
 * 1. Fix broken product references in existing bundles
 * 2. Create missing bundles from old system
 * 3. Remove test bundles
 */

const { MongoClient, ObjectId } = require('mongodb');
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const uri = 'mongodb+srv://adminbem:digitalmission2126@leaftolife.tc2dczj.mongodb.net/l2l?retryWrites=true&w=majority&journal=true&wtimeoutMS=10000&appName=Leaftolife';

// Admin user ID for createdBy
const ADMIN_USER_ID = '6882f247d5f2f8bb1d963c78'; // Sebastian Liew

// Test bundles to remove (by name pattern)
const TEST_BUNDLE_PATTERNS = [
  /^test$/i,
  /^test\s*bundle/i,
  /^test\s*buundle/i,
  /^aaa+\s*test/i,
  /safe to delete/i
];

// Missing bundles to create (from old SQL)
const MISSING_BUNDLES = [
  { name: 'Joint Ease x 3', price: 216.75, productName: 'Joint ease', quantity: 3 },
  { name: 'Phytonzyme x 3', price: 159.00, productName: 'PHYTONZYME', quantity: 3 },
  { name: 'PHYTOCEL X 3', price: 118.80, productName: 'Phytocel', quantity: 3 },
  { name: 'Activated B6 x 3', price: 204.00, productName: 'Activated B6', quantity: 3 },
  { name: 'EPIMAPPING X 4', price: 884.00, productName: 'EPIMAPPING', quantity: 4 },
  { name: 'Bertram tab 3x', price: 198.00, productName: 'Bertram', quantity: 3 },
  { name: 'Phytocelec 3x', price: 153.00, productName: 'PHYTOCELEC', quantity: 3 }
];

// Broken bundles and their expected product names
const BROKEN_BUNDLES = [
  { bundleName: 'B De-stress Bundle', productName: 'B-DESTRESS' },
  { bundleName: 'PHYTO-PURI-5', productName: 'Phyto-Puri5' },
  { bundleName: 'PHYTOXIN 100ML X 3', productName: 'PhytoXin' },
  { bundleName: 'Phytoxin 100ml x 3', productName: 'PhytoXin' },
  { bundleName: 'PHYTOXCEL X 3', productName: 'Phytoxcel' },
  { bundleName: 'PHYTODENTE X 3', productName: 'phytodente' },
  { bundleName: 'PHYTOREST X   3', productName: 'PhytoRest' },
  { bundleName: 'PHYTOMETTA X 3', productName: 'PHYTOMETTA' }
];

async function run() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  console.log('Connected to:', db.databaseName);

  const results = {
    testBundlesRemoved: [],
    brokenBundlesFixed: [],
    brokenBundlesFailed: [],
    missingBundlesCreated: [],
    missingBundlesFailed: []
  };

  // ========== 1. REMOVE TEST BUNDLES ==========
  console.log('\n====== REMOVING TEST BUNDLES ======');
  const allBundles = await db.collection('bundles').find({}).toArray();
  
  for (const bundle of allBundles) {
    const isTest = TEST_BUNDLE_PATTERNS.some(pattern => pattern.test(bundle.name));
    if (isTest) {
      console.log(`  Removing: "${bundle.name}"`);
      await db.collection('bundles').deleteOne({ _id: bundle._id });
      results.testBundlesRemoved.push(bundle.name);
    }
  }
  console.log(`Removed ${results.testBundlesRemoved.length} test bundles`);

  // ========== 2. FIX BROKEN BUNDLES ==========
  console.log('\n====== FIXING BROKEN BUNDLES ======');
  
  for (const broken of BROKEN_BUNDLES) {
    // Find the bundle
    const bundle = await db.collection('bundles').findOne({
      name: { $regex: broken.bundleName.replace(/\s+/g, '\\s*'), $options: 'i' }
    });
    
    if (!bundle) {
      console.log(`  Bundle not found: "${broken.bundleName}"`);
      continue;
    }

    // Find the correct product
    const product = await db.collection('products').findOne({
      name: { $regex: broken.productName, $options: 'i' },
      isDeleted: { $ne: true }
    });

    if (!product) {
      console.log(`  ❌ Product not found for "${broken.bundleName}": looking for "${broken.productName}"`);
      results.brokenBundlesFailed.push({ bundle: broken.bundleName, reason: `Product "${broken.productName}" not found` });
      continue;
    }

    // Check if bundle already has valid refs
    let needsFix = false;
    for (const bp of (bundle.bundleProducts || [])) {
      const existingProduct = await db.collection('products').findOne({ _id: new ObjectId(String(bp.productId)) });
      if (!existingProduct) {
        needsFix = true;
        break;
      }
    }

    if (!needsFix) {
      console.log(`  ✓ "${broken.bundleName}" already has valid product refs`);
      continue;
    }

    // Get existing quantity from bundle
    const existingQty = bundle.bundleProducts?.[0]?.quantity || 3;

    // Update bundle with correct product reference
    const updatedBundleProducts = [{
      productId: product._id,
      name: product.name,
      quantity: existingQty,
      productType: 'product',
      individualPrice: product.sellingPrice || 0,
      totalPrice: (product.sellingPrice || 0) * existingQty
    }];

    const individualTotalPrice = (product.sellingPrice || 0) * existingQty;
    const savings = Math.max(0, individualTotalPrice - bundle.bundlePrice);
    const savingsPercentage = individualTotalPrice > 0 ? Math.round((savings / individualTotalPrice) * 100) : 0;

    await db.collection('bundles').updateOne(
      { _id: bundle._id },
      {
        $set: {
          bundleProducts: updatedBundleProducts,
          individualTotalPrice: individualTotalPrice,
          savings: savings,
          savingsPercentage: savingsPercentage,
          updatedAt: new Date()
        }
      }
    );

    console.log(`  ✅ Fixed "${broken.bundleName}" → ${product.name} (${existingQty}x @ $${product.sellingPrice})`);
    results.brokenBundlesFixed.push({ bundle: broken.bundleName, product: product.name });
  }

  // ========== 3. CREATE MISSING BUNDLES ==========
  console.log('\n====== CREATING MISSING BUNDLES ======');

  for (const missing of MISSING_BUNDLES) {
    // Check if already exists
    const existing = await db.collection('bundles').findOne({
      name: { $regex: missing.name.replace(/\s+/g, '\\s*'), $options: 'i' }
    });

    if (existing) {
      console.log(`  Already exists: "${missing.name}"`);
      continue;
    }

    // Find the product
    const product = await db.collection('products').findOne({
      name: { $regex: missing.productName, $options: 'i' },
      isDeleted: { $ne: true }
    });

    if (!product) {
      console.log(`  ❌ Product not found for "${missing.name}": looking for "${missing.productName}"`);
      results.missingBundlesFailed.push({ bundle: missing.name, reason: `Product "${missing.productName}" not found` });
      continue;
    }

    const individualTotalPrice = (product.sellingPrice || 0) * missing.quantity;
    const savings = Math.max(0, individualTotalPrice - missing.price);
    const savingsPercentage = individualTotalPrice > 0 ? Math.round((savings / individualTotalPrice) * 100) : 0;

    // Generate SKU
    const sku = `BDL-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    const newBundle = {
      name: missing.name,
      description: `Bundle of ${missing.quantity}x ${product.name}`,
      sku: sku,
      status: 'active',
      isActive: true,
      isPromoted: false,
      bundleProducts: [{
        productId: product._id,
        name: product.name,
        quantity: missing.quantity,
        productType: 'product',
        individualPrice: product.sellingPrice || 0,
        totalPrice: (product.sellingPrice || 0) * missing.quantity
      }],
      bundlePrice: missing.price,
      individualTotalPrice: individualTotalPrice,
      savings: savings,
      savingsPercentage: savingsPercentage,
      currency: 'SGD',
      availableQuantity: 1000,
      maxQuantity: 1000,
      reorderPoint: 5,
      tags: [],
      createdBy: new ObjectId(ADMIN_USER_ID),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await db.collection('bundles').insertOne(newBundle);
    console.log(`  ✅ Created "${missing.name}" → ${product.name} (${missing.quantity}x @ $${product.sellingPrice}) = $${missing.price}`);
    results.missingBundlesCreated.push({ bundle: missing.name, product: product.name, price: missing.price });
  }

  // ========== SUMMARY ==========
  console.log('\n====== SUMMARY ======');
  console.log(`Test bundles removed: ${results.testBundlesRemoved.length}`);
  results.testBundlesRemoved.forEach(n => console.log(`  - ${n}`));
  
  console.log(`\nBroken bundles fixed: ${results.brokenBundlesFixed.length}`);
  results.brokenBundlesFixed.forEach(b => console.log(`  - ${b.bundle} → ${b.product}`));
  
  console.log(`\nBroken bundles FAILED: ${results.brokenBundlesFailed.length}`);
  results.brokenBundlesFailed.forEach(b => console.log(`  - ${b.bundle}: ${b.reason}`));
  
  console.log(`\nMissing bundles created: ${results.missingBundlesCreated.length}`);
  results.missingBundlesCreated.forEach(b => console.log(`  - ${b.bundle} → ${b.product} ($${b.price})`));
  
  console.log(`\nMissing bundles FAILED: ${results.missingBundlesFailed.length}`);
  results.missingBundlesFailed.forEach(b => console.log(`  - ${b.bundle}: ${b.reason}`));

  await client.close();
  console.log('\n✅ Done');
}

run().catch(err => { console.error('ERROR:', err); process.exit(1); });
