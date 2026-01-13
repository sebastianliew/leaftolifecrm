const { MongoClient } = require('mongodb');

const uri = 'mongodb+srv://adminbem:digitalmission2126@leaftolife.tc2dczj.mongodb.net/l2l?retryWrites=true&w=majority';

async function findProduct() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB Atlas');

    const db = client.db('l2l');
    const products = db.collection('products');

    // Search for Eagle Zinc Powder 125g
    const searchTerm = 'Eagle Zinc Powder 125g';

    // Try exact match first
    let result = await products.findOne({ name: searchTerm });

    if (!result) {
      // Try case-insensitive regex search
      result = await products.findOne({
        name: { $regex: searchTerm, $options: 'i' }
      });
    }

    if (!result) {
      // Try partial match
      const results = await products.find({
        name: { $regex: 'Eagle.*Zinc.*Powder', $options: 'i' }
      }).toArray();

      if (results.length > 0) {
        console.log(`\nFound ${results.length} matching product(s):\n`);
        results.forEach((p, i) => {
          console.log(`--- Product ${i + 1} ---`);
          console.log(JSON.stringify(p, null, 2));
        });
      } else {
        // Try even broader search
        const broadResults = await products.find({
          name: { $regex: 'Zinc.*Powder', $options: 'i' }
        }).toArray();

        if (broadResults.length > 0) {
          console.log(`\nNo exact match found. Found ${broadResults.length} similar product(s):\n`);
          broadResults.forEach((p, i) => {
            console.log(`--- Product ${i + 1} ---`);
            console.log(JSON.stringify(p, null, 2));
          });
        } else {
          console.log('\nNo products found matching "Eagle Zinc Powder 125g" or similar.');
        }
      }
    } else {
      console.log('\nFound product:\n');
      console.log(JSON.stringify(result, null, 2));
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

findProduct();
