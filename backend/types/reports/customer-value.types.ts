export interface CustomerValueData {
  rank: number
  customerName: string
  customerEmail?: string
  customerPhone?: string
  customerAddress?: {
    street?: string
    city?: string
    state?: string
    postalCode?: string
  }
  metrics: {
    totalRevenue: number
    totalOrders: number
    averageOrderValue: number
    totalCost: number
    totalMargin: number
    marginPercentage: number
  }
  timeline: {
    firstPurchase: Date | string
    lastPurchase: Date | string
    daysSinceLastOrder: number
    purchaseFrequency: number // days between orders
  }
  membership?: {
    tier: 'standard' | 'silver' | 'gold' | 'platinum' | 'vip' | null
    discountRate: number
  }
  insights: {
    topProducts: Array<{
      name: string
      quantity: number
      revenue: number
    }>
    preferredPaymentMethod: string
    customBlendsCount: number
    bundlesCount: number
  }
}

export interface CustomerValueResponse {
  data: CustomerValueData[]
  success: boolean
  metadata?: {
    totalCustomers: number
    totalUniqueCustomers?: number
    dateRange: {
      start: Date | string
      end: Date | string
    }
    generatedAt: string
    aggregateTotals: {
      totalRevenue: number
      totalMargin: number
      averageMarginPercentage: number
    }
  }
  error?: string
}

export interface CustomerValueFilters {
  startDate?: string
  endDate?: string
  minRevenue?: string
  limit?: string
  sortBy?: 'revenue' | 'orders' | 'margin' | 'recent' | 'frequency'
  sortOrder?: 'asc' | 'desc'
  includeInactive?: string
  searchQuery?: string
}

// MongoDB aggregation pipeline interfaces
export interface CustomerValueAggregation {
  _id: string // customerName
  customerName: string
  customerEmail: string
  customerPhone: string
  customerAddress: {
    street?: string
    city?: string
    state?: string
    postalCode?: string
  }
  totalRevenue: number
  totalOrders: number
  totalCost: number
  totalDiscount: number
  firstPurchase: Date
  lastPurchase: Date
  transactionIds: string[]
  items: Array<{
    name: string
    quantity: number
    revenue: number
    totalPrice?: number // For backwards compatibility
    productId: string
  }>
  paymentMethods: Array<{
    method: string
    count: number
  }>
  customBlendsCount: number
  bundlesCount: number
  daysSinceLastOrder?: number
}

export interface ProductCostLookup {
  _id: string
  costPrice: number
}