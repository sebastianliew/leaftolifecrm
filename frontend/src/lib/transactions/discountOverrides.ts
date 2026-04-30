import type { TransactionItem } from "@/types/transaction"

export type DiscountSource = NonNullable<TransactionItem["discountSource"]>

const MANUAL_DISCOUNT_SOURCES = new Set<DiscountSource>(["gift", "manual_override"])
const DEFAULT_GIFT_REASON = "Gift / free of charge"
const DISCOUNT_ELIGIBLE_ITEM_TYPES = new Set(["product", "fixed_blend"])

type DiscountPermissionBag = {
  canApplyDiscounts?: boolean | number
  canApplyProductDiscounts?: boolean | number
  canApplyBillDiscounts?: boolean | number
  unlimitedDiscounts?: boolean | number
  maxDiscountPercent?: number
  maxDiscountAmount?: number
}

type DiscountOverrideUser = {
  role?: string
  featurePermissions?: { discounts?: DiscountPermissionBag }
  effectivePermissions?: { discounts?: DiscountPermissionBag }
  discountPermissions?: DiscountPermissionBag
}

export const roundCurrency = (value: number) => {
  const rounded = Math.round((Number.isFinite(value) ? value : 0) * 100) / 100
  return Object.is(rounded, -0) ? 0 : rounded
}

export const canUseDiscountOverride = (user?: DiscountOverrideUser | null) => {
  return user?.role === "super_admin"
}

export const getLineSubtotal = (item: TransactionItem) =>
  roundCurrency((item.unitPrice || 0) * (item.quantity || 0))

export const isManualDiscountItem = (item: TransactionItem) =>
  !!item.discountSource && MANUAL_DISCOUNT_SOURCES.has(item.discountSource)

export const isGiftItem = (item: TransactionItem) => item.discountSource === "gift"

export const isCreditAdjustmentLine = (item: TransactionItem) =>
  item.miscellaneousCategory === "credit" || getLineSubtotal(item) < 0

export const isPositiveChargeLine = (item: TransactionItem) =>
  getLineSubtotal(item) > 0 && !isCreditAdjustmentLine(item)

export const isGiftEligibleItem = (item: TransactionItem) =>
  isPositiveChargeLine(item) &&
  !item.isService &&
  DISCOUNT_ELIGIBLE_ITEM_TYPES.has(item.itemType || "")

export const isDiscountOverrideEligibleItem = (item: TransactionItem) =>
  isPositiveChargeLine(item)

export const isBillDiscountEligibleItem = (item: TransactionItem) => {
  if (!isPositiveChargeLine(item) || item.isService) return false
  if (!DISCOUNT_ELIGIBLE_ITEM_TYPES.has(item.itemType || "")) return false

  const discountFlags = item.product?.discountFlags
  return discountFlags?.discountableForAll !== false && discountFlags?.discountableForMembers !== false
}

export const normalizeManualDiscount = (item: TransactionItem): TransactionItem => {
  if (!isManualDiscountItem(item)) return item

  const subtotal = getLineSubtotal(item)
  const requestedDiscount = item.discountSource === "gift"
    ? subtotal
    : item.discountAmount || 0
  const discountAmount = roundCurrency(Math.min(Math.max(requestedDiscount, 0), Math.max(subtotal, 0)))

  return {
    ...item,
    discountAmount,
    discountReason: item.discountSource === "gift"
      ? item.discountReason || DEFAULT_GIFT_REASON
      : item.discountReason,
    totalPrice: roundCurrency(subtotal - discountAmount),
  }
}

export const clearDiscountMetadata = (item: TransactionItem): TransactionItem => {
  const next = { ...item }
  delete next.discountSource
  delete next.discountReason
  return next
}

export const stripManualDiscountForRole = (
  item: TransactionItem,
  allowManualOverride: boolean
): TransactionItem => {
  if (allowManualOverride || !isManualDiscountItem(item)) return item

  return {
    ...clearDiscountMetadata(item),
    discountAmount: 0,
    totalPrice: getLineSubtotal(item),
  }
}

export const prepareDiscountOverrideItem = (
  item: TransactionItem,
  allowManualOverride: boolean
): TransactionItem => normalizeManualDiscount(stripManualDiscountForRole(item, allowManualOverride))

export const getAdditionalDiscountBase = (items: TransactionItem[]) =>
  roundCurrency(items.reduce((sum, item) => {
    const subtotal = getLineSubtotal(item)
    if (subtotal <= 0 || isCreditAdjustmentLine(item)) return sum
    return sum + Math.max(0, subtotal - (item.discountAmount || 0))
  }, 0))

export const getBillDiscountBase = (
  items: TransactionItem[],
  allowDiscountOverride: boolean
) => {
  if (allowDiscountOverride) return getAdditionalDiscountBase(items)

  return roundCurrency(items.reduce((sum, item) => {
    if (!isBillDiscountEligibleItem(item)) return sum
    return sum + Math.max(0, getLineSubtotal(item) - (item.discountAmount || 0))
  }, 0))
}

export const getBillDiscountBlockedItems = (
  items: TransactionItem[],
  allowDiscountOverride: boolean
) => {
  if (allowDiscountOverride) return []
  return items.filter(item => isPositiveChargeLine(item) && !isBillDiscountEligibleItem(item))
}

export const getItemDiscountLabel = (
  item: TransactionItem,
  memberDiscountPercentage?: number
) => {
  if (item.discountSource === "gift") return "Gift"
  if (item.discountSource === "manual_override") return "Manual override"
  if (memberDiscountPercentage) return `${memberDiscountPercentage}% member`
  return "Discount"
}

export const getInvoiceItemDiscountLabel = (items: TransactionItem[]) => {
  const discountedItems = items.filter(item => (item.discountAmount || 0) > 0)
  if (discountedItems.length === 0) return "Member Discounts"

  const allMembership = discountedItems.every(item => !item.discountSource || item.discountSource === "membership")
  if (allMembership) return "Member Discounts"

  const allGift = discountedItems.every(item => item.discountSource === "gift")
  if (allGift) return "Gift Items"

  const allManual = discountedItems.every(item => item.discountSource === "manual_override")
  if (allManual) return "Manual Discounts"

  return "Item Discounts"
}
