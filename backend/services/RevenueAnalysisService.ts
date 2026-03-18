import mongoose from 'mongoose'
import {
  RevenueAnalysisResponse,
  MonthlyRevenue,
  MonthlyRevenueAggregation,
  CategoryRevenueAggregation,
  PaymentMethodAggregation,
  CategoryRevenue,
  PaymentMethodRevenue
} from '../types/reports/revenue.types'

export class RevenueAnalysisService {
  static async getRevenueAnalysis(period: string = '6months'): Promise<RevenueAnalysisResponse> {
    const db = mongoose.connection.db
    if (!db) {
      throw new Error('Database connection not established')
    }

    const months = period === '6months' ? 6 : 12
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - months)
    startDate.setDate(1) // Start from beginning of month

    // Monthly revenue trend with actual cost calculation
    const monthlyRevenuePipeline = [
      {
        $match: {
          type: 'COMPLETED',
          status: { $in: ['completed', 'refunded', 'partially_refunded'] },
          transactionDate: { $gte: startDate }
        }
      },
      {
        $unwind: '$items'
      },
      {
        $group: {
          _id: {
            year: { $year: '$transactionDate' },
            month: { $month: '$transactionDate' }
          },
          revenue: { $sum: '$items.totalPrice' },
          cost: { 
            $sum: { 
              $multiply: [
                { $ifNull: ['$items.costPrice', 0] }, 
                '$items.quantity'
              ] 
            } 
          },
          transactions: { $addToSet: '$_id' }
        }
      },
      {
        $project: {
          _id: 1,
          revenue: 1,
          cost: 1,
          transactions: { $size: '$transactions' }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]

    const monthlyDataRaw = await db
      .collection('transactions')
      .aggregate<MonthlyRevenueAggregation>(monthlyRevenuePipeline)
      .toArray()
    
    // Transform and calculate profit from actual cost
    const monthlyData: MonthlyRevenue[] = monthlyDataRaw.map((month, index) => {
      const monthDate = new Date(month._id.year, month._id.month - 1)
      const monthStr = monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      const actualCost = month.cost || 0
      const profit = month.revenue - actualCost
      
      return {
        month: monthStr,
        revenue: month.revenue,
        cost: actualCost,
        profit: profit,
        growth: index === 0 ? 0 : ((month.revenue - monthlyDataRaw[index - 1].revenue) / monthlyDataRaw[index - 1].revenue) * 100,
        transactions: month.transactions,
        avgTransactionValue: month.transactions > 0 ? month.revenue / month.transactions : 0
      }
    })

    // Revenue by category with actual cost calculation
    const categoryRevenuePipeline = [
      {
        $match: {
          type: 'COMPLETED',
          status: { $in: ['completed', 'refunded', 'partially_refunded'] },
          transactionDate: { $gte: startDate }
        }
      },
      {
        $unwind: '$items'
      },
      {
        $group: {
          _id: {
            $switch: {
              branches: [
                { case: { $eq: ['$items.isService', true] }, then: 'Services' },
                { case: { $regexMatch: { input: '$items.name', regex: /consultation/i } }, then: 'Consultations' },
                { case: { $regexMatch: { input: '$items.name', regex: /delivery/i } }, then: 'Delivery' },
                { case: { $or: [
                  { $regexMatch: { input: '$items.name', regex: /vitamin/i } },
                  { $regexMatch: { input: '$items.name', regex: /supplement/i } }
                ]}, then: 'Supplements' }
              ],
              default: 'Products'
            }
          },
          revenue: { $sum: '$items.totalPrice' },
          cost: { 
            $sum: { 
              $multiply: [
                { $ifNull: ['$items.costPrice', 0] }, 
                '$items.quantity'
              ] 
            } 
          },
          transactions: { $sum: 1 },
          quantity: { $sum: '$items.quantity' }
        }
      },
      {
        $sort: { revenue: -1 }
      }
    ]

    const categoryDataRaw = await db
      .collection('transactions')
      .aggregate<CategoryRevenueAggregation>(categoryRevenuePipeline)
      .toArray()

    const categoryData: CategoryRevenue[] = categoryDataRaw.map(cat => {
      const actualCost = cat.cost || 0
      const profit = cat.revenue - actualCost
      const margin = cat.revenue > 0 ? profit / cat.revenue : 0
      
      return {
        category: cat._id,
        revenue: cat.revenue,
        cost: actualCost,
        profit: profit,
        margin: margin,
        transactions: cat.transactions,
        quantity: cat.quantity
      }
    })

    // Revenue by payment method
    const paymentMethodPipeline = [
      {
        $match: {
          type: 'COMPLETED',
          status: { $in: ['completed', 'refunded', 'partially_refunded'] },
          transactionDate: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$paymentMethod',
          amount: { $sum: { $subtract: ['$totalAmount', { $ifNull: ['$totalRefunded', 0] }] } },
          transactions: { $sum: 1 }
        }
      },
      {
        $sort: { amount: -1 }
      }
    ]

    const paymentDataRaw = await db
      .collection('transactions')
      .aggregate<PaymentMethodAggregation>(paymentMethodPipeline)
      .toArray()
    
    const totalPaymentRevenue = paymentDataRaw.reduce((sum, payment) => sum + payment.amount, 0)
    
    const paymentData: PaymentMethodRevenue[] = paymentDataRaw.map(payment => ({
      method: this.formatPaymentMethod(payment._id),
      amount: payment.amount,
      transactions: payment.transactions,
      percentage: totalPaymentRevenue > 0 ? (payment.amount / totalPaymentRevenue) * 100 : 0
    }))

    // Pre-compute summary metrics so frontend doesn't need to reduce()
    const summaryTotalRevenue = categoryData.reduce((sum, item) => sum + item.revenue, 0)
    const summaryTotalProfit = categoryData.reduce((sum, item) => sum + item.profit, 0)
    const avgMonthlyRevenue = monthlyData.length > 0
      ? monthlyData.reduce((sum, item) => sum + item.revenue, 0) / monthlyData.length
      : 0
    const overallMargin = summaryTotalRevenue > 0 ? (summaryTotalProfit / summaryTotalRevenue) * 100 : 0

    return {
      monthlyData,
      categoryData,
      paymentData,
      summary: {
        totalRevenue: summaryTotalRevenue,
        totalProfit: summaryTotalProfit,
        avgMonthlyRevenue,
        overallMargin,
      }
    }
  }

  private static formatPaymentMethod(method: string): string {
    const methodMap: Record<string, string> = {
      'cash': 'Cash',
      'card': 'Credit Card',
      'bank_transfer': 'Bank Transfer',
      'check': 'Check',
      'digital_wallet': 'Mobile Payment',
      'credit': 'Store Credit'
    }
    return methodMap[method] || 'Other'
  }
}