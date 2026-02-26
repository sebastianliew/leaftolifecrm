/**
 * DiscountValidationService — Single source of truth for membership discount rules.
 *
 * Business Rules:
 * ┌─────────────────┬────────────┬──────────────────────────────────────────┐
 * │ Item Type       │ Eligible?  │ Reason                                   │
 * ├─────────────────┼────────────┼──────────────────────────────────────────┤
 * │ product         │ ✅ Yes     │ Standard products (qty & volume)         │
 * │ fixed_blend     │ ✅ Yes     │ Pre-defined blends at standard pricing   │
 * │ custom_blend    │ ❌ No      │ Already margin-priced on ingredient cost │
 * │ bundle          │ ❌ No      │ Already has bundle discount pricing      │
 * │ consultation    │ ❌ No      │ Not a product                            │
 * │ service         │ ❌ No      │ Not a product                            │
 * │ miscellaneous   │ ❌ No      │ Not a product                            │
 * └─────────────────┴────────────┴──────────────────────────────────────────┘
 *
 * Additional checks:
 * - Product.discountFlags.discountableForMembers must not be false
 * - Discount % must not exceed patient's membership tier entitlement
 * - These rules apply to ALL transactions (drafts included)
 */

import { Product } from '../models/Product.js';

// Item types eligible for membership discounts
const DISCOUNT_ELIGIBLE_ITEM_TYPES = new Set(['product', 'fixed_blend']);

// Rounding tolerance: allow 0.5% over to account for floating point / cent rounding
const DISCOUNT_TOLERANCE_PCT = 0.5;

export interface TransactionItem {
  productId?: string;
  name?: string;
  quantity?: number;
  unitPrice?: number;
  totalPrice?: number;
  discountAmount?: number;
  isService?: boolean;
  itemType?: string;
}

export interface DiscountValidationError {
  error: string;
  item?: string;
  code: 'ITEM_TYPE_NOT_ELIGIBLE' | 'PRODUCT_NOT_DISCOUNTABLE' | 'EXCEEDS_TIER_LIMIT';
}

export interface DiscountValidationResult {
  valid: boolean;
  errors: DiscountValidationError[];
}

export class DiscountValidationService {
  /**
   * Validate all item-level discounts on a transaction.
   * Call this for BOTH create and update paths, regardless of draft/completed status.
   *
   * @param items        - Transaction items array
   * @param customerId   - Patient/customer ID (if any)
   * @param maxDiscountPct - Patient's membership discount % (0 if no membership)
   */
  static async validateItemDiscounts(
    items: TransactionItem[],
    customerId: string | null | undefined,
    maxDiscountPct: number
  ): Promise<DiscountValidationResult> {
    const errors: DiscountValidationError[] = [];

    // Collect product IDs that have discounts so we can batch-fetch discountFlags
    const discountedProductIds: string[] = [];
    for (const item of items) {
      if ((item.discountAmount ?? 0) > 0 && item.productId) {
        discountedProductIds.push(item.productId);
      }
    }

    // Batch-fetch products to check discountFlags (only real MongoDB ObjectIds)
    const { isValidObjectId } = await import('../lib/validations/sanitize.js');
    const validProductIds = discountedProductIds.filter(id => isValidObjectId(id));
    const productFlagsMap = new Map<string, { discountableForMembers: boolean }>();

    if (validProductIds.length > 0) {
      const products = await Product.find(
        { _id: { $in: validProductIds } },
        { discountFlags: 1 }
      ).lean();

      for (const p of products as Array<{ _id: unknown; discountFlags?: { discountableForMembers?: boolean } }>) {
        productFlagsMap.set(String(p._id), {
          // Schema default is true, so only false means explicitly non-discountable
          discountableForMembers: p.discountFlags?.discountableForMembers !== false
        });
      }
    }

    for (const item of items) {
      const discount = item.discountAmount ?? 0;
      if (discount <= 0) continue; // No discount on this item — skip

      const itemName = item.name || 'Unknown Item';

      // ── CHECK 1: Item type eligibility ──
      // Services are never eligible regardless of itemType
      if (item.isService) {
        errors.push({
          error: `Item "${itemName}" is a service and not eligible for membership discounts`,
          item: itemName,
          code: 'ITEM_TYPE_NOT_ELIGIBLE'
        });
        continue;
      }

      // Only product and fixed_blend are eligible — missing itemType is also rejected
      if (!item.itemType || !DISCOUNT_ELIGIBLE_ITEM_TYPES.has(item.itemType)) {
        errors.push({
          error: `Item "${itemName}" (type: ${item.itemType || 'unknown'}) is not eligible for membership discounts`,
          item: itemName,
          code: 'ITEM_TYPE_NOT_ELIGIBLE'
        });
        continue;
      }

      // ── CHECK 2: Product discountFlags ──
      if (item.productId && isValidObjectId(item.productId)) {
        const flags = productFlagsMap.get(item.productId);
        // If product found and explicitly marked as not discountable
        if (flags && !flags.discountableForMembers) {
          errors.push({
            error: `Item "${itemName}" is not eligible for membership discounts (product flagged as non-discountable)`,
            item: itemName,
            code: 'PRODUCT_NOT_DISCOUNTABLE'
          });
          continue;
        }
      }

      // ── CHECK 3: Discount % does not exceed patient tier ──
      const itemTotal = (item.unitPrice ?? 0) * (item.quantity ?? 0);
      if (itemTotal <= 0) {
        // Zero or negative subtotal with a discount is invalid
        errors.push({
          error: `Item "${itemName}" has a discount but zero or negative subtotal`,
          item: itemName,
          code: 'EXCEEDS_TIER_LIMIT'
        });
        continue;
      }
      {
        const appliedPct = (discount / itemTotal) * 100;
        if (appliedPct > maxDiscountPct + DISCOUNT_TOLERANCE_PCT) {
          errors.push({
            error: `Item "${itemName}" has ${appliedPct.toFixed(1)}% discount but patient's tier allows max ${maxDiscountPct}%`,
            item: itemName,
            code: 'EXCEEDS_TIER_LIMIT'
          });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate bill-level discount against non-discountable items.
   * Bill-level discounts must not effectively discount items that are
   * non-discountable (services, custom blends, bundles, flagged products).
   *
   * If ALL items are discount-eligible, bill-level discount is fine.
   * If ANY items are non-eligible, reject the bill-level discount —
   * staff should use per-item discounts instead.
   */
  static async validateBillDiscount(
    billDiscountAmount: number,
    items: TransactionItem[]
  ): Promise<{ valid: boolean; error?: string }> {
    if (!billDiscountAmount || billDiscountAmount <= 0) {
      return { valid: true };
    }

    // Check if any items are not eligible for discounts
    const { isValidObjectId } = await import('../lib/validations/sanitize.js');

    // Collect product IDs to check flags
    const productIds = items
      .filter(i => i.productId && isValidObjectId(i.productId))
      .map(i => i.productId as string);

    const productFlagsMap = new Map<string, boolean>();
    if (productIds.length > 0) {
      const products = await Product.find(
        { _id: { $in: productIds } },
        { discountFlags: 1 }
      ).lean() as Array<{ _id: unknown; discountFlags?: { discountableForMembers?: boolean } }>;

      for (const p of products) {
        productFlagsMap.set(String(p._id), p.discountFlags?.discountableForMembers !== false);
      }
    }

    const nonEligibleItems: string[] = [];
    for (const item of items) {
      const itemName = item.name || 'Unknown Item';

      // Service check
      if (item.isService) {
        nonEligibleItems.push(itemName);
        continue;
      }

      // Item type check
      if (!item.itemType || !DISCOUNT_ELIGIBLE_ITEM_TYPES.has(item.itemType)) {
        nonEligibleItems.push(itemName);
        continue;
      }

      // Product flag check
      if (item.productId && isValidObjectId(item.productId)) {
        const discountable = productFlagsMap.get(item.productId);
        if (discountable === false) {
          nonEligibleItems.push(itemName);
        }
      }
    }

    if (nonEligibleItems.length > 0) {
      return {
        valid: false,
        error: `Bill-level discount cannot be applied because ${nonEligibleItems.length} item(s) are not eligible for discounts: ${nonEligibleItems.join(', ')}. Use per-item discounts on eligible items instead.`
      };
    }

    return { valid: true };
  }

  /**
   * Resolve the patient's max discount percentage from their membership tier.
   * Returns 0 if no patient, no membership, or patient not found.
   */
  static async getPatientMaxDiscount(customerId: string | null | undefined): Promise<{
    maxDiscountPct: number;
    patientStatus?: string;
  }> {
    if (!customerId) return { maxDiscountPct: 0 };

    const { isValidObjectId } = await import('../lib/validations/sanitize.js');
    if (!isValidObjectId(customerId)) return { maxDiscountPct: 0 };

    const { Patient: PatientModel } = await import('../models/Patient.js');
    const patient = await PatientModel.findById(customerId)
      .select('status memberBenefits')
      .lean() as { status?: string; memberBenefits?: { discountPercentage?: number } } | null;

    if (!patient) return { maxDiscountPct: 0 };

    return {
      maxDiscountPct: patient.memberBenefits?.discountPercentage ?? 0,
      patientStatus: patient.status
    };
  }

  /**
   * Full validation pipeline: resolve patient tier + validate all items.
   * Use this as the single entry point from controllers.
   */
  static async validateTransaction(
    items: TransactionItem[],
    customerId: string | null | undefined
  ): Promise<DiscountValidationResult & { patientStatus?: string }> {
    // If no items have discounts, short-circuit
    const hasAnyDiscount = items.some(i => (i.discountAmount ?? 0) > 0);
    if (!hasAnyDiscount) {
      return { valid: true, errors: [] };
    }

    const { maxDiscountPct, patientStatus } = await this.getPatientMaxDiscount(customerId);

    // Warn if patient is inactive
    if (patientStatus === 'inactive') {
      console.warn('[DiscountValidation] Transaction for INACTIVE patient:', customerId);
    }

    const result = await this.validateItemDiscounts(items, customerId, maxDiscountPct);
    return { ...result, patientStatus };
  }
}
