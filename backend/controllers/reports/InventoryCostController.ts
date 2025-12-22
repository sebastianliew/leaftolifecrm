import { Request, Response } from 'express'
import { 
  InventoryCostService, 
  InventoryCostAnalysisData 
} from '../../services/InventoryCostService.js'
import { 
  InventoryCostResponse, 
  InventoryCostFilters 
} from '../../types/reports/inventory-cost.types.js'

export class InventoryCostController {
  static async getInventoryCostReport(
    req: Request<Record<string, never>, Record<string, never>, Record<string, never>, InventoryCostFilters>,
    res: Response<InventoryCostResponse>
  ): Promise<void> {
    try {
      // Extract query parameters with proper typing
      const filters: InventoryCostFilters = {
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        categoryId: req.query.categoryId,
        minStock: req.query.minStock,
        maxStock: req.query.maxStock,
        stockStatus: req.query.stockStatus,
        sortBy: req.query.sortBy || 'total_cost',
        sortOrder: req.query.sortOrder || 'desc'
      }

      // Get analysis data from service
      const analysisData: InventoryCostAnalysisData = await InventoryCostService.getInventoryCostAnalysis(filters)

      // Build response metadata
      const metadata: InventoryCostResponse['metadata'] = {
        totalItems: analysisData.inventoryCostData.length,
        totalInventoryValue: analysisData.summary.totalInventoryValue,
        generatedAt: new Date().toISOString()
      }

      // Add date range to metadata if filters were applied
      if (filters.startDate && filters.endDate) {
        metadata.dateRange = {
          startDate: filters.startDate,
          endDate: filters.endDate
        }
      }

      // Send successful response
      res.json({
        data: analysisData.inventoryCostData,
        success: true,
        metadata
      })
    } catch (error) {
      console.error('Error fetching inventory cost analysis data:', error)
      
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'
      
      // Send error response with empty data structure
      res.status(500).json({
        data: [],
        success: false,
        error: `Failed to fetch inventory cost analysis data: ${errorMessage}`,
        metadata: {
          totalItems: 0,
          totalInventoryValue: 0,
          generatedAt: new Date().toISOString()
        }
      })
    }
  }
}