export interface InventoryCostData {
  product_name: string
  cost_price: number
  total_stock: number
  total_cost: number
  category?: string
  unit?: string
  last_updated?: string
  stock_status?: 'optimal' | 'low' | 'overstock' | 'out'
}

export interface InventoryCostResponse {
  data: InventoryCostData[]
  success: boolean
  metadata?: {
    totalItems: number
    totalInventoryValue: number
    generatedAt: string
    dateRange?: {
      startDate: string
      endDate: string
    }
  }
  error?: string
}

export interface InventoryCostFilters {
  startDate?: string
  endDate?: string
  categoryId?: string
  minStock?: string
  maxStock?: string
  stockStatus?: 'optimal' | 'low' | 'overstock' | 'out'
  sortBy?: keyof InventoryCostData
  sortOrder?: 'asc' | 'desc'
}

// MongoDB aggregation pipeline interfaces
export interface InventoryCostAggregation {
  _id: string
  product_name: string
  cost_price: number
  total_stock: number
  total_cost: number
  category?: string
  unit?: string
  last_updated?: Date
  stock_status?: string
}

// Summary statistics interface
export interface InventoryCostSummary {
  totalProducts: number
  totalInventoryValue: number
  averageCostPerItem: number
  lowStockItems: number
  outOfStockItems: number
  categoryBreakdown: {
    category: string
    itemCount: number
    totalValue: number
    percentage: number
  }[]
}