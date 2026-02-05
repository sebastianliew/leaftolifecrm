/**
 * Fix B De-stress Bundle - update productId to current product
 */
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const { MongoClient, ObjectId } = require('mongodb');
const MONGO_URI = 'mongodb+srv://adminbem:digitalmission2126@leaftolife.tc2dczj.mongodb.net/l2l';

const OLD_PRODUCT_ID = '687891b9ba15b900731aceb0';  // deleted
const NEW_PRODUCT_ID = '688d973a153da45f3a529c7d';  // current B-Destress

async function main() {
  const client = new MongoClient(MONGO_URI);
  
  try {
    await client.connect();
    const db = client.db('l2l');
    const bundles = db.collection('bundles');
    
    // Find the bundle
    const bundle = await bundles.findOne({ name: 'B De-stress Bundle' });
    
    if (!bundle) {
      console.log('Bundle not found!');
      return;
    }
    
    console.log('BEFORE:');
    console.log('  Bundle: ' + bundle.name);
    console.log('  Product ref: ' + bundle.bundleProducts[0].productId);
    console.log('  Product name: ' + bundle.bundleProducts[0].name);
    
    // Update the productId
    const result = await bundles.updateOne(
      { _id: bundle._id },
      { 
        $set: { 
          'bundleProducts.0.productId': NEW_PRODUCT_ID,
          'bundleProducts.0.name': 'B-Destress',
          'updatedAt': new Date()
        } 
      }
    );
    
    console.log('\n✅ Updated: ' + result.modifiedCount + ' document');
    
    // Verify
    const updated = await bundles.findOne({ _id: bundle._id });
    console.log('\nAFTER:');
    console.log('  Bundle: ' + updated.name);
    console.log('  Product ref: ' + updated.bundleProducts[0].productId);
    console.log('  Product name: ' + updated.bundleProducts[0].name);
    
  } finally {
    await client.close();
  }
}

main();
