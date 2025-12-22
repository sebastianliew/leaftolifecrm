import { Request, Response } from 'express';
import { Transaction, ITransaction } from '../../models/Transaction.js';

interface SalesTrendData {
  date: string;
  revenue: number;
  cost: number;
  profit: number;
  transactions: number;
}

interface CategoryData {
  category: string;
  revenue: number;
  percentage: number;
}

interface TopProductData {
  product: string;
  revenue: number;
  quantity: number;
}

interface SalesTrendsResponse {
  dailyData: SalesTrendData[];
  categoryData: CategoryData[];
  topProducts: TopProductData[];
}

export class SalesTrendsController {
  static async getSalesTrends(req: Request, res: Response): Promise<Response> {
    try {
      let startDate: Date;
      let endDate: Date;
      let days: number;

      // Check if frontend sends startDate and endDate parameters
      if (req.query.startDate && req.query.endDate) {
        startDate = new Date(req.query.startDate as string);
        endDate = new Date(req.query.endDate as string);
        days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      } else {
        // Fallback to days parameter for backward compatibility
        days = parseInt(req.query.days as string) || 30;
        endDate = new Date();
        startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
      }

      // Get transactions for the period
      const transactions = await Transaction.find({
        createdAt: { $gte: startDate, $lte: endDate },
        status: 'completed',
        type: 'COMPLETED'
      });

      console.log(`Sales Trends Debug: Found ${transactions.length} transactions between ${startDate.toISOString()} and ${endDate.toISOString()}`);
      
      // Debug: Check first transaction structure
      if (transactions.length > 0) {
        console.log('First transaction items sample:', JSON.stringify(transactions[0].items?.slice(0, 2), null, 2));
      }

      // Generate daily data
      const dailyData = await generateDailyData(transactions, startDate, days);
      
      // Generate category data
      const categoryData = await generateCategoryData(transactions);
      
      // Generate top products data
      const topProducts = await generateTopProductsData(transactions);

      console.log(`Sales Trends Debug: Generated ${dailyData.length} daily entries, ${categoryData.length} categories, ${topProducts.length} top products`);

      const response: SalesTrendsResponse = {
        dailyData,
        categoryData,
        topProducts
      };

      return res.json(response);
    } catch (error) {
      console.error('Error generating sales trends report:', error);
      return res.status(500).json({ 
        error: 'Failed to generate sales trends report',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

async function generateDailyData(transactions: ITransaction[], startDate: Date, days: number): Promise<SalesTrendData[]> {
  const dailyMap = new Map<string, SalesTrendData>();
  
  // Initialize all days with zero values
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    const dateKey = date.toISOString().split('T')[0];
    
    dailyMap.set(dateKey, {
      date: dateKey,
      revenue: 0,
      cost: 0,
      profit: 0,
      transactions: 0
    });
  }
  
  // Aggregate transaction data
  transactions.forEach(transaction => {
    const dateKey = transaction.createdAt.toISOString().split('T')[0];
    const existing = dailyMap.get(dateKey);
    
    if (existing) {
      existing.revenue += transaction.totalAmount || 0;
      existing.transactions += 1;

      // Note: Cost data not available in transaction items
      // Transaction items store name, unitPrice, quantity but not costPrice
      // Cost and profit calculations would require product lookup if needed
      existing.cost += 0;
      existing.profit += transaction.totalAmount || 0;
    }
  });
  
  return Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}

async function generateCategoryData(transactions: ITransaction[]): Promise<CategoryData[]> {
  const categoryMap = new Map<string, number>();
  let totalRevenue = 0;
  let itemsProcessed = 0;

  transactions.forEach(transaction => {
    if (!transaction.items || !Array.isArray(transaction.items)) {
      console.log(`Warning: Transaction ${transaction.transactionNumber || 'unknown'} has no items array`);
      return;
    }
    
    transaction.items.forEach((item) => {
      if (!item) {
        console.log(`Warning: Found null/undefined item in transaction ${transaction.transactionNumber || 'unknown'}`);
        return;
      }
      
      // Transaction items don't have category information stored
      // Using itemType as a category proxy
      const category = item.itemType || 'product';
      const revenue = item.totalPrice || 0;

      if (revenue > 0) {
        categoryMap.set(category, (categoryMap.get(category) || 0) + revenue);
        totalRevenue += revenue;
        itemsProcessed++;
      }
    });
  });
  
  console.log(`Category Debug: Processed ${itemsProcessed} items from ${transactions.length} transactions, total revenue: ${totalRevenue}`);
  
  const result = Array.from(categoryMap.entries())
    .map(([category, revenue]) => ({
      category,
      revenue,
      percentage: totalRevenue > 0 ? Math.round((revenue / totalRevenue) * 100 * 10) / 10 : 0
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);
    
  console.log('Category breakdown:', result);
  return result;
}

async function generateTopProductsData(transactions: ITransaction[]): Promise<TopProductData[]> {
  const productMap = new Map<string, { revenue: number; quantity: number }>();
  let productsProcessed = 0;

  transactions.forEach(transaction => {
    if (!transaction.items || !Array.isArray(transaction.items)) {
      return;
    }
    
    transaction.items.forEach((item) => {
      if (!item) {
        return;
      }
      
      const productName = item.name || 'Unknown Product';
      const revenue = item.totalPrice || 0;
      const quantity = item.quantity || 0;
      
      if (revenue > 0 || quantity > 0) {
        const existing = productMap.get(productName) || { revenue: 0, quantity: 0 };
        existing.revenue += revenue;
        existing.quantity += quantity;
        productMap.set(productName, existing);
        productsProcessed++;
      }
    });
  });
  
  console.log(`Top Products Debug: Processed ${productsProcessed} product entries, found ${productMap.size} unique products`);
  
  const result = Array.from(productMap.entries())
    .map(([product, data]) => ({
      product,
      revenue: data.revenue,
      quantity: data.quantity
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);
    
  console.log('Top products:', result.map(p => `${p.product}: $${p.revenue}`));
  return result;
}