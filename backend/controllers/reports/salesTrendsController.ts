import { Request, Response } from 'express';
import { Transaction } from '../../models/Transaction.js';
import { Product } from '../../models/Product.js';

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

// Lean transaction type for optimized queries (subset of ITransaction)
interface LeanTransaction {
  createdAt: Date;
  totalAmount?: number;
  items?: Array<{
    productId?: string;
    name?: string;
    itemType?: string;
    totalPrice?: number;
    unitPrice?: number;
    costPrice?: number; // Captured at point of sale (new transactions)
    quantity?: number;
    customBlendData?: {
      totalIngredientCost?: number;
    };
  }>;
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

      // Get transactions for the period with .lean() for better memory efficiency
      // Uses compound index: { createdAt: -1, status: 1, type: 1 }
      const transactions = await Transaction.find({
        createdAt: { $gte: startDate, $lte: endDate },
        status: 'completed',
        type: 'COMPLETED'
      })
        .select('createdAt totalAmount items') // Only select needed fields
        .lean() as LeanTransaction[];

      // Generate daily data
      const dailyData = await generateDailyData(transactions, startDate, days);

      // Generate category data
      const categoryData = await generateCategoryData(transactions);

      // Generate top products data
      const topProducts = await generateTopProductsData(transactions);


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

async function generateDailyData(transactions: LeanTransaction[], startDate: Date, days: number): Promise<SalesTrendData[]> {
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

  // ========================================================================
  // Build a cost price lookup for historical transactions that don't have
  // costPrice embedded. New transactions capture costPrice at point of sale.
  // ========================================================================
  const productIdsNeedingLookup = new Set<string>();
  transactions.forEach(transaction => {
    transaction.items?.forEach(item => {
      // Only need lookup if item doesn't have costPrice stored
      if (item.costPrice === undefined || item.costPrice === null) {
        const pid = item.productId ? String(item.productId) : '';
        if (pid && /^[a-fA-F0-9]{24}$/.test(pid)) {
          productIdsNeedingLookup.add(pid);
        }
      }
    });
  });

  // Fetch cost prices for products that need it (historical data fallback)
  const fallbackCostMap = new Map<string, number>();
  if (productIdsNeedingLookup.size > 0) {
    const products = await Product.find(
      { _id: { $in: Array.from(productIdsNeedingLookup) } },
      { _id: 1, costPrice: 1 }
    ).lean();
    products.forEach((p: { _id: unknown; costPrice?: number }) => {
      fallbackCostMap.set(String(p._id), p.costPrice || 0);
    });
  }
  
  // Aggregate transaction data with real cost calculations
  transactions.forEach(transaction => {
    const dateKey = transaction.createdAt.toISOString().split('T')[0];
    const existing = dailyMap.get(dateKey);
    
    if (existing) {
      existing.revenue += transaction.totalAmount || 0;
      existing.transactions += 1;

      // Calculate cost from item-level data
      let transactionCost = 0;
      if (transaction.items && Array.isArray(transaction.items)) {
        transaction.items.forEach(item => {
          const qty = item.quantity || 0;

          if (item.costPrice !== undefined && item.costPrice !== null) {
            // New transactions: costPrice captured at point of sale
            transactionCost += qty * item.costPrice;
          } else if (item.itemType === 'custom_blend' && item.customBlendData?.totalIngredientCost) {
            // Custom blends: use totalIngredientCost
            transactionCost += item.customBlendData.totalIngredientCost;
          } else {
            // Historical fallback: look up current Product costPrice
            const pid = item.productId ? String(item.productId) : '';
            const fallbackCost = fallbackCostMap.get(pid) || 0;
            transactionCost += qty * fallbackCost;
          }
        });
      }

      existing.cost += transactionCost;
      existing.profit += (transaction.totalAmount || 0) - transactionCost;
    }
  });
  
  return Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}

async function generateCategoryData(transactions: LeanTransaction[]): Promise<CategoryData[]> {
  const categoryMap = new Map<string, number>();
  let totalRevenue = 0;

  transactions.forEach(transaction => {
    if (!transaction.items || !Array.isArray(transaction.items)) {
      return;
    }

    transaction.items.forEach((item) => {
      if (!item) {
        return;
      }
      
      // Transaction items don't have category information stored
      // Using itemType as a category proxy
      const category = item.itemType || 'product';
      const revenue = item.totalPrice || 0;

      if (revenue > 0) {
        categoryMap.set(category, (categoryMap.get(category) || 0) + revenue);
        totalRevenue += revenue;
      }
    });
  });
  
  const result = Array.from(categoryMap.entries())
    .map(([category, revenue]) => ({
      category,
      revenue,
      percentage: totalRevenue > 0 ? Math.round((revenue / totalRevenue) * 100 * 10) / 10 : 0
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);
  return result;
}

async function generateTopProductsData(transactions: LeanTransaction[]): Promise<TopProductData[]> {
  const productMap = new Map<string, { revenue: number; quantity: number }>();

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
      }
    });
  });
  
  const result = Array.from(productMap.entries())
    .map(([product, data]) => ({
      product,
      revenue: data.revenue,
      quantity: data.quantity
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);
  return result;
}