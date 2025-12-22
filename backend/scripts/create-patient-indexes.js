/**
 * Script to create MongoDB indexes for optimal patient search performance
 * Run this script to improve patient search speed
 */

const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;

async function createPatientIndexes() {
  if (!MONGODB_URI) {
    console.error('MONGODB_URI environment variable is required');
    process.exit(1);
  }

  const client = new MongoClient(MONGODB_URI);
  
  try {
    console.log('Connecting to MongoDB...');
    await client.connect();
    
    const db = client.db();
    const collection = db.collection('patients');
    
    console.log('Creating indexes for patients collection...');
    
    // 1. Text index for full-text search (most important for search performance)
    await collection.createIndex(
      {
        firstName: 'text',
        lastName: 'text',
        email: 'text',
        nric: 'text',
        legacyCustomerNo: 'text',
        phone: 'text'
      },
      {
        name: 'patient_search_text',
        weights: {
          firstName: 10,
          lastName: 10,
          legacyCustomerNo: 8,
          nric: 6,
          email: 4,
          phone: 4
        },
        background: true
      }
    );
    
    // 2. Compound index for common search patterns
    await collection.createIndex(
      { firstName: 1, lastName: 1 },
      { name: 'patient_name_compound', background: true }
    );
    
    // 3. Individual indexes for quick prefix searches
    await collection.createIndex(
      { firstName: 1 },
      { name: 'patient_firstName', background: true }
    );
    
    await collection.createIndex(
      { lastName: 1 },
      { name: 'patient_lastName', background: true }
    );
    
    await collection.createIndex(
      { email: 1 },
      { name: 'patient_email', background: true }
    );
    
    await collection.createIndex(
      { phone: 1 },
      { name: 'patient_phone', background: true }
    );
    
    await collection.createIndex(
      { legacyCustomerNo: 1 },
      { name: 'patient_legacyCustomerNo', background: true }
    );
    
    await collection.createIndex(
      { nric: 1 },
      { name: 'patient_nric', background: true }
    );
    
    // 4. Status index for filtering
    await collection.createIndex(
      { status: 1 },
      { name: 'patient_status', background: true }
    );
    
    // 5. Created date index for sorting
    await collection.createIndex(
      { createdAt: -1 },
      { name: 'patient_createdAt_desc', background: true }
    );
    
    // 6. Compound index for status + created date (common query pattern)
    await collection.createIndex(
      { status: 1, createdAt: -1 },
      { name: 'patient_status_createdAt', background: true }
    );
    
    console.log('✅ Successfully created all patient indexes!');
    
    // List all indexes to verify
    const indexes = await collection.listIndexes().toArray();
    console.log('\nCurrent indexes:');
    indexes.forEach(index => {
      console.log(`- ${index.name}: ${JSON.stringify(index.key)}`);
    });
    
  } catch (error) {
    console.error('Error creating indexes:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('Database connection closed.');
  }
}

// Run the script
createPatientIndexes().catch(console.error);