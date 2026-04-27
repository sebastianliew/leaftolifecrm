import mongoose from 'mongoose'
import connectDB from '../lib/mongoose.js'

export interface InventoryItem {
  id: string
  name: string
  category: string
  brand?: string
  supplier?: string
  current_stock: number
  unit: string
  unit_cost: number
  total_value: number
  turnover_rate: number
  days_supply: number
  status: 'optimal' | 'out' | 'owed'
  full_containers?: number
  loose_remainder?: number
  container_display?: string
  loose_stock?: number
  sealed_stock?: number
}

export interface CategorySummary {
  category: string
  items: number
  value: number
  percentage: number
}

export interface StockStatus {
  status: string
  count: number
  value: number
}

export interface InventoryAnalysisData {
  inventoryData: InventoryItem[]
  categoryData: CategorySummary[]
  stockStatus: StockStatus[]
  summary?: {
    totalItems: number
    totalValue: number
    outOfStockItems: number
    avgTurnover: number
  }
}

export class InventoryAnalysisService {
  static async getInventoryAnalysis(): Promise<InventoryAnalysisData> {
    const connection = await connectDB()
    if (!connection.connection.db) {
      throw new Error('Database connection not established')
    }
    const db = connection.connection.db

    // Get all products with their current stock levels
    const inventoryData = await this.getInventoryData(db)
    
    // Get turnover data
    const turnoverData = await this.getTurnoverData(db)
    const turnoverMap = new Map(turnoverData.map(item => [item._id, item.totalSold]))
    
    // Enhance inventory data with turnover rates and days supply
    const enhancedInventoryData = this.enhanceInventoryData(inventoryData, turnoverMap)
    
    // Get category summary
    const categoryData = await this.getCategoryData(db)
    
    // Calculate percentages for categories
    const totalValue = categoryData.reduce((sum, cat) => sum + cat.value, 0)
    const categoryDataWithPercentage = categoryData.map(cat => ({
      ...cat,
      percentage: totalValue > 0 ? (cat.value / totalValue) * 100 : 0
    }))
    
    // Get stock status summary
    const stockStatusData = this.getStockStatusSummary(enhancedInventoryData)
    
    // Pre-compute summary metrics so frontend doesn't need to reduce()
    const totalItems = enhancedInventoryData.length
    const summaryTotalValue = enhancedInventoryData.reduce((sum, item) => {
      const val = (item as { total_value?: number }).total_value
      return sum + (typeof val === 'number' && !isNaN(val) ? val : 0)
    }, 0)
    const outOfStockItems = enhancedInventoryData.filter((item) => {
      const status = (item as { status?: string }).status
      return status === 'out'
    }).length
    const avgTurnover = totalItems > 0
      ? enhancedInventoryData.reduce((sum, item) => sum + ((item as { turnover_rate?: number }).turnover_rate ?? 0), 0) / totalItems
      : 0

    return {
      inventoryData: enhancedInventoryData,
      categoryData: categoryDataWithPercentage,
      stockStatus: stockStatusData,
      summary: {
        totalItems,
        totalValue: summaryTotalValue,
        outOfStockItems,
        avgTurnover,
      }
    }
  }

  private static async getInventoryData(db: mongoose.mongo.Db): Promise<Array<{
    id: string;
    name: string;
    category: string;
    brand: string;
    supplier: string;
    current_stock: number;
    unit_cost: number;
    total_value: number;
    status: string;
    container_capacity: number;
    loose_stock: number;
    unit: string;
  }>> {
    const pipeline = [
      {
        $match: {
          status: { $ne: 'discontinued' }
        }
      },
      {
        $project: {
          id: { $toString: '$_id' },
          name: 1,
          category: { $ifNull: ['$categoryName', 'Uncategorized'] },
          brand: { $ifNull: ['$brandName', ''] },
          supplier: { $ifNull: ['$supplierName', ''] },
          current_stock: { $ifNull: ['$currentStock', 0] },
          unit: { $ifNull: ['$unitName', 'units'] },
          unit_cost: { $ifNull: ['$costPrice', 0] },
          container_capacity: { $ifNull: ['$containerCapacity', 1] },
          loose_stock: { $ifNull: ['$looseStock', 0] },
          // Clamp valuation to non-negative: oversold stock represents owed
          // inventory, not a negative balance-sheet asset.
          total_value: {
            $multiply: [
              { $max: [0, { $ifNull: ['$currentStock', 0] }] },
              { $ifNull: ['$costPrice', 0] }
            ]
          },
          status: {
            $switch: {
              branches: [
                { case: { $lt: [{ $ifNull: ['$currentStock', 0] }, 0] }, then: 'owed' },
                { case: { $eq: [{ $ifNull: ['$currentStock', 0] }, 0] }, then: 'out' }
              ],
              default: 'optimal'
            }
          }
        }
      }
    ]

    return await db.collection('products').aggregate(pipeline).toArray() as Array<{
      id: string;
      name: string;
      category: string;
      brand: string;
      supplier: string;
      current_stock: number;
      unit_cost: number;
      total_value: number;
      status: string;
      container_capacity: number;
      loose_stock: number;
      unit: string;
    }>
  }

  private static async getTurnoverData(db: mongoose.mongo.Db): Promise<Array<{
    _id: string;
    totalSold: number;
  }>> {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const pipeline = [
      {
        $match: {
          type: 'COMPLETED',
          status: 'completed',
          transactionDate: { $gte: thirtyDaysAgo }
        }
      },
      {
        $unwind: '$items'
      },
      {
        $group: {
          _id: '$items.productId',
          totalSold: { $sum: '$items.quantity' }
        }
      }
    ]

    return await db.collection('transactions').aggregate(pipeline).toArray() as Array<{
      _id: string;
      totalSold: number;
    }>
  }

  private static enhanceInventoryData(
    inventoryData: Array<{
      id: string;
      name: string;
      category: string;
      brand: string;
      supplier: string;
      current_stock: number;
      unit_cost: number;
      total_value: number;
      status: string;
      container_capacity: number;
      loose_stock: number;
      unit: string;
    }>,
    turnoverMap: Map<string, number>
  ): InventoryItem[] {
    return inventoryData.map((item) => {
      const monthlySales = turnoverMap.get(item.id.toString()) || 0
      const dailySales = monthlySales / 30
      const turnoverRate = item.current_stock > 0 ? (monthlySales / item.current_stock) : 0
      const daysSupply = dailySales > 0 && item.current_stock > 0
        ? Math.floor(item.current_stock / dailySales)
        : 999

      const status: InventoryItem['status'] =
        item.current_stock < 0 ? 'owed'
        : item.current_stock === 0 ? 'out'
        : 'optimal'

      // Calculate container-related fields using actual looseStock
      const containerCapacity = item.container_capacity || 1
      const looseStock = item.loose_stock || 0
      const sealedStock = Math.max(0, item.current_stock - looseStock)
      const sealedContainers = Math.floor(sealedStock / containerCapacity)
      const looseRemainder = Math.max(0, item.current_stock) % containerCapacity

      // Only show container display when containerCapacity > 1
      let containerDisplay: string | undefined
      if (containerCapacity > 1) {
        if (looseStock > 0) {
          containerDisplay = `${sealedContainers} sealed + ${looseStock} loose`
        } else {
          containerDisplay = `${sealedContainers} sealed`
        }
      }

      return {
        ...item,
        unit: 'unit', // Default unit
        // unit_cost and total_value come from the aggregation pipeline; the
        // pipeline already clamps total_value via $max(0, currentStock).
        turnover_rate: turnoverRate,
        days_supply: daysSupply,
        status,
        full_containers: sealedContainers,
        loose_remainder: looseRemainder,
        container_display: containerDisplay,
        loose_stock: looseStock,
        sealed_stock: sealedStock,
      }
    })
  }

  private static async getCategoryData(db: mongoose.mongo.Db): Promise<CategorySummary[]> {
    const pipeline = [
      {
        $match: {
          status: { $ne: 'discontinued' }
        }
      },
      {
        $group: {
          _id: { $ifNull: ['$categoryName', 'Uncategorized'] },
          items: { $sum: 1 },
          value: {
            $sum: {
              $multiply: [
                { $max: [0, { $ifNull: ['$currentStock', 0] }] },
                { $ifNull: ['$costPrice', 0] }
              ]
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          category: '$_id',
          items: 1,
          value: 1
        }
      },
      {
        $sort: { value: -1 }
      }
    ]

    const results = await db.collection('products').aggregate(pipeline).toArray()
    interface CategoryResult {
      category: string;
      items: number;
      value: number;
    }
    
    const typedResults = results as CategoryResult[];
    const totalValue = typedResults.reduce((sum: number, item) => sum + (item.value || 0), 0)
    
    return typedResults.map((item) => ({
      category: item.category || 'Uncategorized',
      items: item.items || 0,
      value: item.value || 0,
      percentage: totalValue > 0 ? ((item.value || 0) / totalValue) * 100 : 0
    })) as CategorySummary[]
  }

  private static getStockStatusSummary(inventoryData: InventoryItem[]): StockStatus[] {
    const owedItems = inventoryData.filter(item => item.status === 'owed')
    return [
      {
        status: 'Optimal Stock',
        count: inventoryData.filter(item => item.status === 'optimal').length,
        value: inventoryData.filter(item => item.status === 'optimal').reduce((sum, item) => sum + item.total_value, 0)
      },
      {
        status: 'Out of Stock',
        count: inventoryData.filter(item => item.status === 'out').length,
        value: 0
      },
      {
        status: 'Stock Owed',
        count: owedItems.length,
        // Sum of |current_stock| × cost_price — represents inventory the
        // business has sold but not yet received. Useful for reconciliation.
        value: owedItems.reduce(
          (sum, item) => sum + Math.abs(item.current_stock) * (item.unit_cost || 0),
          0,
        )
      }
    ]
  }
}