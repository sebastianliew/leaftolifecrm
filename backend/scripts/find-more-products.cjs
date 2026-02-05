const { MongoClient } = require('mongodb');
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const uri = 'mongodb+srv://adminbem:digitalmission2126@leaftolife.tc2dczj.mongodb.net/l2l?retryWrites=true&w=majority&journal=true&wtimeoutMS=10000&appName=Leaftolife';

async function search() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  // Specific searches for what we need
  const searches = [
    { term: 'puri', label: 'Looking for Phyto-Puri5' },
    { term: 'toxin', label: 'Looking for PhytoXin' },
    { term: 'xin', label: 'Looking for PhytoXin' },
    { term: 'xcel', label: 'Looking for Phytoxcel' },
    { term: 'dente', label: 'Looking for Phytodente' },
    { term: 'rest', label: 'Looking for PhytoRest' },
    { term: 'metta', label: 'Looking for Phytometta' },
    { term: 'joint', label: 'Looking for Joint ease' },
    { term: 'ease', label: 'Looking for Joint ease' },
    { term: 'nzyme', label: 'Looking for Phytonzyme' },
    { term: 'zyme', label: 'Looking for Zyme/Phytonzyme' },
    { term: 'ubiquinol', label: 'Looking for Ubiquinol' },
    { term: 'vita', label: 'Looking for Vitabiotic' },
  ];

  console.log('Detailed product search...\n');

  for (const s of searches) {
    const products = await db.collection('products').find({
      name: { $regex: s.term, $options: 'i' },
      isDeleted: { $ne: true }
    }).project({ name: 1, sellingPrice: 1, _id: 1, isActive: 1 }).toArray();

    console.log(`\n${s.label} ("${s.term}"):`);
    if (products.length === 0) {
      console.log('  (none found)');
    } else {
      products.forEach(p => console.log(`  ✓ ${p.name} - $${p.sellingPrice} - ${p._id}`));
    }
  }

  // Count total products
  const total = await db.collection('products').countDocuments({ isDeleted: { $ne: true } });
  const deleted = await db.collection('products').countDocuments({ isDeleted: true });
  console.log(`\n\nTotal active products: ${total}`);
  console.log(`Deleted products: ${deleted}`);

  // Check if deleted products have the names we need
  console.log('\n\n=== Checking DELETED products ===');
  const deletedSearches = ['puri', 'xin', 'xcel', 'dente', 'rest', 'metta', 'joint', 'nzyme'];
  for (const term of deletedSearches) {
    const deleted = await db.collection('products').find({
      name: { $regex: term, $options: 'i' },
      isDeleted: true
    }).project({ name: 1, sellingPrice: 1, _id: 1 }).toArray();
    if (deleted.length > 0) {
      console.log(`"${term}" (DELETED):`);
      deleted.forEach(p => console.log(`  ${p.name} - $${p.sellingPrice} - ${p._id}`));
    }
  }

  await client.close();
}

search().catch(err => { console.error('ERROR:', err); process.exit(1); });
