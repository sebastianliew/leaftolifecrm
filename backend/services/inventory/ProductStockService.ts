/**
 * Product stock query helpers — pure functions, no side effects.
 * Extracted from Product model methods for testability.
 */

export interface StockInfo {
  currentStock: number;
  reservedStock: number;
  lastRestockDate?: Date;
  averageRestockQuantity: number;
  restockCount: number;
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
