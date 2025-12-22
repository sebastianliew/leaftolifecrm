import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Import Transaction model
import { Transaction } from '../models/Transaction';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://adminbem:digitalmission2126@leaftolife.tc2dczj.mongodb.net/l2l?retryWrites=true&w=majority&appName=Leaftolife';

async function updateTransactionTypes() {
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB successfully');

    // First, let's analyze the current state
    console.log('\n=== Analyzing current transactions ===');
    
    const pendingSaleCount = await Transaction.countDocuments({ 
      type: 'sale', 
      paymentStatus: 'pending' 
    });
    
    const paidSaleCount = await Transaction.countDocuments({ 
      type: 'sale', 
      paymentStatus: 'paid' 
    });
    
    const totalSaleCount = await Transaction.countDocuments({ 
      type: 'sale' 
    });

    console.log(`Total transactions with type "sale": ${totalSaleCount}`);
    console.log(`- Pending payment: ${pendingSaleCount}`);
    console.log(`- Paid: ${paidSaleCount}`);

    // Update transactions with pending payment status
    console.log('\n=== Updating pending transactions to DRAFT ===');
    const pendingUpdate = await Transaction.updateMany(
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
    const paidUpdate = await Transaction.updateMany(
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
    const partialUpdate = await Transaction.updateMany(
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
    const overdueUpdate = await Transaction.updateMany(
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
    const failedUpdate = await Transaction.updateMany(
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
    const refundUpdate = await Transaction.updateMany(
      { type: 'refund' },
      { $set: { type: 'COMPLETED' } }
    );
    console.log(`Updated ${refundUpdate.modifiedCount} refund transactions to COMPLETED`);

    // Convert exchanges to COMPLETED
    const exchangeUpdate = await Transaction.updateMany(
      { type: 'exchange' },
      { $set: { type: 'COMPLETED' } }
    );
    console.log(`Updated ${exchangeUpdate.modifiedCount} exchange transactions to COMPLETED`);

    // Convert quotes to DRAFT (quotes are not completed transactions)
    const quoteUpdate = await Transaction.updateMany(
      { type: 'quote' },
      { $set: { type: 'DRAFT' } }
    );
    console.log(`Updated ${quoteUpdate.modifiedCount} quote transactions to DRAFT`);

    // Final verification
    console.log('\n=== Final verification ===');
    const draftCount = await Transaction.countDocuments({ type: 'DRAFT' });
    const completedCount = await Transaction.countDocuments({ type: 'COMPLETED' });
    const oldTypeCount = await Transaction.countDocuments({ 
      type: { $in: ['sale', 'refund', 'exchange', 'quote'] } 
    });

    console.log(`Total DRAFT transactions: ${draftCount}`);
    console.log(`Total COMPLETED transactions: ${completedCount}`);
    console.log(`Remaining old type transactions: ${oldTypeCount}`);

    console.log('\n✅ Transaction type migration completed successfully!');

  } catch (error) {
    console.error('❌ Error updating transaction types:', error);
  } finally {
    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the update
updateTransactionTypes();