import { IProduct } from "../../models/Product.js";

export interface PoolStatus {
  looseStock: number;
  sealedStock: number;
  containerCapacity: number;
  sealedContainers: number;
  looseIsOpen: boolean;
}

export function getSealedStock(product: Pick<IProduct, "currentStock" | "looseStock">): number {
  return Math.max(0, (product.currentStock || 0) - ((product as any).looseStock || 0));
}

export function getLooseStock(product: Pick<IProduct, "looseStock">): number {
  return Math.max(0, (product as any).looseStock || 0);
}

export function getPoolStatus(product: IProduct): PoolStatus {
  const cap = Math.max(1, product.containerCapacity || 1);
  const loose = getLooseStock(product);
  const sealed = getSealedStock(product);
  return {
    looseStock: loose,
    sealedStock: sealed,
    containerCapacity: cap,
    sealedContainers: Math.floor(sealed / cap),
    looseIsOpen: loose > 0,
  };
}

export function canFulfillLooseSale(product: IProduct, amount: number): boolean {
  return amount <= getLooseStock(product);
}

export function canFulfillSealedSale(product: IProduct, bottleCount: number): boolean {
  const cap = Math.max(1, product.containerCapacity || 1);
  return bottleCount * cap <= getSealedStock(product);
}

/**
 * Validate a pool allocation request.
 * @param amount - Amount in base units (ml, g, pieces) to move into/out of the loose pool.
 *                 No container multiplication — the caller passes content directly.
 */
export function validatePoolAllocation(
  product: IProduct,
  amount: number,
  direction: "open" | "close"
): { valid: boolean; error?: string; delta: number } {
  const unit = (product as any).unitName || "units";

  if (amount <= 0 || !Number.isFinite(amount)) {
    return { valid: false, error: `Amount must be a positive number in ${unit}`, delta: 0 };
  }

  if (direction === "open") {
    const sealed = getSealedStock(product);
    if (amount > sealed) {
      return {
        valid: false,
        error: `Cannot move ${amount} ${unit} to loose — only ${sealed} ${unit} sealed and available`,
        delta: amount,
      };
    }
    return { valid: true, delta: amount };
  } else {
    const loose = getLooseStock(product);
    if (amount > loose) {
      return {
        valid: false,
        error: `Cannot seal back ${amount} ${unit} — only ${loose} ${unit} currently in the loose pool`,
        delta: -amount,
      };
    }
    return { valid: true, delta: -amount };
  }
}
