import express, { Request, Response, type IRouter } from 'express';
import { ItemSalesController } from '../controllers/reports/itemSalesController.js';
import { ReportsController } from '../controllers/reports.controller.js';
import { SalesTrendsController } from '../controllers/reports/salesTrendsController.js';
import { CustomerValueController } from '../controllers/reports/customerValueController.js';
import { InventoryAnalysisController } from '../controllers/reports/InventoryAnalysisController.js';
import { InventoryCostController } from '../controllers/reports/InventoryCostController.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { requirePermission } from '../middlewares/permission.middleware.js';

const router: IRouter = express.Router();

// Apply authentication middleware to all report routes
router.use(authenticateToken);

// Transaction date range endpoint (financial report)
router.get('/transaction-date-range', requirePermission('reports', 'canViewFinancialReports'), async (req: Request, res: Response) => {
  try {
    const { Transaction } = await import('../models/Transaction.js');
    
    const dateRangeQuery = await Transaction.aggregate([
      { $match: { type: 'sale', status: 'completed' } },
      { 
        $group: {
          _id: null,
          minDate: { $min: '$createdAt' },
          maxDate: { $max: '$createdAt' },
          count: { $sum: 1 }
        }
      }
    ]);
    
    if (dateRangeQuery.length > 0) {
      res.json({
        success: true,
        data: {
          earliest: dateRangeQuery[0].minDate,
          latest: dateRangeQuery[0].maxDate,
          count: dateRangeQuery[0].count
        }
      });
    } else {
      res.json({
        success: false,
        error: 'No transactions found',
        data: null
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch transaction date range',
      data: null 
    });
  }
});

// Item Sales Report endpoint (inventory report)
router.get('/item-sales', requirePermission('reports', 'canViewInventoryReports'), async (req: Request, res: Response) => {
  try {
    
    await ItemSalesController.getItemSalesReport(req as unknown as Parameters<typeof ItemSalesController.getItemSalesReport>[0], res as Parameters<typeof ItemSalesController.getItemSalesReport>[1]);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Revenue Analysis endpoint (financial report)
router.get('/revenue-analysis', requirePermission('reports', 'canViewFinancialReports'), ReportsController.getRevenueAnalysis);

// Sales Trends endpoint (financial report)
router.get('/sales-trends', requirePermission('reports', 'canViewFinancialReports'), SalesTrendsController.getSalesTrends);

// Customer Value Report endpoint (financial report)
router.get('/customer-value', requirePermission('reports', 'canViewFinancialReports'), async (req: Request, res: Response) => {
  try {
    await CustomerValueController.getCustomerValueReport(req as unknown as Parameters<typeof CustomerValueController.getCustomerValueReport>[0], res as Parameters<typeof CustomerValueController.getCustomerValueReport>[1]);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Inventory Analysis Report endpoint (inventory report)
router.get('/inventory-analysis', requirePermission('reports', 'canViewInventoryReports'), InventoryAnalysisController.getInventoryReport);

// Inventory Cost Report endpoint (inventory report)
router.get('/inventory-cost', requirePermission('reports', 'canViewInventoryReports'), async (req: Request, res: Response) => {
  try {
    await InventoryCostController.getInventoryCostReport(req as unknown as Parameters<typeof InventoryCostController.getInventoryCostReport>[0], res as Parameters<typeof InventoryCostController.getInventoryCostReport>[1]);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// TODO: Add other report endpoints here
// router.get('/customer-insights', CustomerInsightsController.getCustomerInsights);

export default router;