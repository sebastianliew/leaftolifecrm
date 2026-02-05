/**
 * Remove test bundles from MongoDB
 * 
 * Run with: node scripts/remove-test-bundles.cjs
 */

// Fix Globe Broadband DNS issue with MongoDB SRV records
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URI = 'mongodb+srv://adminbem:digitalmission2126@leaftolife.tc2dczj.mongodb.net/l2l';

// Specific test bundle to remove (identified from review)
const TEST_BUNDLE_ID = '6980446505407e5cfc058fee'; // "Epi map test x 3"

async function main() {
  const client = new MongoClient(MONGO_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB\n');
    
    const db = client.db('l2l');
    const bundleCollection = db.collection('bundles');
    const transactionCollection = db.collection('transactions');
    
    // Find the test bundle
    const testBundle = await bundleCollection.findOne({ _id: new ObjectId(TEST_BUNDLE_ID) });
    
    if (!testBundle) {
      console.log('Test bundle not found (may have already been deleted)');
      return;
    }
    
    console.log('='.repeat(60));
    console.log('TEST BUNDLE TO REMOVE:');
    console.log('='.repeat(60));
    console.log(`\n📦 "${testBundle.name}"`);
    console.log(`   ID: ${testBundle._id}`);
    console.log(`   Created: ${testBundle.createdAt || 'unknown'}`);
    console.log(`   Products: ${testBundle.products?.length || 0}`);
    
    // Check for transaction references
    const txCount = await transactionCollection.countDocuments({
      'items.bundleId': testBundle._id
    });
    
    if (txCount > 0) {
      console.log(`   ⚠️  WARNING: ${txCount} transactions reference this bundle!`);
      console.log(`   Proceeding anyway (transactions have bundleData snapshots)...`);
    } else {
      console.log(`   ✅ No transactions reference this bundle`);
    }
    
    // Delete it
    console.log('\n🗑️  Deleting test bundle...\n');
    
    const deleteResult = await bundleCollection.deleteOne({ _id: new ObjectId(TEST_BUNDLE_ID) });
    
    if (deleteResult.deletedCount === 1) {
      console.log(`✅ Successfully deleted "${testBundle.name}"`);
    } else {
      console.log('❌ Delete failed');
    }
    
    // Show remaining bundle count
    const remaining = await bundleCollection.countDocuments({});
    console.log(`\nRemaining bundles in system: ${remaining}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('\nConnection closed.');
  }
}

main();
