const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
const { MongoClient } = require('mongodb');

async function check() {
  const client = new MongoClient('mongodb+srv://adminbem:digitalmission2126@leaftolife.tc2dczj.mongodb.net/l2l');
  await client.connect();
  const db = client.db('l2l');
  
  // Search for B De-stress or B-DESTRESS in products
  const products = await db.collection('products').find({
    name: { $regex: 'destress|de-stress', $options: 'i' }
  }).toArray();
  
  console.log('Products matching "destress" (' + products.length + '):');
  products.forEach(p => {
    console.log('  - "' + p.name + '" (ID: ' + p._id + ', active: ' + p.isActive + ')');
  });
  
  // Also check the specific deleted ID
  const deletedId = '687891b9ba15b900731aceb0';
  console.log('\nDeleted product ID: ' + deletedId);
  
  // Check if there's a B-DESTRESS that could be linked
  const bdestress = await db.collection('products').findOne({ name: 'B-DESTRESS' });
  if (bdestress) {
    console.log('\nFound B-DESTRESS product:');
    console.log('  ID: ' + bdestress._id);
    console.log('  Active: ' + bdestress.isActive);
  }
  
  await client.close();
}
check();
