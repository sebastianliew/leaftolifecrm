const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

async function analyzePatients() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB - Analyzing Patients Performance\n');
    
    const db = mongoose.connection.db;
    
    // Count total patients
    const totalCount = await db.collection('patients').countDocuments();
    console.log('Total patients in database:', totalCount);
    
    // Check indexes
    const indexes = await db.collection('patients').listIndexes().toArray();
    console.log('\nExisting indexes on patients collection:');
    indexes.forEach(idx => {
      console.log(`- ${idx.name}: ${JSON.stringify(idx.key)}`);
    });
    
    // Sample query performance
    console.log('\nTesting query performance...');
    
    // Test 1: Basic query with sort (what the app uses)
    const start1 = Date.now();
    const patients1 = await db.collection('patients')
      .find({})
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();
    const time1 = Date.now() - start1;
    console.log(`Query time for 100 patients with sort: ${time1}ms`);
    
    // Test 2: Query with search regex
    const start2 = Date.now();
    const searchRegex = new RegExp('test', 'i');
    const patients2 = await db.collection('patients')
      .find({
        $or: [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { email: searchRegex },
          { nric: searchRegex },
          { legacyCustomerNo: searchRegex }
        ]
      })
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();
    const time2 = Date.now() - start2;
    console.log(`Query time with search regex: ${time2}ms`);
    
    // Check if createdAt field exists on all documents
    const withCreatedAt = await db.collection('patients').countDocuments({ createdAt: { $exists: true } });
    const withoutCreatedAt = totalCount - withCreatedAt;
    console.log(`\nDocuments with createdAt: ${withCreatedAt}`);
    console.log(`Documents without createdAt: ${withoutCreatedAt}`);
    
    // Check field types
    const samplePatients = await db.collection('patients').find({}).limit(5).toArray();
    console.log('\nSample patient createdAt values:');
    samplePatients.forEach((p, i) => {
      console.log(`Patient ${i + 1}: createdAt = ${p.createdAt} (type: ${typeof p.createdAt})`);
    });
    
    // Recommend indexes
    console.log('\n=== RECOMMENDATIONS ===');
    
    const hasCreatedAtIndex = indexes.some(idx => idx.key.createdAt !== undefined);
    if (!hasCreatedAtIndex) {
      console.log('\n⚠️  Missing index on createdAt field!');
      console.log('This is likely causing slow performance when sorting by date.');
      console.log('Run this command to create the index:');
      console.log('db.patients.createIndex({ createdAt: -1 })');
    }
    
    const hasTextSearchFields = indexes.some(idx => 
      idx.key.firstName !== undefined || 
      idx.key.lastName !== undefined || 
      idx.key.email !== undefined
    );
    
    if (!hasTextSearchFields) {
      console.log('\n⚠️  Missing indexes for search fields!');
      console.log('Consider creating compound indexes for search:');
      console.log('db.patients.createIndex({ firstName: 1, lastName: 1 })');
      console.log('db.patients.createIndex({ email: 1 })');
      console.log('db.patients.createIndex({ legacyCustomerNo: 1 })');
    }
    
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  } catch (error) {
    console.error('Error:', error);
  }
}

analyzePatients();