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

export function validatePoolAllocation(
  product: IProduct,
  bottleCount: number,
  direction: "open" | "close"
): { valid: boolean; error?: string; delta: number } {
  if (bottleCount <= 0 || !Number.isFinite(bottleCount)) {
    return { valid: false, error: "Bottle count must be a positive number", delta: 0 };
  }
  const cap = Math.max(1, product.containerCapacity || 1);
  const delta = bottleCount * cap;

  if (direction === "open") {
    const sealed = getSealedStock(product);
    if (delta > sealed) {
      return {
        valid: false,
        error: `Cannot open ${bottleCount} bottle(s) — only ${Math.floor(sealed / cap)} sealed bottle(s) available (${sealed} ${(product as any).unitName || "units"})`,
        delta,
      };
    }
    return { valid: true, delta };
  } else {
    const loose = getLooseStock(product);
    if (delta > loose) {
      return {
        valid: false,
        error: `Cannot seal ${bottleCount} bottle(s) — only ${loose} ${(product as any).unitName || "units"} in loose pool`,
        delta: -delta,
      };
    }
    return { valid: true, delta: -delta };
  }
}
