const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

async function optimizePatientsCollection() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB - Optimizing Patients Collection\n');
    
    const db = mongoose.connection.db;
    const collection = db.collection('patients');
    
    console.log('=== CREATING OPTIMIZED INDEXES ===\n');
    
    // 1. Create index for default sort (createdAt descending)
    console.log('Creating index for createdAt (descending)...');
    try {
      await collection.createIndex({ createdAt: -1 });
      console.log('✅ Created index: { createdAt: -1 }');
    } catch (error) {
      console.log('❌ Failed to create createdAt index:', error.message);
    }
    
    // 2. Create compound index for search with sort
    console.log('\nCreating compound indexes for search optimization...');
    try {
      // This helps when searching and sorting
      await collection.createIndex({ 
        firstName: 1, 
        lastName: 1, 
        createdAt: -1 
      });
      console.log('✅ Created compound index for name search with sort');
    } catch (error) {
      console.log('❌ Failed to create name search index:', error.message);
    }
    
    // 3. Test performance after indexing
    console.log('\n=== TESTING PERFORMANCE AFTER INDEXING ===\n');
    
    // Test 1: Basic query with sort
    const start1 = Date.now();
    const patients1 = await collection
      .find({})
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();
    const time1 = Date.now() - start1;
    console.log(`Query time for 100 patients with sort: ${time1}ms`);
    
    // Test 2: Count query (used for pagination)
    const start2 = Date.now();
    const count = await collection.countDocuments({});
    const time2 = Date.now() - start2;
    console.log(`Count query time: ${time2}ms`);
    
    // Test 3: Full page load simulation
    const start3 = Date.now();
    const [totalCount, pageData] = await Promise.all([
      collection.countDocuments({}),
      collection
        .find({})
        .sort({ createdAt: -1 })
        .skip(0)
        .limit(100)
        .toArray()
    ]);
    const time3 = Date.now() - start3;
    console.log(`Full page load simulation (count + data): ${time3}ms`);
    
    // List all indexes
    console.log('\n=== CURRENT INDEXES ===');
    const indexes = await collection.listIndexes().toArray();
    indexes.forEach(idx => {
      console.log(`- ${idx.name}: ${JSON.stringify(idx.key)}`);
    });
    
    console.log('\n=== OPTIMIZATION COMPLETE ===');
    console.log('The patients list should now load significantly faster!');
    
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error);
  }
}

optimizePatientsCollection();