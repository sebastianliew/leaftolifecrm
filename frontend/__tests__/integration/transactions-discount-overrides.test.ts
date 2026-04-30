import {
  canUseDiscountOverride,
  getAdditionalDiscountBase,
  getInvoiceItemDiscountLabel,
  isGiftEligibleItem,
  normalizeManualDiscount,
  prepareDiscountOverrideItem,
  roundCurrency,
} from '@/lib/transactions/discountOverrides'
import type { TransactionItem } from '@/types/transaction'

const baseItem: TransactionItem = {
  id: 'line-1',
  productId: 'product-1',
  name: 'Gift Book',
  quantity: 2,
  unitPrice: 25,
  totalPrice: 50,
  discountAmount: 0,
  itemType: 'product',
  isService: false,
  saleType: 'quantity',
  unitOfMeasurementId: 'unit',
  baseUnit: 'pcs',
  convertedQuantity: 2,
}

describe('transaction discount override utilities', () => {
  it('allows override UI for super admins and explicit unlimited discount users', () => {
    expect(canUseDiscountOverride({ role: 'super_admin' })).toBe(true)
    expect(canUseDiscountOverride({
      role: 'admin',
      featurePermissions: {
        discounts: {
          canApplyBillDiscounts: true,
          canApplyProductDiscounts: true,
          unlimitedDiscounts: true,
        },
      },
    })).toBe(true)
    expect(canUseDiscountOverride({
      role: 'admin',
      featurePermissions: {
        discounts: {
          canApplyBillDiscounts: true,
          unlimitedDiscounts: false,
        },
      },
    })).toBe(false)
  })

  it('normalizes gifted lines as free and keeps quantity changes free', () => {
    const gifted = normalizeManualDiscount({
      ...baseItem,
      discountSource: 'gift',
    })

    expect(gifted.discountAmount).toBe(50)
    expect(gifted.totalPrice).toBe(0)
    expect(gifted.discountReason).toBe('Gift / free of charge')

    const quantityChanged = normalizeManualDiscount({
      ...gifted,
      quantity: 3,
    })

    expect(quantityChanged.discountAmount).toBe(75)
    expect(quantityChanged.totalPrice).toBe(0)
  })

  it('limits gift eligibility to positive product/fixed-blend lines', () => {
    expect(isGiftEligibleItem(baseItem)).toBe(true)
    expect(isGiftEligibleItem({ ...baseItem, itemType: 'fixed_blend' })).toBe(true)
    expect(isGiftEligibleItem({ ...baseItem, itemType: 'custom_blend' })).toBe(false)
    expect(isGiftEligibleItem({ ...baseItem, isService: true })).toBe(false)
    expect(isGiftEligibleItem({ ...baseItem, itemType: 'miscellaneous', miscellaneousCategory: 'credit', unitPrice: -20 })).toBe(false)
  })

  it('strips stale manual metadata for non-super-admin payloads', () => {
    const prepared = prepareDiscountOverrideItem({
      ...baseItem,
      discountSource: 'gift',
      discountAmount: 50,
      totalPrice: 0,
    }, false)

    expect(prepared.discountSource).toBeUndefined()
    expect(prepared.discountReason).toBeUndefined()
    expect(prepared.discountAmount).toBe(0)
    expect(prepared.totalPrice).toBe(50)
  })

  it('excludes gifts and credit lines from percentage bill discount base', () => {
    expect(getAdditionalDiscountBase([
      { ...baseItem, discountSource: 'gift', discountAmount: 50, totalPrice: 0 },
      { ...baseItem, id: 'line-2', name: 'Paid item', quantity: 1, unitPrice: 100, discountAmount: 10, totalPrice: 90 },
      { ...baseItem, id: 'line-3', name: 'Credit', itemType: 'miscellaneous', miscellaneousCategory: 'credit', quantity: 1, unitPrice: -20, totalPrice: -20 },
    ])).toBe(90)
  })

  it('rounds without negative zero and labels mixed invoice discounts', () => {
    expect(Object.is(roundCurrency(-0.001), -0)).toBe(false)
    expect(getInvoiceItemDiscountLabel([
      { ...baseItem, discountSource: 'gift', discountAmount: 50 },
      { ...baseItem, id: 'line-2', discountSource: 'membership', discountAmount: 5 },
    ])).toBe('Item Discounts')
  })
})
