import { MongoClient } from 'mongodb';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

async function getPatientCount() {
  let client = null;
  
  try {
    const MONGODB_URI = process.env.MONGODB_URI;
    if (!MONGODB_URI) {
      throw new Error('MONGODB_URI environment variable is required');
    }

    console.log('🔌 Connecting to MongoDB Atlas...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('✅ Connected to MongoDB Atlas');

    const db = client.db();
    const collection = db.collection('patients');

    // Get total patient count
    const totalCount = await collection.countDocuments();
    console.log(`📈 Total patients in database: ${totalCount}`);

    // Get additional statistics
    const activeCount = await collection.countDocuments({ status: 'active' });
    const inactiveCount = await collection.countDocuments({ status: 'inactive' });
    const withConsentCount = await collection.countDocuments({ hasConsent: true });
    
    // Get recent registrations (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentCount = await collection.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });

    console.log(`👥 Active patients: ${activeCount}`);
    console.log(`💤 Inactive patients: ${inactiveCount}`);
    console.log(`✅ Patients with consent: ${withConsentCount}`);
    console.log(`🆕 New patients (last 30 days): ${recentCount}`);

  } catch (error) {
    console.error('❌ Query failed:', error);
  } finally {
    if (client) {
      await client.close();
      console.log('🔌 Database connection closed');
    }
    process.exit(0);
  }
}

// Run the query
console.log('🚀 Getting patient count from MongoDB Atlas...');
getPatientCount();