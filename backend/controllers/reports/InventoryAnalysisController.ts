import { Request, Response } from 'express';
import { InventoryAnalysisService, InventoryAnalysisData } from '../../services/InventoryAnalysisService.js';

interface InventoryAnalysisResponse {
  data: InventoryAnalysisData;
  success: boolean;
  error?: string;
  metadata?: {
    totalItems: number;
    generatedAt: string;
  };
}

export class InventoryAnalysisController {
  static async getInventoryReport(
    req: Request,
    res: Response<InventoryAnalysisResponse>
  ): Promise<void> {
    try {
      const analysisData = await InventoryAnalysisService.getInventoryAnalysis();

      res.json({
        data: analysisData,
        success: true,
        metadata: {
          totalItems: analysisData.inventoryData.length,
          generatedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error fetching inventory analysis data:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      
      res.status(500).json({
        data: {
          inventoryData: [],
          categoryData: [],
          stockStatus: []
        },
        success: false,
        error: `Failed to fetch inventory analysis data: ${errorMessage}`
      });
    }
  }
}