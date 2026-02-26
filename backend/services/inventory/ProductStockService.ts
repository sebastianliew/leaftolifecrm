/**
 * Product stock query helpers — pure functions, no side effects.
 * Extracted from Product model methods for testability.
 */

export interface StockInfo {
  currentStock: number;
  reservedStock: number;
  reorderPoint: number;
  autoReorderEnabled: boolean;
  lastRestockDate?: Date;
  restockFrequency: number;
  averageRestockQuantity: number;
  restockCount: number;
}

/** Check if product needs restocking */
export function needsRestock(product: StockInfo, threshold = 1.0): boolean {
  return product.currentStock <= product.reorderPoint * threshold;
}

/** Check if product needs urgent restocking (oversold or critically low) */
export function needsUrgentRestock(product: StockInfo): boolean {
  return product.currentStock <= 0 || product.currentStock <= product.reorderPoint * 0.5;
}

/** Get suggested restock quantity */
export function getSuggestedRestockQuantity(product: StockInfo): number {
  if (product.averageRestockQuantity > 0) {
    return Math.max(product.averageRestockQuantity, product.reorderPoint - product.currentStock);
  }
  return Math.max(product.reorderPoint, product.reorderPoint - product.currentStock);
}

/** Check if auto-reorder is due */
export function isAutoReorderDue(product: StockInfo): boolean {
  if (!product.autoReorderEnabled || !product.lastRestockDate) return false;
  const daysSinceLastRestock = Math.floor(
    (Date.now() - product.lastRestockDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  return daysSinceLastRestock >= product.restockFrequency;
}

/** Get backorder quantity (negative stock amount) */
export function getBackorderQuantity(product: Pick<StockInfo, 'currentStock'>): number {
  return Math.abs(Math.min(0, product.currentStock));
}

/** Check if product is oversold */
export function isOversold(product: Pick<StockInfo, 'currentStock'>): boolean {
  return product.currentStock < 0;
}

/** Get safe available stock (never negative for UI display) */
export function getAvailableStock(product: Pick<StockInfo, 'currentStock' | 'reservedStock'>): number {
  return Math.max(0, product.currentStock - (product.reservedStock || 0));
}

/** Calculate restock analytics after a restock operation */
export function calculateRestockAnalytics(product: StockInfo, quantity: number) {
  const newCount = (product.restockCount || 0) + 1;
  const newAvg = newCount === 1
    ? quantity
    : ((product.averageRestockQuantity * (newCount - 1)) + quantity) / newCount;

  return {
    lastRestockDate: new Date(),
    restockCount: newCount,
    averageRestockQuantity: newAvg,
  };
}
