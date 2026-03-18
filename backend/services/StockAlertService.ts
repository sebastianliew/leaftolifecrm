/**
 * StockAlertService — Server-side stock alert generation.
 *
 * Generates alerts for low stock, out of stock, and expired products.
 * Replaces the frontend `useStockAlerts.generateAlerts()` logic.
 */

import { Product } from '../models/Product.js';

export interface StockAlert {
  id: string;
  productId: string;
  productName: string;
  alertType: 'low_stock' | 'out_of_stock' | 'expired';
  currentLevel: number;
  threshold: number;
  message: string;
  priority: 'critical' | 'high' | 'medium';
  isActive: boolean;
  createdAt: string;
}

class StockAlertService {
  async getAlerts(): Promise<StockAlert[]> {
    const products = await Product.find({
      isDeleted: { $ne: true },
      isActive: { $ne: false },
    })
      .select('_id name currentStock reorderPoint expiryDate')
      .lean() as unknown as Array<{
        _id: unknown;
        name: string;
        currentStock: number;
        reorderPoint: number;
        expiryDate?: Date;
      }>;

    const alerts: StockAlert[] = [];
    const now = new Date();

    for (const product of products) {
      const productId = String(product._id);

      // Out of stock
      if (product.currentStock === 0) {
        alerts.push({
          id: `alert_${productId}_out`,
          productId,
          productName: product.name,
          alertType: 'out_of_stock',
          currentLevel: 0,
          threshold: 0,
          message: `${product.name} is out of stock`,
          priority: 'high',
          isActive: true,
          createdAt: now.toISOString(),
        });
      }
      // Low stock
      else if (product.currentStock <= product.reorderPoint && product.currentStock > 0) {
        alerts.push({
          id: `alert_${productId}_low`,
          productId,
          productName: product.name,
          alertType: 'low_stock',
          currentLevel: product.currentStock,
          threshold: product.reorderPoint,
          message: `${product.name} is running low (${product.currentStock} remaining)`,
          priority: 'medium',
          isActive: true,
          createdAt: now.toISOString(),
        });
      }

      // Expired stock
      if (product.expiryDate) {
        const expiryDate = new Date(product.expiryDate);
        const daysUntilExpiry = Math.ceil(
          (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysUntilExpiry < 0) {
          alerts.push({
            id: `alert_${productId}_expired`,
            productId,
            productName: product.name,
            alertType: 'expired',
            currentLevel: product.currentStock,
            threshold: 0,
            message: `${product.name} has expired (${Math.abs(daysUntilExpiry)} days ago)`,
            priority: 'critical',
            isActive: true,
            createdAt: now.toISOString(),
          });
        }
      }
    }

    return alerts;
  }
}

export const stockAlertService = new StockAlertService();
