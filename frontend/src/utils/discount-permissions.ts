import type { Patient } from '@/types/patient'

export interface DiscountPermissions {
  maxDiscountPercentage?: number
  maxDiscountAmount?: number
  allowDiscounts?: boolean
}

export interface DiscountCheckResult {
  allowed: boolean
  reason?: string
}

export interface UserWithPermissions extends Partial<Patient> {
  permissions?: {
    discounts?: DiscountPermissions
  }
}

/**
 * Check if a user has permission to apply a specific discount
 */
export function checkDiscountPermission(
  user: UserWithPermissions | null,
  discountPercent: number,
  discountAmount: number
): DiscountCheckResult {
  // No user selected
  if (!user) {
    return {
      allowed: false,
      reason: 'Please select a user account first'
    }
  }

  // Check if user has discount permissions defined
  const discountPermissions = user.permissions?.discounts
  
  // If no specific permissions, allow by default (can be changed based on business rules)
  if (!discountPermissions) {
    return { allowed: true }
  }

  // Check if discounts are explicitly disabled
  if (discountPermissions.allowDiscounts === false) {
    return {
      allowed: false,
      reason: 'User is not authorized to apply discounts'
    }
  }

  // Check percentage limit
  if (discountPermissions.maxDiscountPercentage !== undefined && 
      discountPercent > discountPermissions.maxDiscountPercentage) {
    return {
      allowed: false,
      reason: `Maximum allowed discount is ${discountPermissions.maxDiscountPercentage}%`
    }
  }

  // Check amount limit
  if (discountPermissions.maxDiscountAmount !== undefined && 
      discountAmount > discountPermissions.maxDiscountAmount) {
    return {
      allowed: false,
      reason: `Maximum allowed discount amount is $${discountPermissions.maxDiscountAmount.toFixed(2)}`
    }
  }

  // All checks passed
  return { allowed: true }
}

/**
 * Get default discount permissions based on user role or type
 */
export function getDefaultDiscountPermissions(userRole?: string): DiscountPermissions {
  switch (userRole) {
    case 'admin':
      return {
        allowDiscounts: true,
        maxDiscountPercentage: 100,
        maxDiscountAmount: undefined // No limit
      }
    case 'manager':
      return {
        allowDiscounts: true,
        maxDiscountPercentage: 50,
        maxDiscountAmount: 500
      }
    case 'staff':
      return {
        allowDiscounts: true,
        maxDiscountPercentage: 20,
        maxDiscountAmount: 100
      }
    default:
      return {
        allowDiscounts: false,
        maxDiscountPercentage: 0,
        maxDiscountAmount: 0
      }
  }
}