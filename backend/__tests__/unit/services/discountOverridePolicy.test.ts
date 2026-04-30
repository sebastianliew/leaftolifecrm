import { describe, expect, it } from '@jest/globals';
import {
  canUseDiscountOverride,
  type DiscountOverrideItem,
  getAdditionalDiscountBase,
  getInvoiceItemDiscountLabel,
  isDiscountOverrideEligibleItem,
  isGiftEligibleItem,
  normalizeManualItemDiscount,
  roundCurrency,
  validateDiscountOverrideMetadata,
} from '../../../services/discountOverridePolicy.js';

const productLine = {
  name: 'Book',
  itemType: 'product',
  quantity: 2,
  unitPrice: 25,
  totalPrice: 50,
};

describe('discountOverridePolicy', () => {
  it('allows bypass access only for super admins', () => {
    expect(canUseDiscountOverride({ role: 'super_admin' })).toBe(true);
    expect(canUseDiscountOverride({
      role: 'admin',
      featurePermissions: {
        discounts: {
          canApplyBillDiscounts: true,
          canApplyProductDiscounts: true,
          unlimitedDiscounts: true,
        },
      },
    })).toBe(false);
    expect(canUseDiscountOverride({
      role: 'admin',
      discountPermissions: {
        canApplyDiscounts: true,
        unlimitedDiscounts: true,
      },
    })).toBe(false);
    expect(canUseDiscountOverride({
      role: 'admin',
      featurePermissions: {
        discounts: {
          canApplyBillDiscounts: true,
          maxDiscountPercent: 50,
          unlimitedDiscounts: false,
        },
      },
    })).toBe(false);
  });

  it('allows gift only on positive product/fixed-blend charge lines', () => {
    expect(isGiftEligibleItem(productLine)).toBe(true);
    expect(isGiftEligibleItem({ ...productLine, itemType: 'fixed_blend' })).toBe(true);
    expect(isGiftEligibleItem({ ...productLine, itemType: 'custom_blend' })).toBe(false);
    expect(isGiftEligibleItem({ ...productLine, isService: true })).toBe(false);
    expect(isGiftEligibleItem({ ...productLine, unitPrice: -25, miscellaneousCategory: 'credit' })).toBe(false);
  });

  it('treats any positive charge line as a super-admin override target', () => {
    expect(isDiscountOverrideEligibleItem({ ...productLine, itemType: 'bundle' })).toBe(true);
    expect(isDiscountOverrideEligibleItem({ ...productLine, itemType: 'custom_blend' })).toBe(true);
    expect(isDiscountOverrideEligibleItem({ ...productLine, itemType: 'consultation', isService: true })).toBe(true);
    expect(isDiscountOverrideEligibleItem({ ...productLine, itemType: 'miscellaneous' })).toBe(true);
    expect(isDiscountOverrideEligibleItem({ ...productLine, unitPrice: -10, miscellaneousCategory: 'credit' })).toBe(false);
  });

  it('validates override access and invalid targets with explicit codes', () => {
    expect(validateDiscountOverrideMetadata([
      { ...productLine, discountSource: 'gift' },
    ])).toMatchObject({
      valid: false,
      errors: [{ code: 'MANUAL_OVERRIDE_FORBIDDEN' }],
    });

    expect(validateDiscountOverrideMetadata([
      { ...productLine, itemType: 'custom_blend', discountSource: 'gift' },
    ], { allowDiscountOverride: true })).toMatchObject({
      valid: true,
      errors: [],
    });

    expect(validateDiscountOverrideMetadata([
      { ...productLine, unitPrice: -10, discountSource: 'manual_override' },
    ], { allowDiscountOverride: true })).toMatchObject({
      valid: false,
      errors: [{ code: 'MANUAL_OVERRIDE_INVALID_TARGET' }],
    });

    expect(validateDiscountOverrideMetadata([
      { ...productLine, discountSource: 'manual_override', discountReason: 'x'.repeat(201) },
    ], { allowDiscountOverride: true })).toMatchObject({
      valid: false,
      errors: [{ code: 'DISCOUNT_REASON_TOO_LONG' }],
    });
  });

  it('normalizes gifts and manual overrides idempotently', () => {
    const gift: DiscountOverrideItem = { ...productLine, discountSource: 'gift', discountAmount: 1 };

    expect(normalizeManualItemDiscount(gift)).toBe(true);
    expect(gift.discountAmount).toBe(50);
    expect(gift.totalPrice).toBe(0);
    expect(gift.discountReason).toBe('Gift / free of charge');

    expect(normalizeManualItemDiscount(gift)).toBe(true);
    expect(gift.discountAmount).toBe(50);
    expect(gift.totalPrice).toBe(0);

    const manual: DiscountOverrideItem = { ...productLine, discountSource: 'manual_override', discountAmount: 999 };
    expect(normalizeManualItemDiscount(manual)).toBe(true);
    expect(manual.discountAmount).toBe(50);
    expect(manual.totalPrice).toBe(0);
  });

  it('excludes gifted and credit lines from percentage bill discount base', () => {
    expect(getAdditionalDiscountBase([
      { ...productLine, discountAmount: 50, discountSource: 'gift' },
      { ...productLine, name: 'Charge', quantity: 1, unitPrice: 100, discountAmount: 10 },
      { name: 'Credit', itemType: 'miscellaneous', miscellaneousCategory: 'credit', quantity: 1, unitPrice: -20 },
    ])).toBe(90);
  });

  it('rounds currency without negative zero and chooses invoice labels by source', () => {
    expect(Object.is(roundCurrency(-0.001), -0)).toBe(false);
    expect(roundCurrency(0.105)).toBe(0.11);

    expect(getInvoiceItemDiscountLabel([
      { ...productLine, discountAmount: 5, discountSource: 'membership' },
    ])).toBe('Member Discounts:');
    expect(getInvoiceItemDiscountLabel([
      { ...productLine, discountAmount: 50, discountSource: 'gift' },
    ])).toBe('Gift Items:');
    expect(getInvoiceItemDiscountLabel([
      { ...productLine, discountAmount: 10, discountSource: 'manual_override' },
    ])).toBe('Manual Discounts:');
    expect(getInvoiceItemDiscountLabel([
      { ...productLine, discountAmount: 5, discountSource: 'membership' },
      { ...productLine, discountAmount: 50, discountSource: 'gift' },
    ])).toBe('Item Discounts:');
  });
});
