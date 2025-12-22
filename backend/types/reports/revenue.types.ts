export interface MonthlyRevenue {
  month: string
  revenue: number
  cost: number
  profit: number
  growth: number
  transactions: number
  avgTransactionValue: number
}

export interface CategoryRevenue {
  category: string
  revenue: number
  cost: number
  profit: number
  margin: number
  transactions: number
  quantity: number
}

export interface PaymentMethodRevenue {
  method: string
  amount: number
  transactions: number
  percentage: number
}

export interface RevenueAnalysisResponse {
  monthlyData: MonthlyRevenue[]
  categoryData: CategoryRevenue[]
  paymentData: PaymentMethodRevenue[]
}

export interface MonthlyRevenueAggregation {
  _id: {
    year: number
    month: number
  }
  revenue: number
  transactions: number
  avgTransactionValue: number
}

export interface CategoryRevenueAggregation {
  _id: string
  revenue: number
  transactions: number
  quantity: number
}

export interface PaymentMethodAggregation {
  _id: string
  amount: number
  transactions: number
}