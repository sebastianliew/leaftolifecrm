const { MongoClient } = require('mongodb');

const MONGODB_URI = 'mongodb+srv://adminbem:digitalmission2126@leaftolife.tc2dczj.mongodb.net/l2l?retryWrites=true&w=majority&appName=Leaftolife';

async function updateTransactionTypes() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await client.connect();
    console.log('Connected to MongoDB successfully');

    const db = client.db('l2l');
    const collection = db.collection('transactions');

    // First, let's analyze the current state
    console.log('\n=== Analyzing current transactions ===');
    
    const pendingSaleCount = await collection.countDocuments({ 
      type: 'sale', 
      paymentStatus: 'pending' 
    });
    
    const paidSaleCount = await collection.countDocuments({ 
      type: 'sale', 
      paymentStatus: 'paid' 
    });
    
    const totalSaleCount = await collection.countDocuments({ 
      type: 'sale' 
    });

    console.log(`Total transactions with type "sale": ${totalSaleCount}`);
    console.log(`- Pending payment: ${pendingSaleCount}`);
    console.log(`- Paid: ${paidSaleCount}`);

    // Update transactions with pending payment status
    console.log('\n=== Updating pending transactions to DRAFT ===');
    const pendingUpdate = await collection.updateMany(
      { 
        type: 'sale',
        paymentStatus: 'pending'
      },
      { 
        $set: { type: 'DRAFT' } 
      }
    );
    console.log(`Updated ${pendingUpdate.modifiedCount} pending transactions to DRAFT`);

    // Update transactions with paid payment status
    console.log('\n=== Updating paid transactions to COMPLETED ===');
    const paidUpdate = await collection.updateMany(
      { 
        type: 'sale',
        paymentStatus: 'paid'
      },
      { 
        $set: { type: 'COMPLETED' } 
      }
    );
    console.log(`Updated ${paidUpdate.modifiedCount} paid transactions to COMPLETED`);

    // Handle other payment statuses (partial, overdue, failed) 
    console.log('\n=== Handling other payment statuses ===');
    
    // Update partial payments to DRAFT (since they're not fully paid)
    const partialUpdate = await collection.updateMany(
      { 
        type: 'sale',
        paymentStatus: 'partial'
      },
      { 
        $set: { type: 'DRAFT' } 
      }
    );
    console.log(`Updated ${partialUpdate.modifiedCount} partial payment transactions to DRAFT`);

    // Update overdue to DRAFT (unpaid)
    const overdueUpdate = await collection.updateMany(
      { 
        type: 'sale',
        paymentStatus: 'overdue'
      },
      { 
        $set: { type: 'DRAFT' } 
      }
    );
    console.log(`Updated ${overdueUpdate.modifiedCount} overdue transactions to DRAFT`);

    // Update failed to DRAFT
    const failedUpdate = await collection.updateMany(
      { 
        type: 'sale',
        paymentStatus: 'failed'
      },
      { 
        $set: { type: 'DRAFT' } 
      }
    );
    console.log(`Updated ${failedUpdate.modifiedCount} failed transactions to DRAFT`);

    // Handle refund, exchange, quote types
    console.log('\n=== Handling other transaction types ===');
    
    // Convert refunds to COMPLETED (they represent completed refund transactions)
    const refundUpdate = await collection.updateMany(
      { type: 'refund' },
      { $set: { type: 'COMPLETED' } }
    );
    console.log(`Updated ${refundUpdate.modifiedCount} refund transactions to COMPLETED`);

    // Convert exchanges to COMPLETED
    const exchangeUpdate = await collection.updateMany(
      { type: 'exchange' },
      { $set: { type: 'COMPLETED' } }
    );
    console.log(`Updated ${exchangeUpdate.modifiedCount} exchange transactions to COMPLETED`);

    // Convert quotes to DRAFT (quotes are not completed transactions)
    const quoteUpdate = await collection.updateMany(
      { type: 'quote' },
      { $set: { type: 'DRAFT' } }
    );
    console.log(`Updated ${quoteUpdate.modifiedCount} quote transactions to DRAFT`);

    // Final verification
    console.log('\n=== Final verification ===');
    const draftCount = await collection.countDocuments({ type: 'DRAFT' });
    const completedCount = await collection.countDocuments({ type: 'COMPLETED' });
    const oldTypeCount = await collection.countDocuments({ 
      type: { $in: ['sale', 'refund', 'exchange', 'quote'] } 
    });

    console.log(`Total DRAFT transactions: ${draftCount}`);
    console.log(`Total COMPLETED transactions: ${completedCount}`);
    console.log(`Remaining old type transactions: ${oldTypeCount}`);

    console.log('\n✅ Transaction type migration completed successfully!');

  } catch (error) {
    console.error('❌ Error updating transaction types:', error);
  } finally {
    // Close the connection
    await client.close();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the update
updateTransactionTypes();