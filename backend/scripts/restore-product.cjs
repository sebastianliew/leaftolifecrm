const { MongoClient, ObjectId } = require('mongodb');

const uri = 'mongodb+srv://adminbem:digitalmission2126@leaftolife.tc2dczj.mongodb.net/l2l?retryWrites=true&w=majority';

async function restoreProduct() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB Atlas');

    const db = client.db('l2l');
    const products = db.collection('products');

    const productId = '68b66fc6485bd1528bed0f8d';

    // Update the product to restore it
    const result = await products.updateOne(
      { _id: new ObjectId(productId) },
      {
        $set: {
          isDeleted: false,
          isActive: true,
          status: 'active',
          updatedAt: new Date()
        },
        $unset: {
          deletedAt: '',
          deletedBy: '',
          deleteReason: ''
        }
      }
    );

    if (result.modifiedCount === 1) {
      console.log('\n✓ Product restored successfully!\n');

      // Fetch and display the updated product
      const updated = await products.findOne({ _id: new ObjectId(productId) });
      console.log('Updated product:');
      console.log(`  Name: ${updated.name}`);
      console.log(`  SKU: ${updated.sku}`);
      console.log(`  Status: ${updated.status}`);
      console.log(`  isActive: ${updated.isActive}`);
      console.log(`  isDeleted: ${updated.isDeleted}`);
      console.log(`  Current Stock: ${updated.currentStock}`);
      console.log(`  Selling Price: $${updated.sellingPrice}`);
    } else {
      console.log('No product was updated. Product may not exist.');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

restoreProduct();
