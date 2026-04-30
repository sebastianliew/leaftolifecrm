export const DISCOUNT_SOURCES = ['membership', 'gift', 'manual_override'] as const;
export type DiscountSource = typeof DISCOUNT_SOURCES[number];

export const MANUAL_DISCOUNT_SOURCES = ['gift', 'manual_override'] as const;
export type ManualDiscountSource = typeof MANUAL_DISCOUNT_SOURCES[number];

export type DiscountOverrideErrorCode =
  | 'INVALID_DISCOUNT_SOURCE'
  | 'MANUAL_OVERRIDE_FORBIDDEN'
  | 'GIFT_ITEM_NOT_ELIGIBLE'
  | 'MANUAL_OVERRIDE_INVALID_TARGET'
  | 'DISCOUNT_REASON_TOO_LONG';

export interface DiscountOverrideItem {
  name?: string;
  quantity?: number;
  unitPrice?: number;
  totalPrice?: number;
  discountAmount?: number;
  discountSource?: DiscountSource | string;
  discountReason?: string;
  itemType?: string;
  isService?: boolean;
  miscellaneousCategory?: string;
}

export interface DiscountOverrideValidationError {
  error: string;
  item?: string;
  code: DiscountOverrideErrorCode;
}

export interface DiscountOverrideOptions {
  allowDiscountOverride?: boolean;
}

type DiscountPermissionBag = {
  canApplyDiscounts?: boolean | number;
  canApplyProductDiscounts?: boolean | number;
  canApplyBillDiscounts?: boolean | number;
  unlimitedDiscounts?: boolean | number;
  maxDiscountPercent?: number;
  maxDiscountAmount?: number;
};

export interface DiscountOverrideUser {
  role?: string;
  featurePermissions?: {
    discounts?: DiscountPermissionBag;
  };
  effectivePermissions?: {
    discounts?: DiscountPermissionBag;
  };
  discountPermissions?: DiscountPermissionBag;
}

export class DiscountOverridePolicyError extends Error {
  readonly statusCode = 400;
  readonly code: DiscountOverrideErrorCode;
  readonly errors: DiscountOverrideValidationError[];

  constructor(errors: DiscountOverrideValidationError[]) {
    super(errors[0]?.error || 'Invalid discount override');
    this.name = 'DiscountOverridePolicyError';
    this.errors = errors;
    this.code = errors[0]?.code || 'INVALID_DISCOUNT_SOURCE';
  }
}

const DISCOUNT_SOURCE_SET = new Set<string>(DISCOUNT_SOURCES);
const MANUAL_DISCOUNT_SOURCE_SET = new Set<string>(MANUAL_DISCOUNT_SOURCES);
const GIFT_ELIGIBLE_ITEM_TYPES = new Set(['product', 'fixed_blend']);
const DISCOUNT_REASON_MAX_LENGTH = 200;
export const DEFAULT_GIFT_REASON = 'Gift / free of charge';

export function roundCurrency(value: number): number {
  const rounded = Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function isDiscountSource(value: unknown): value is DiscountSource {
  return typeof value === 'string' && DISCOUNT_SOURCE_SET.has(value);
}

export function isManualDiscountSource(value: unknown): value is ManualDiscountSource {
  return typeof value === 'string' && MANUAL_DISCOUNT_SOURCE_SET.has(value);
}

export function canUseDiscountOverride(user?: DiscountOverrideUser | null): boolean {
  return user?.role === 'super_admin';
}

export function getLineSubtotal(item: DiscountOverrideItem): number {
  return roundCurrency((item.unitPrice ?? 0) * (item.quantity ?? 0));
}

export function isCreditAdjustmentLine(item: DiscountOverrideItem): boolean {
  return item.miscellaneousCategory === 'credit' || getLineSubtotal(item) < 0;
}

export function isPositiveChargeLine(item: DiscountOverrideItem): boolean {
  return getLineSubtotal(item) > 0 && !isCreditAdjustmentLine(item);
}

export function isGiftEligibleItem(item: DiscountOverrideItem): boolean {
  return (
    isPositiveChargeLine(item) &&
    !item.isService &&
    GIFT_ELIGIBLE_ITEM_TYPES.has(item.itemType || '')
  );
}

export function isDiscountOverrideEligibleItem(item: DiscountOverrideItem): boolean {
  return isPositiveChargeLine(item);
}

export function getManualOverrideItems<T extends DiscountOverrideItem>(items: T[]): T[] {
  return items.filter(item => isManualDiscountSource(item.discountSource));
}

export function validateDiscountOverrideMetadata(
  items: DiscountOverrideItem[],
  options: DiscountOverrideOptions = {}
): { valid: boolean; errors: DiscountOverrideValidationError[] } {
  const errors: DiscountOverrideValidationError[] = [];

  for (const item of items) {
    const itemName = item.name || 'Unknown Item';

    if (item.discountSource !== undefined && !isDiscountSource(item.discountSource)) {
      errors.push({
        error: `Item "${itemName}" has an invalid discount source`,
        item: itemName,
        code: 'INVALID_DISCOUNT_SOURCE',
      });
      continue;
    }

    if ((item.discountReason?.length ?? 0) > DISCOUNT_REASON_MAX_LENGTH) {
      errors.push({
        error: `Item "${itemName}" has a discount reason longer than ${DISCOUNT_REASON_MAX_LENGTH} characters`,
        item: itemName,
        code: 'DISCOUNT_REASON_TOO_LONG',
      });
    }

    if (!isManualDiscountSource(item.discountSource)) {
      continue;
    }

    if (!options.allowDiscountOverride) {
      errors.push({
        error: `Item "${itemName}" uses a gift/manual discount override, which is only available to super admins`,
        item: itemName,
        code: 'MANUAL_OVERRIDE_FORBIDDEN',
      });
      continue;
    }

    if (item.discountSource === 'gift' && !isDiscountOverrideEligibleItem(item)) {
      errors.push({
        error: `Item "${itemName}" cannot be marked as a gift because it is not a positive charge line.`,
        item: itemName,
        code: 'GIFT_ITEM_NOT_ELIGIBLE',
      });
      continue;
    }

    if (item.discountSource === 'manual_override' && !isPositiveChargeLine(item)) {
      errors.push({
        error: `Item "${itemName}" cannot receive a manual override discount because it is not a positive charge line`,
        item: itemName,
        code: 'MANUAL_OVERRIDE_INVALID_TARGET',
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

export function assertDiscountOverrideMetadata(
  items: DiscountOverrideItem[],
  options: DiscountOverrideOptions = {}
): void {
  const result = validateDiscountOverrideMetadata(items, options);
  if (!result.valid) {
    throw new DiscountOverridePolicyError(result.errors);
  }
}

export function normalizeManualItemDiscount<T extends DiscountOverrideItem>(item: T): boolean {
  if (!isManualDiscountSource(item.discountSource)) {
    return false;
  }

  const itemSubtotal = getLineSubtotal(item);
  const requestedDiscount = item.discountSource === 'gift'
    ? itemSubtotal
    : item.discountAmount ?? 0;
  const discountAmount = roundCurrency(
    Math.min(Math.max(requestedDiscount, 0), Math.max(itemSubtotal, 0))
  );

  item.discountAmount = discountAmount;
  item.totalPrice = roundCurrency(itemSubtotal - discountAmount);

  if (item.discountSource === 'gift' && !item.discountReason) {
    item.discountReason = DEFAULT_GIFT_REASON;
  }

  return true;
}

export function normalizeManualItemDiscounts<T extends DiscountOverrideItem>(items: T[]): void {
  for (const item of items) {
    normalizeManualItemDiscount(item);
  }
}

export function getAdditionalDiscountBase(items: DiscountOverrideItem[]): number {
  return roundCurrency(items.reduce((sum, item) => {
    const subtotal = getLineSubtotal(item);
    if (subtotal <= 0 || isCreditAdjustmentLine(item)) {
      return sum;
    }
    return sum + Math.max(0, subtotal - (item.discountAmount ?? 0));
  }, 0));
}

export function getInvoiceItemDiscountLabel(items: DiscountOverrideItem[]): string {
  const discountedItems = items.filter(item => (item.discountAmount ?? 0) > 0);
  if (discountedItems.length === 0) {
    return 'Member Discounts:';
  }

  const allMembership = discountedItems.every(item => item.discountSource === undefined || item.discountSource === 'membership');
  if (allMembership) {
    return 'Member Discounts:';
  }

  const allGift = discountedItems.every(item => item.discountSource === 'gift');
  if (allGift) {
    return 'Gift Items:';
  }

  const allManual = discountedItems.every(item => item.discountSource === 'manual_override');
  if (allManual) {
    return 'Manual Discounts:';
  }

  return 'Item Discounts:';
}
