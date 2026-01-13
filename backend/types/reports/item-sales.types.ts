export interface ItemSalesData {
  item_name: string
  total_sales: number
  total_cost: number
  total_discount: number
  total_tax: number
  quantity_sold: number
  base_unit: string
  average_list_price: number
  average_cost_price: number
  last_sale_date: string
  margin: number
  has_cost_data?: boolean
  item_type?: string
}

export interface ItemSalesResponse {
  data: ItemSalesData[]
  success: boolean
  metadata?: {
    totalItems: number
    generatedAt: string
  }
  error?: string
}

export interface ItemSalesFilters {
  startDate?: string
  endDate?: string
  productId?: string
  categoryId?: string
  minSales?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

// MongoDB aggregation pipeline interfaces
export interface ItemSalesAggregation {
  _id: string
  item_name: string
  total_sales: number
  total_cost: number
  total_discount: number
  total_tax: number
  quantity_sold: number
  base_unit: string
  average_list_price: number
  average_cost_price: number
  last_sale_date: Date
  margin: number
}