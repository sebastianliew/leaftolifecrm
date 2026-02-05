/**
 * Partial Bundle Fix - Only what we CAN fix
 * 1. Remove test bundles
 * 2. Fix B-Destress bundle (product exists)
 * 3. Create Activated B6 x 3 and EPIMAPPING X 4 (products exist)
 */

const { MongoClient, ObjectId } = require('mongodb');
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const uri = 'mongodb+srv://adminbem:digitalmission2126@leaftolife.tc2dczj.mongodb.net/l2l?retryWrites=true&w=majority&journal=true&wtimeoutMS=10000&appName=Leaftolife';

const ADMIN_USER_ID = '6882f247d5f2f8bb1d963c78'; // Sebastian Liew

const TEST_BUNDLE_PATTERNS = [
  /^test$/i,
  /^test\s*bundle/i,
  /^test\s*buundle/i,
  /^aaa+\s*test/i,
  /safe to delete/i
];

async function run() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  console.log('Connected to:', db.databaseName);

  // ========== 1. REMOVE TEST BUNDLES ==========
  console.log('\n====== REMOVING TEST BUNDLES ======');
  const allBundles = await db.collection('bundles').find({}).toArray();
  let removed = 0;
  
  for (const bundle of allBundles) {
    const isTest = TEST_BUNDLE_PATTERNS.some(pattern => pattern.test(bundle.name));
    if (isTest) {
      console.log(`  Removing: "${bundle.name}"`);
      await db.collection('bundles').deleteOne({ _id: bundle._id });
      removed++;
    }
  }
  console.log(`✅ Removed ${removed} test bundles`);

  // ========== 2. FIX B-DESTRESS BUNDLE ==========
  console.log('\n====== FIXING B-DESTRESS BUNDLE ======');
  
  const bDestressProduct = await db.collection('products').findOne({
    name: { $regex: 'B-Destress', $options: 'i' },
    isDeleted: { $ne: true }
  });

  if (bDestressProduct) {
    // Find bundles that might be B-Destress related with broken refs
    const bDestressBundles = await db.collection('bundles').find({
      name: { $regex: 'destress', $options: 'i' }
    }).toArray();

    for (const bundle of bDestressBundles) {
      // Check if has broken refs
      let needsFix = false;
      for (const bp of (bundle.bundleProducts || [])) {
        const exists = await db.collection('products').findOne({ _id: new ObjectId(String(bp.productId)) });
        if (!exists) needsFix = true;
      }

      if (needsFix) {
        const qty = bundle.bundleProducts?.[0]?.quantity || 3;
        const individualTotalPrice = bDestressProduct.sellingPrice * qty;
        const savings = Math.max(0, individualTotalPrice - bundle.bundlePrice);
        const savingsPercentage = individualTotalPrice > 0 ? Math.round((savings / individualTotalPrice) * 100) : 0;

        await db.collection('bundles').updateOne(
          { _id: bundle._id },
          {
            $set: {
              bundleProducts: [{
                productId: bDestressProduct._id,
                name: bDestressProduct.name,
                quantity: qty,
                productType: 'product',
                individualPrice: bDestressProduct.sellingPrice,
                totalPrice: individualTotalPrice
              }],
              individualTotalPrice,
              savings,
              savingsPercentage,
              updatedAt: new Date()
            }
          }
        );
        console.log(`  ✅ Fixed "${bundle.name}" → ${bDestressProduct.name} (${qty}x @ $${bDestressProduct.sellingPrice})`);
      } else {
        console.log(`  ✓ "${bundle.name}" already has valid refs`);
      }
    }
  } else {
    console.log('  ❌ B-Destress product not found');
  }

  // ========== 3. CREATE ACTIVATED B6 X 3 ==========
  console.log('\n====== CREATING ACTIVATED B6 X 3 ======');
  
  const activatedB6 = await db.collection('products').findOne({
    name: { $regex: 'Activated B6', $options: 'i' },
    isDeleted: { $ne: true }
  });

  if (activatedB6) {
    const existing = await db.collection('bundles').findOne({
      name: { $regex: 'Activated B6.*3', $options: 'i' }
    });

    if (!existing) {
      const qty = 3;
      const price = 204.00;
      const individualTotalPrice = activatedB6.sellingPrice * qty;
      const savings = Math.max(0, individualTotalPrice - price);
      const savingsPercentage = individualTotalPrice > 0 ? Math.round((savings / individualTotalPrice) * 100) : 0;

      await db.collection('bundles').insertOne({
        name: 'Activated B6 x 3',
        description: `Bundle of ${qty}x ${activatedB6.name}`,
        sku: `BDL-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
        status: 'active',
        isActive: true,
        isPromoted: false,
        bundleProducts: [{
          productId: activatedB6._id,
          name: activatedB6.name,
          quantity: qty,
          productType: 'product',
          individualPrice: activatedB6.sellingPrice,
          totalPrice: individualTotalPrice
        }],
        bundlePrice: price,
        individualTotalPrice,
        savings,
        savingsPercentage,
        currency: 'SGD',
        availableQuantity: 1000,
        maxQuantity: 1000,
        reorderPoint: 5,
        tags: [],
        createdBy: new ObjectId(ADMIN_USER_ID),
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log(`  ✅ Created "Activated B6 x 3" → ${activatedB6.name} (3x @ $${activatedB6.sellingPrice}) = $${price}`);
    } else {
      console.log(`  ✓ Already exists: "${existing.name}"`);
    }
  } else {
    console.log('  ❌ Activated B6 product not found');
  }

  // ========== 4. CREATE EPIMAPPING X 4 ==========
  console.log('\n====== CREATING EPIMAPPING X 4 ======');
  
  const epiMapping = await db.collection('products').findOne({
    name: { $regex: 'EPI.*MAP', $options: 'i' },
    isDeleted: { $ne: true }
  });

  if (epiMapping) {
    const existing = await db.collection('bundles').findOne({
      name: { $regex: 'EPI.*MAP.*4', $options: 'i' }
    });

    if (!existing) {
      const qty = 4;
      const price = 884.00;
      const individualTotalPrice = epiMapping.sellingPrice * qty;
      const savings = Math.max(0, individualTotalPrice - price);
      const savingsPercentage = individualTotalPrice > 0 ? Math.round((savings / individualTotalPrice) * 100) : 0;

      await db.collection('bundles').insertOne({
        name: 'EPIMAPPING X 4',
        description: `Bundle of ${qty}x ${epiMapping.name}`,
        sku: `BDL-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
        status: 'active',
        isActive: true,
        isPromoted: false,
        bundleProducts: [{
          productId: epiMapping._id,
          name: epiMapping.name,
          quantity: qty,
          productType: 'product',
          individualPrice: epiMapping.sellingPrice,
          totalPrice: individualTotalPrice
        }],
        bundlePrice: price,
        individualTotalPrice,
        savings,
        savingsPercentage,
        currency: 'SGD',
        availableQuantity: 1000,
        maxQuantity: 1000,
        reorderPoint: 5,
        tags: [],
        createdBy: new ObjectId(ADMIN_USER_ID),
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log(`  ✅ Created "EPIMAPPING X 4" → ${epiMapping.name} (4x @ $${epiMapping.sellingPrice}) = $${price}`);
    } else {
      console.log(`  ✓ Already exists: "${existing.name}"`);
    }
  } else {
    console.log('  ❌ EPI-MAPPING product not found');
  }

  // ========== SUMMARY ==========
  console.log('\n====== WHAT STILL NEEDS FIXING ======');
  console.log('These bundles cannot be fixed because the PRODUCTS do not exist:');
  console.log('  - PhytoXin / Phytoxin bundles → need PhytoXin product');
  console.log('  - Phytodente bundles → need Phytodente product');
  console.log('  - PhytoRest bundles → need PhytoRest product');
  console.log('  - Phytometta bundles → need Phytometta product');
  console.log('  - Phyto-Puri5 bundles → need Phyto-Puri5 product');
  console.log('  - Phytoxcel bundles → need Phytoxcel product');
  console.log('  - Joint Ease x 3 → need Joint Ease product');
  console.log('  - Phytonzyme x 3 → need Phytonzyme product');
  console.log('  - PHYTOCEL X 3 → need Phytocel product');
  console.log('  - Phytocelec 3x → need Phytocelec product');
  console.log('  - Bertram tab 3x → need to clarify which Bertram (JURA or Virita)');
  console.log('\nClient needs to either:');
  console.log('  1. Create these products first, OR');
  console.log('  2. Confirm these bundles are no longer needed');

  await client.close();
  console.log('\n✅ Done');
}

run().catch(err => { console.error('ERROR:', err); process.exit(1); });
