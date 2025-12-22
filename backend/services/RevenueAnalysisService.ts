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

    // Monthly revenue trend
    const monthlyRevenuePipeline = [
      {
        $match: {
          type: 'COMPLETED',
          status: 'completed',
          transactionDate: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$transactionDate' },
            month: { $month: '$transactionDate' }
          },
          revenue: { $sum: '$totalAmount' },
          transactions: { $sum: 1 },
          avgTransactionValue: { $avg: '$totalAmount' }
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
    
    // Transform and calculate cost/profit
    const monthlyData: MonthlyRevenue[] = monthlyDataRaw.map((month, index) => {
      const monthDate = new Date(month._id.year, month._id.month - 1)
      const monthStr = monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      
      return {
        month: monthStr,
        revenue: month.revenue,
        cost: month.revenue * 0.65,
        profit: month.revenue * 0.35,
        growth: index === 0 ? 0 : ((month.revenue - monthlyDataRaw[index - 1].revenue) / monthlyDataRaw[index - 1].revenue) * 100,
        transactions: month.transactions,
        avgTransactionValue: month.avgTransactionValue
      }
    })

    // Revenue by category
    const categoryRevenuePipeline = [
      {
        $match: {
          type: 'COMPLETED',
          status: 'completed',
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

    const categoryData: CategoryRevenue[] = categoryDataRaw.map(cat => ({
      category: cat._id,
      revenue: cat.revenue,
      cost: cat.revenue * 0.65,
      profit: cat.revenue * 0.35,
      margin: 0.35,
      transactions: cat.transactions,
      quantity: cat.quantity
    }))

    // Revenue by payment method
    const paymentMethodPipeline = [
      {
        $match: {
          type: 'COMPLETED',
          status: 'completed',
          transactionDate: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$paymentMethod',
          amount: { $sum: '$totalAmount' },
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

    return {
      monthlyData,
      categoryData,
      paymentData
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