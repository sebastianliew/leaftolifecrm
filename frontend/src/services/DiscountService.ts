/**
 * DiscountService — Frontend wrapper for server-side discount calculations.
 *
 * All real discount calculations are performed by the backend via POST /transactions/calculate.
 * Local methods are kept only as fast optimistic previews — the server response is authoritative.
 */

import { fetchAPI } from "@/lib/query-client"

interface DiscountCalculation {
  discountAmount: number
  finalPrice: number
  discountPercentage?: number
  membershipDiscount?: number
}

interface DiscountResult {
  eligible: boolean
  discountCalculation?: DiscountCalculation
}

interface Product {
  _id: string
  discountFlags?: {
    discountableForMembers?: boolean
    discountableForAll?: boolean
    discountableInBlends?: boolean
  }
}

interface Customer {
  _id: string
  discountRate: number
}

interface DiscountOptions {
  itemType?: string
}

interface TransactionItem {
  productId?: string
  name?: string
  quantity: number
  unitPrice: number
  totalPrice?: number
  discountAmount?: number
  itemType?: string
  isService?: boolean
  saleType?: string
  customBlendData?: unknown
  [key: string]: unknown
}

interface CalculateResponse {
  success: boolean
  items: Array<{
    productId?: string
    unitPrice: number
    totalPrice: number
    discountAmount: number
    convertedQuantity?: number
    containerCapacityAtSale?: number
    displaySku?: string
    [key: string]: unknown
  }>
  subtotal: number
  totalItemDiscounts: number
  totalAmount: number
  warnings: string[]
  memberDiscount?: {
    percentage: number
    tier?: string
  }
}

export class DiscountService {
  /**
   * Call the backend to calculate the full transaction (prices, discounts, totals).
   * This is the authoritative source of truth.
   */
  static async calculateTransactionServer(
    items: TransactionItem[],
    customerId?: string | null,
    discountAmount?: number
  ): Promise<CalculateResponse> {
    return fetchAPI<CalculateResponse>('/transactions/calculate', {
      method: 'POST',
      body: JSON.stringify({ items, customerId, discountAmount }),
    })
  }

  /**
   * Local optimistic preview for instant UI feedback.
   * The backend is authoritative — this is only for responsiveness.
   */
  static calculateItemDiscountLocal(
    product: Product,
    quantity: number,
    unitPrice: number,
    customer: Customer,
    options?: DiscountOptions
  ): DiscountResult {
    const discountableForAll = product.discountFlags?.discountableForAll !== false
    const discountableForMembers = product.discountFlags?.discountableForMembers !== false
    const isEligible =
      customer.discountRate > 0 &&
      discountableForAll &&
      discountableForMembers &&
      (options?.itemType === 'product' || options?.itemType === 'fixed_blend')

    if (!isEligible) {
      return { eligible: false }
    }

    const subtotal = unitPrice * quantity
    const discountAmount = subtotal * (customer.discountRate / 100)
    const finalPrice = subtotal - discountAmount

    return {
      eligible: true,
      discountCalculation: {
        discountAmount,
        finalPrice,
        discountPercentage: customer.discountRate,
        membershipDiscount: discountAmount
      }
    }
  }

  /**
   * @deprecated Use calculateTransactionServer() instead. Kept for backward compat.
   */
  static calculateItemDiscount(
    product: Product,
    quantity: number,
    unitPrice: number,
    customer: Customer,
    options?: DiscountOptions
  ): DiscountResult {
    return this.calculateItemDiscountLocal(product, quantity, unitPrice, customer, options)
  }

  /**
   * Calculate additional (bill-level) discount — simple math, no server call needed.
   */
  static calculateAdditionalDiscount(amount: number, _discountType?: string): DiscountCalculation {
    return {
      discountAmount: Math.max(0, amount),
      finalPrice: 0,
      discountPercentage: 0
    }
  }
}
