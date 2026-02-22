import { Product } from '../models/Product.js';
import { Patient } from '../models/Patient.js';
import { DashboardStats } from '../dashboard/types/dashboard.types.js';
import connectDB from '../lib/mongodb.js';

export class DashboardStatsService {
  async getDashboardStats(): Promise<DashboardStats> {
    await connectDB();

    // Get total products count
    const totalProducts = await Product.countDocuments();

    // Get active patients count (exclude deactivated)
    const activePatients = await Patient.countDocuments({ status: 'active' });

    // Get low stock alerts (products with currentStock <= reorderPoint or negative)
    const lowStockCount = await Product.countDocuments({
      $expr: { $lte: ['$currentStock', '$reorderPoint'] }
    });
    
    // Get oversold products count (negative stock)
    const oversoldCount = await Product.countDocuments({
      currentStock: { $lt: 0 }
    });

    // Get expired products count
    const expiredProductsCount = await Product.countDocuments({
      expiryDate: { $lt: new Date() }
    });

    // Get expiring soon products count (expiring within 30 days)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const expiringSoonProductsCount = await Product.countDocuments({
      expiryDate: { 
        $gte: new Date(), // Not expired yet
        $lte: thirtyDaysFromNow // But expiring within 30 days
      }
    });

    // Calculate total inventory value - accounting safe (only positive stock)
    const productsWithStock = await Product.find({}, 'costPrice currentStock');
    const totalValue = productsWithStock.reduce((sum, product) => {
      const positiveStock = Math.max(0, product.currentStock || 0);
      return sum + ((product.costPrice || 0) * positiveStock);
    }, 0);

    // Calculate product growth based on creation dates
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const currentMonthProducts = await Product.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });

    const previousMonthProducts = await Product.countDocuments({
      createdAt: { 
        $gte: sixtyDaysAgo,
        $lt: thirtyDaysAgo
      }
    });

    const productGrowth = previousMonthProducts > 0 
      ? Math.round(((currentMonthProducts - previousMonthProducts) / previousMonthProducts) * 100)
      : 0;

    // For patient growth, we'll calculate based on creation date if available
    const currentMonthPatients = await Patient.countDocuments({ status: 'active',
      createdAt: { $gte: thirtyDaysAgo }
    });
    
    const previousMonthPatients = await Patient.countDocuments({ status: 'active',
      createdAt: { 
        $gte: sixtyDaysAgo,
        $lt: thirtyDaysAgo
      }
    });

    const patientGrowth = previousMonthPatients > 0 
      ? Math.round(((currentMonthPatients - previousMonthPatients) / previousMonthPatients) * 100)
      : 0;

    return {
      totalProducts,
      activePatients,
      lowStockAlerts: lowStockCount,
      oversoldProducts: oversoldCount,
      expiredProducts: expiredProductsCount,
      expiringSoonProducts: expiringSoonProductsCount,
      totalValue: Math.round(totalValue * 100) / 100, // Round to 2 decimal places
      productGrowth,
      patientGrowth
    };
  }
}