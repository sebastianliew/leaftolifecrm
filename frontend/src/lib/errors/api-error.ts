/**
 * Structured error thrown by fetchAPI for all non-2xx responses.
 * Carries the HTTP status, machine-readable code, and optional details
 * from the backend error handler — enabling callers to branch on `code`
 * instead of pattern-matching error strings.
 */

export interface ReferenceConflictDetails {
  type: 'blend_template' | 'bundle';
  name: string;
  id: string;
}

export interface InsufficientStockItem {
  productId: string;
  productName: string;
  requested: number;
  available: number;
  pool: 'loose' | 'sealed' | 'any';
  reason?: 'insufficient_stock' | 'product_not_found';
}

export interface InsufficientStockDetails {
  items: InsufficientStockItem[];
}

export class APIError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(message: string, status: number, code: string, details?: unknown) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  isReferenceConflict(): this is APIError & { details: ReferenceConflictDetails } {
    return this.code === 'REFERENCE_CONFLICT';
  }

  isInsufficientStock(): this is APIError & { details: InsufficientStockDetails } {
    return this.code === 'INSUFFICIENT_STOCK';
  }

  isNotFound() {
    return this.status === 404;
  }

  isForbidden() {
    return this.status === 403;
  }

  isUnauthorized() {
    return this.status === 401;
  }
}
