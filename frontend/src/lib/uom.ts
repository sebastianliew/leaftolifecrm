/**
 * Centralized UOM behavior config for loose quantity input.
 * Keep in sync with: backend/utils/uomUtils.ts
 */

export type UomType = 'volume' | 'weight' | 'count' | 'length'

export interface UomQuantityBehavior {
  allowsDecimal: boolean
  step: number
  precision: number
  parseQty: (raw: string) => number
  formatQty: (n: number) => string
  validateInteger: boolean
}

const UOM_TYPE_CONFIG: Record<string, UomQuantityBehavior> = {
  volume: { allowsDecimal: true,  step: 0.1, precision: 1, parseQty: parseFloat,              formatQty: (n) => n.toFixed(1),             validateInteger: false },
  weight: { allowsDecimal: true,  step: 0.1, precision: 2, parseQty: parseFloat,              formatQty: (n) => n.toFixed(2),             validateInteger: false },
  count:  { allowsDecimal: false, step: 1,   precision: 0, parseQty: (r) => parseInt(r, 10), formatQty: (n) => Math.round(n).toString(), validateInteger: true  },
  length: { allowsDecimal: true,  step: 0.5, precision: 1, parseQty: parseFloat,              formatQty: (n) => n.toFixed(1),             validateInteger: false },
}

const FALLBACK: UomQuantityBehavior = UOM_TYPE_CONFIG.volume

export function getUomBehavior(uomType?: string | null): UomQuantityBehavior {
  return UOM_TYPE_CONFIG[uomType ?? ''] ?? FALLBACK
}

export function validateLooseQuantity(
  amount: number,
  uomType?: string | null
): { valid: boolean; error?: string } {
  const cfg = getUomBehavior(uomType)
  if (!Number.isFinite(amount) || amount <= 0) {
    return { valid: false, error: 'Amount must be a positive number' }
  }
  if (cfg.validateInteger && !Number.isInteger(amount)) {
    return { valid: false, error: `Amount must be a whole number for ${uomType ?? 'count'} units` }
  }
  return { valid: true }
}
