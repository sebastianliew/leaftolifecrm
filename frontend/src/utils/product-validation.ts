import type { Product } from "@/types/inventory"

/**
 * Type guard to check if an item is a valid inventory product
 * and not a service item like consultation fees
 */
export function isValidInventoryProduct(item: unknown): item is Product {
  if (!item || typeof item !== 'object') return false
  
  const product = item as Partial<Product>
  
  // Check required product properties
  if (!product._id || typeof product._id !== 'string') return false
  if (!product.sku || typeof product.sku !== 'string') return false
  if (product.currentStock === undefined || typeof product.currentStock !== 'number') return false
  
  // Exclude consultation services
  if (product._id === 'consultation-fee') return false
  
  // Exclude items marked as services
  if ('isService' in product && product.isService === true) return false
  
  // Exclude items without proper product structure
  if (!product.name || !product.sellingPrice === undefined) return false
  
  return true
}

/**
 * Filter an array to only include valid inventory products
 */
export function filterValidProducts<T>(items: T[]): Product[] {
  return items.filter(isValidInventoryProduct) as Product[]
}