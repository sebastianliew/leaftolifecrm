const { MongoClient } = require('mongodb');
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const uri = 'mongodb+srv://adminbem:digitalmission2126@leaftolife.tc2dczj.mongodb.net/l2l?retryWrites=true&w=majority&journal=true&wtimeoutMS=10000&appName=Leaftolife';

async function search() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  // Search for products that might match our needs
  const searches = [
    'puri', 'xin', 'xcel', 'dente', 'rest', 'metta', 'joint', 'nzyme', 'cel', 'epi', 'map'
  ];

  console.log('Searching for products...\n');

  for (const term of searches) {
    const products = await db.collection('products').find({
      name: { $regex: term, $options: 'i' },
      isDeleted: { $ne: true }
    }).project({ name: 1, sellingPrice: 1, _id: 1 }).limit(10).toArray();

    if (products.length > 0) {
      console.log(`\n"${term}":`);
      products.forEach(p => console.log(`  ${p.name} ($${p.sellingPrice}) - ${p._id}`));
    }
  }

  // Also list all Phyto products
  console.log('\n\n=== All "Phyto" products ===');
  const phytoProducts = await db.collection('products').find({
    name: { $regex: 'phyto', $options: 'i' },
    isDeleted: { $ne: true }
  }).project({ name: 1, sellingPrice: 1, _id: 1 }).toArray();
  phytoProducts.forEach(p => console.log(`  ${p.name} ($${p.sellingPrice}) - ${p._id}`));

  await client.close();
}

search().catch(err => { console.error('ERROR:', err); process.exit(1); });
