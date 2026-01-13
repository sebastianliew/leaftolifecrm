import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { Product } from '../models/Product.js';
import { Transaction } from '../models/Transaction.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

async function analyzeProductCosts() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('Connected to MongoDB');

    // Get all products with missing or zero cost price
    const productsWithNoCost = await Product.find({
      $or: [
        { costPrice: 0 },
        { costPrice: null },
        { costPrice: { $exists: false } }
      ],
      isDeleted: { $ne: true }
    }).select('name sku sellingPrice costPrice category brand');

    console.log(`\nFound ${productsWithNoCost.length} products with missing or zero cost price:\n`);

    // Get recent transactions to identify which products are actively being sold
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 90); // Last 90 days

    const recentTransactions = await Transaction.aggregate([
      {
        $match: {
          type: 'COMPLETED',
          status: 'completed',
          createdAt: { $gte: recentDate }
        }
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productId',
          productName: { $first: '$items.name' },
          totalSold: { $sum: '$items.quantity' },
          totalRevenue: { $sum: '$items.totalPrice' },
          itemType: { $first: '$items.itemType' },
          transactionCount: { $sum: 1 }
        }
      },
      { $sort: { totalRevenue: -1 } }
    ]);

    // Create a map of product IDs that have been sold recently
    const recentlySoldProducts = new Map(
      recentTransactions.map(item => [item._id, item])
    );

    // Analyze products with no cost that are being actively sold
    console.log('Products with NO COST PRICE that are ACTIVELY BEING SOLD:');
    console.log('=' .repeat(80));

    let activeNoCostCount = 0;
    interface ProblemProduct {
      product: typeof productsWithNoCost[number];
      salesData: typeof recentTransactions[number];
    }
    const problemProducts: ProblemProduct[] = [];

    for (const product of productsWithNoCost) {
      const productIdStr = product._id.toString();
      const salesData = recentlySoldProducts.get(productIdStr);
      
      if (salesData) {
        activeNoCostCount++;
        problemProducts.push({
          product,
          salesData
        });
        
        console.log(`\nProduct: ${product.name}`);
        console.log(`SKU: ${product.sku}`);
        console.log(`Selling Price: $${product.sellingPrice || 'Not set'}`);
        console.log(`Cost Price: $${product.costPrice || '0 (MISSING)'}`);
        console.log(`Item Type: ${salesData.itemType}`);
        console.log(`Recent Sales: ${salesData.totalSold} units in ${salesData.transactionCount} transactions`);
        console.log(`Total Revenue: $${salesData.totalRevenue.toFixed(2)}`);
        console.log(`IMPLIED 100% MARGIN due to missing cost!`);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log(`\nSUMMARY:`);
    console.log(`- Total products with missing/zero cost: ${productsWithNoCost.length}`);
    console.log(`- Products actively being sold with no cost: ${activeNoCostCount}`);
    
    // Analyze by item type
    const itemTypeAnalysis = recentTransactions.reduce((acc, item) => {
      const type = item.itemType || 'product';
      if (!acc[type]) {
        acc[type] = { count: 0, revenue: 0, withCost: 0, withoutCost: 0 };
      }
      acc[type].count++;
      acc[type].revenue += item.totalRevenue;
      
      // Check if this product has cost
      const hasNoCost = problemProducts.some(p => p.product._id.toString() === item._id);
      if (hasNoCost) {
        acc[type].withoutCost++;
      } else {
        acc[type].withCost++;
      }
      
      return acc;
    }, {} as Record<string, { count: number; revenue: number; withCost: number; withoutCost: number }>);

    console.log('\nANALYSIS BY ITEM TYPE:');
    console.log('='.repeat(80));

    type ItemTypeData = { count: number; revenue: number; withCost: number; withoutCost: number };
    (Object.entries(itemTypeAnalysis) as [string, ItemTypeData][]).forEach(([type, data]) => {
      console.log(`\n${type.toUpperCase()}:`);
      console.log(`- Total items sold: ${data.count}`);
      console.log(`- Items with cost data: ${data.withCost}`);
      console.log(`- Items WITHOUT cost data: ${data.withoutCost} (showing 100% margin)`);
      console.log(`- Total revenue: $${data.revenue.toFixed(2)}`);
    });

    // Generate recommendations
    console.log('\n' + '='.repeat(80));
    console.log('\nRECOMMENDATIONS:');
    console.log('1. Update cost prices for all active products listed above');
    console.log('2. For custom blends, implement cost calculation based on components');
    console.log('3. For consultations/services, define appropriate cost structures');
    console.log('4. Consider marking items as "Cost N/A" instead of showing 100% margin');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the analysis
analyzeProductCosts();