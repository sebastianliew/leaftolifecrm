/**
 * Frontend DiscountService - Placeholder for decoupled architecture
 * This is a minimal frontend version to prevent build errors
 * Real discount calculations should be handled by the backend
 */

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

// interface DiscountRequest {
//   price: number
//   quantity?: number
//   customerId?: string
//   membershipLevel?: string
// }

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

export class DiscountService {
  /**
   * Calculate item discount
   * Signature: (product, quantity, unitPrice, customer, options) => DiscountResult
   */
  static calculateItemDiscount(
    product: Product,
    quantity: number,
    unitPrice: number,
    customer: Customer,
    options?: DiscountOptions
  ): DiscountResult {
    // Check if discount is eligible based on product flags and item type
    // NOTE: If discountFlags is undefined (old products), default to true (schema default)
    const discountableForMembers = product.discountFlags?.discountableForMembers !== false;

    const isEligible =
      customer.discountRate > 0 &&
      discountableForMembers &&
      (options?.itemType === 'product' || options?.itemType === 'fixed_blend')

    console.log('[DiscountService] Calculating discount:', {
      customerDiscountRate: customer.discountRate,
      discountableForMembers: product.discountFlags?.discountableForMembers,
      treatAsDiscountable: discountableForMembers,
      itemType: options?.itemType,
      isEligible
    });

    if (!isEligible) {
      console.log('[DiscountService] Not eligible:', {
        reason: customer.discountRate <= 0 ? 'Customer has no discount rate' :
                !discountableForMembers ? 'Product explicitly marked as not discountable for members' :
                'Item type not product or fixed_blend'
      });
      return {
        eligible: false
      }
    }

    const subtotal = unitPrice * quantity
    const discountAmount = subtotal * (customer.discountRate / 100)
    const finalPrice = subtotal - discountAmount

    console.log('[DiscountService] ✓ Discount calculated:', {
      subtotal,
      discountAmount,
      finalPrice,
      discountPercentage: customer.discountRate
    });

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
   * Calculate additional discount (placeholder implementation)
   */
  static calculateAdditionalDiscount(amount: number, _discountType?: string): DiscountCalculation {
    // Placeholder - no additional discount
    // TODO: Call backend API for real discount calculation
    return {
      discountAmount: Math.max(0, amount),
      finalPrice: 0, // Will be calculated by caller
      discountPercentage: 0
    }
  }

  /**
   * Convert additional discount (placeholder implementation)
   */
  static convertAdditionalDiscount(discount: unknown): unknown {
    // Placeholder - return as-is
    // TODO: Implement proper conversion logic
    return discount
  }
}