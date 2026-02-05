import mongoose, { Document } from 'mongoose'
import connectDB from '../lib/mongoose.js'
import { 
  InventoryCostData, 
  InventoryCostFilters, 
  InventoryCostSummary
} from '../types/reports/inventory-cost.types.js'

export interface InventoryCostAnalysisData {
  inventoryCostData: InventoryCostData[]
  summary: InventoryCostSummary
}

export class InventoryCostService {
  static async getInventoryCostAnalysis(filters: InventoryCostFilters = {}): Promise<InventoryCostAnalysisData> {
    const connection = await connectDB()
    if (!connection.connection.db) {
      throw new Error('Database connection not established')
    }
    const db = connection.connection.db

    // Get the main inventory cost data
    const inventoryCostData = await this.getInventoryCostData(db, filters)
    
    // Calculate summary statistics
    const summary = this.calculateSummaryStatistics(inventoryCostData)
    
    return {
      inventoryCostData,
      summary
    }
  }

  private static async getInventoryCostData(
    db: mongoose.mongo.Db, 
    filters: InventoryCostFilters
  ): Promise<InventoryCostData[]> {
    const pipeline: mongoose.PipelineStage[] = [
      {
        $match: {
          status: { $ne: 'discontinued' },
          ...this.buildMatchConditions(filters)
        }
      },
      {
        $project: {
          _id: { $toString: '$_id' },
          product_name: { $ifNull: ['$name', 'Unknown Product'] },
          cost_price: { $ifNull: ['$costPrice', 0] },
          total_stock: { 
            $ifNull: [
              '$currentStock', 
              { $ifNull: ['$quantity', 0] }
            ] 
          },
          category: { $ifNull: ['$categoryName', 'Uncategorized'] },
          unit: { $ifNull: ['$unitName', 'units'] },
          supplier: { $ifNull: ['$supplierName', ''] },
          brand: { $ifNull: ['$brandName', ''] },
          last_updated: { 
            $ifNull: [
              '$updatedAt',
              { $ifNull: ['$createdAt', new Date()] }
            ]
          },
          reorder_point: { $ifNull: ['$reorderPoint', 10] }
        }
      },
      {
        $addFields: {
          total_cost: {
            $multiply: ['$total_stock', '$cost_price']
          },
          stock_status: {
            $switch: {
              branches: [
                { 
                  case: { $lte: ['$total_stock', 0] }, 
                  then: 'out' 
                },
                { 
                  case: { $lte: ['$total_stock', '$reorder_point'] }, 
                  then: 'low' 
                },
                { 
                  case: { 
                    $gte: [
                      '$total_stock', 
                      { $multiply: ['$reorder_point', 5] }
                    ] 
                  }, 
                  then: 'overstock' 
                }
              ],
              default: 'optimal'
            }
          }
        }
      },
      {
        $project: {
          product_name: 1,
          cost_price: 1,
          total_stock: 1,
          total_cost: 1,
          category: 1,
          unit: 1,
          supplier: 1,
          brand: 1,
          last_updated: 1,
          stock_status: 1
        }
      }
    ]

    // Apply additional filters
    if (filters.stockStatus) {
      pipeline.push({
        $match: {
          stock_status: filters.stockStatus
        }
      })
    }

    // Apply sorting
    const sortField = filters.sortBy || 'total_cost'
    const sortOrder = filters.sortOrder === 'asc' ? 1 : -1
    
    pipeline.push({
      $sort: {
        [sortField]: sortOrder
      }
    })

    const results = await db.collection('products').aggregate(pipeline).toArray()
    
    return results.map(item => ({
      product_name: item.product_name,
      cost_price: item.cost_price,
      total_stock: item.total_stock,
      total_cost: item.total_cost,
      category: item.category,
      unit: item.unit,
      supplier: item.supplier,
      brand: item.brand,
      last_updated: item.last_updated?.toISOString(),
      stock_status: item.stock_status as InventoryCostData['stock_status']
    }))
  }

  private static buildMatchConditions(filters: InventoryCostFilters): mongoose.FilterQuery<Document> {
    const matchConditions: mongoose.FilterQuery<Document> = {}

    // Category filter
    if (filters.categoryId) {
      matchConditions.categoryId = filters.categoryId
    }

    // Stock range filters
    const exprConditions: Record<string, [mongoose.Expression, number]> = {}
    
    if (filters.minStock && !isNaN(Number(filters.minStock))) {
      exprConditions.$gte = [
        { $ifNull: ['$currentStock', '$quantity', 0] },
        Number(filters.minStock)
      ]
    }

    if (filters.maxStock && !isNaN(Number(filters.maxStock))) {
      exprConditions.$lte = [
        { $ifNull: ['$currentStock', '$quantity', 0] },
        Number(filters.maxStock)
      ]
    }
    
    if (Object.keys(exprConditions).length > 0) {
      matchConditions.$expr = {
        $and: Object.entries(exprConditions).map(([op, value]) => ({
          [op]: value
        }))
      }
    }

    // Date range filter (for last updated)
    if (filters.startDate || filters.endDate) {
      const dateConditions: Record<string, Date> = {}
      
      if (filters.startDate) {
        dateConditions.$gte = new Date(filters.startDate)
      }
      
      if (filters.endDate) {
        dateConditions.$lte = new Date(filters.endDate)
      }
      
      if (Object.keys(dateConditions).length > 0) {
        matchConditions.$or = [
          { updatedAt: dateConditions },
          { createdAt: dateConditions }
        ]
      }
    }

    return matchConditions
  }

  private static calculateSummaryStatistics(data: InventoryCostData[]): InventoryCostSummary {
    const totalProducts = data.length
    const totalInventoryValue = data.reduce((sum, item) => sum + item.total_cost, 0)
    const averageCostPerItem = totalProducts > 0 ? totalInventoryValue / totalProducts : 0
    
    // Count stock status items
    const lowStockItems = data.filter(item => item.stock_status === 'low').length
    const outOfStockItems = data.filter(item => item.stock_status === 'out').length
    
    // Calculate category breakdown
    const categoryMap = new Map<string, { itemCount: number; totalValue: number }>()
    
    data.forEach(item => {
      const category = item.category || 'Uncategorized'
      const existing = categoryMap.get(category) || { itemCount: 0, totalValue: 0 }
      
      categoryMap.set(category, {
        itemCount: existing.itemCount + 1,
        totalValue: existing.totalValue + item.total_cost
      })
    })
    
    const categoryBreakdown = Array.from(categoryMap.entries()).map(([category, stats]) => ({
      category,
      itemCount: stats.itemCount,
      totalValue: stats.totalValue,
      percentage: totalInventoryValue > 0 ? (stats.totalValue / totalInventoryValue) * 100 : 0
    })).sort((a, b) => b.totalValue - a.totalValue)

    return {
      totalProducts,
      totalInventoryValue,
      averageCostPerItem,
      lowStockItems,
      outOfStockItems,
      categoryBreakdown
    }
  }
}