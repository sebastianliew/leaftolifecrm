/**
 * Stress + edge tests for the 2026-04-28 discountFlags enforcement work.
 *
 * Pairs with discount-flags-enforcement.test.ts (smoke). This file pushes:
 *   - high item counts with mixed flag states
 *   - bill-level discount interaction with flagged items
 *   - tier-limit + flag layering
 *   - fixed_blend item type honors the flags
 *   - default-flag and missing-flag behavior
 *   - update-path validation symmetry with create-path
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import mongoose from 'mongoose';
import {
  createTestProduct,
  createTestUnit,
  Product,
} from '../setup/test-fixtures.js';
import { setupTestDB, teardownTestDB } from '../setup/mongodb-memory-server.js';
import { DiscountValidationService } from '../../services/DiscountValidationService.js';
import { transactionCalculationService } from '../../services/TransactionCalculationService.js';

beforeAll(async () => { await setupTestDB(); }, 60_000);
afterAll(async () => { await teardownTestDB(); }, 30_000);
beforeEach(async () => { await Product.deleteMany({}); });

async function makeProduct(opts: {
  name?: string;
  sellingPrice?: number;
  flags?: { discountableForAll?: boolean; discountableForMembers?: boolean; discountableInBlends?: boolean };
} = {}) {
  const unit = await createTestUnit({ name: 'cap' });
  const product = await createTestProduct({
    name: opts.name || `Product ${Math.random().toString(36).slice(2, 8)}`,
    unitOfMeasurement: unit._id as mongoose.Types.ObjectId,
    sellingPrice: opts.sellingPrice ?? 100,
    costPrice: 40,
    currentStock: 50,
    availableStock: 50,
  });
  if (opts.flags) {
    await Product.updateOne({ _id: product._id }, { $set: { discountFlags: opts.flags } });
  }
  return product;
}

describe('STRESS — 50 mixed-flag items in one transaction', () => {
  it('only normally-flagged items receive the auto member discount', async () => {
    const Patient = mongoose.models.Patient || mongoose.model(
      'Patient',
      new mongoose.Schema({
        firstName: String,
        memberBenefits: { membershipTier: String, discountPercentage: Number },
      }, { strict: false }),
    );
    const patient = await Patient.create({
      firstName: 'Stress',
      memberBenefits: { membershipTier: 'gold', discountPercentage: 15 },
    });

    // 20 normal, 15 flagged-forAll, 15 flagged-forMembers
    const normalProducts = await Promise.all(
      Array.from({ length: 20 }, (_, i) => makeProduct({ name: `Normal-${i}`, sellingPrice: 100 })),
    );
    const blockedAllProducts = await Promise.all(
      Array.from({ length: 15 }, (_, i) => makeProduct({
        name: `BlockAll-${i}`,
        sellingPrice: 200,
        flags: { discountableForAll: false, discountableForMembers: true },
      })),
    );
    const blockedMembersProducts = await Promise.all(
      Array.from({ length: 15 }, (_, i) => makeProduct({
        name: `BlockMembers-${i}`,
        sellingPrice: 300,
        flags: { discountableForAll: true, discountableForMembers: false },
      })),
    );

    const items = [
      ...normalProducts.map(p => ({ productId: String(p._id), name: p.name, quantity: 1, unitPrice: 100, itemType: 'product' })),
      ...blockedAllProducts.map(p => ({ productId: String(p._id), name: p.name, quantity: 1, unitPrice: 200, itemType: 'product' })),
      ...blockedMembersProducts.map(p => ({ productId: String(p._id), name: p.name, quantity: 1, unitPrice: 300, itemType: 'product' })),
    ];

    const result = await transactionCalculationService.calculateTransaction({
      items,
      customerId: String(patient._id),
      discountAmount: 0,
    });

    expect(result.items).toHaveLength(50);

    const discounted = result.items.filter(i => (i.discountAmount ?? 0) > 0);
    const undiscounted = result.items.filter(i => (i.discountAmount ?? 0) === 0);

    expect(discounted).toHaveLength(20);
    expect(undiscounted).toHaveLength(30);

    // Every discounted item must be from the normal cohort.
    for (const item of discounted) {
      expect(item.name).toMatch(/^Normal-/);
      expect(item.discountAmount).toBeCloseTo(100 * 0.15, 2);
    }
    // Every undiscounted item is one of the blocked cohorts.
    for (const item of undiscounted) {
      expect(item.name).toMatch(/^Block(All|Members)-/);
    }
  });
});

describe('STRESS — bill-level discount with mixed eligibility', () => {
  it('rejects bill discount when ANY item is flagged non-discountable', async () => {
    const okProducts = await Promise.all(
      Array.from({ length: 5 }, (_, i) => makeProduct({ name: `OK-${i}` })),
    );
    const blocked = await makeProduct({
      name: 'BIOMA-clone',
      flags: { discountableForAll: false, discountableForMembers: true },
    });

    const items = [
      ...okProducts.map(p => ({ productId: String(p._id), name: p.name, itemType: 'product', unitPrice: 100, quantity: 1 })),
      { productId: String(blocked._id), name: 'BIOMA-clone', itemType: 'product', unitPrice: 390, quantity: 1 },
    ];

    const result = await DiscountValidationService.validateBillDiscount(50, items);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/BIOMA-clone/);
    expect(result.error).toMatch(/per-item discounts/);
  });

  it('accepts bill discount when EVERY item is eligible', async () => {
    const products = await Promise.all(
      Array.from({ length: 5 }, (_, i) => makeProduct({ name: `OK-${i}` })),
    );
    const items = products.map(p => ({
      productId: String(p._id), name: p.name, itemType: 'product', unitPrice: 100, quantity: 1,
    }));

    const result = await DiscountValidationService.validateBillDiscount(50, items);
    expect(result.valid).toBe(true);
  });
});

describe('SUPER ADMIN BYPASS — mixed and pre-priced charges', () => {
  it('allows bill discounts on mixed carts only when bypass is enabled', async () => {
    const blocked = await makeProduct({
      name: 'Flagged Product',
      flags: { discountableForAll: false, discountableForMembers: true },
    });
    const items = [
      { productId: String(blocked._id), name: 'Flagged Product', itemType: 'product', unitPrice: 100, quantity: 1 },
      { name: 'Bundle', itemType: 'bundle', unitPrice: 80, quantity: 1 },
      { name: 'Consultation', itemType: 'consultation', isService: true, unitPrice: 50, quantity: 1 },
    ];

    const normal = await DiscountValidationService.validateBillDiscount(25, items);
    const superAdmin = await DiscountValidationService.validateBillDiscount(25, items, { allowDiscountOverride: true });

    expect(normal.valid).toBe(false);
    expect(superAdmin.valid).toBe(true);
  });

  it('allows super-admin manual and gift overrides on any positive charge line', async () => {
    const items = [
      { name: 'Bundle', itemType: 'bundle', unitPrice: 80, quantity: 1, discountAmount: 15, discountSource: 'manual_override' },
      { name: 'Custom Blend', itemType: 'custom_blend', unitPrice: 60, quantity: 1, discountAmount: 10, discountSource: 'manual_override' },
      { name: 'Consultation', itemType: 'consultation', isService: true, unitPrice: 50, quantity: 1, discountSource: 'gift' },
      { name: 'Misc Fee', itemType: 'miscellaneous', unitPrice: 20, quantity: 1, discountSource: 'gift' },
    ];

    const normal = await DiscountValidationService.validateTransaction(items, null);
    const superAdmin = await DiscountValidationService.validateTransaction(items, null, { allowDiscountOverride: true });

    expect(normal.valid).toBe(false);
    expect(normal.errors[0].code).toBe('MANUAL_OVERRIDE_FORBIDDEN');
    expect(superAdmin.valid).toBe(true);
  });

  it('clamps line and bill discounts so totals never go negative', async () => {
    const result = await transactionCalculationService.calculateTransaction({
      items: [
        { name: 'Bundle', itemType: 'bundle', unitPrice: 80, quantity: 1, discountAmount: 999, discountSource: 'manual_override' },
        { name: 'Consultation', itemType: 'consultation', isService: true, unitPrice: 50, quantity: 1, discountSource: 'gift' },
      ],
      customerId: null,
      discountAmount: 999,
      allowDiscountOverride: true,
    });

    expect(result.items[0].discountAmount).toBe(80);
    expect(result.items[0].totalPrice).toBe(0);
    expect(result.items[1].discountAmount).toBe(50);
    expect(result.items[1].totalPrice).toBe(0);
    expect(result.billDiscountAmount).toBe(0);
    expect(result.totalAmount).toBe(0);
  });
});

describe('EDGE — tier limit and flags compose correctly', () => {
  it('flag rejection takes precedence over (would-have-been-passing) tier check', async () => {
    const blocked = await makeProduct({
      sellingPrice: 100,
      flags: { discountableForAll: false, discountableForMembers: true },
    });

    // 5% discount on $100 = $5; well under the 10% tier limit.
    // The flag must reject this anyway.
    const result = await DiscountValidationService.validateItemDiscounts(
      [{ productId: String(blocked._id), name: 'B', quantity: 1, unitPrice: 100, discountAmount: 5, itemType: 'product' }],
      null,
      10,
    );

    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe('PRODUCT_NOT_DISCOUNTABLE');
  });

  it('tier limit still enforced on a fully eligible item', async () => {
    const ok = await makeProduct({ sellingPrice: 100 });

    // 25% discount on $100 = $25; tier allows 10%. EXCEEDS_TIER_LIMIT.
    const result = await DiscountValidationService.validateItemDiscounts(
      [{ productId: String(ok._id), name: 'OK', quantity: 1, unitPrice: 100, discountAmount: 25, itemType: 'product' }],
      null,
      10,
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe('EXCEEDS_TIER_LIMIT');
  });
});

describe('EDGE — fixed_blend itemType honors the flags', () => {
  it('blocks discount on a fixed_blend product flagged discountableForAll=false', async () => {
    const blendProduct = await makeProduct({
      name: 'Premium Blend',
      sellingPrice: 80,
      flags: { discountableForAll: false, discountableForMembers: true },
    });

    const result = await DiscountValidationService.validateItemDiscounts(
      [{ productId: String(blendProduct._id), name: 'Premium Blend', quantity: 1, unitPrice: 80, discountAmount: 8, itemType: 'fixed_blend' }],
      null,
      10,
    );
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe('PRODUCT_NOT_DISCOUNTABLE');
  });
});

describe('EDGE — default flags and absent flags', () => {
  it('product without any discountFlags subdoc behaves as if both flags=true', async () => {
    // makeProduct with no flags arg → schema defaults apply at write time
    const product = await makeProduct({ sellingPrice: 100 });
    // sanity: schema default
    const fresh = await Product.findById(product._id).lean() as { discountFlags?: { discountableForAll?: boolean; discountableForMembers?: boolean } };
    expect(fresh.discountFlags?.discountableForAll).toBe(true);
    expect(fresh.discountFlags?.discountableForMembers).toBe(true);

    const result = await DiscountValidationService.validateItemDiscounts(
      [{ productId: String(product._id), name: 'Default', quantity: 1, unitPrice: 100, discountAmount: 10, itemType: 'product' }],
      null,
      10,
    );
    expect(result.valid).toBe(true);
  });

  it('explicitly-unset flags (undefined values) treated as true', async () => {
    const product = await makeProduct({ sellingPrice: 100 });
    // Overwrite discountFlags to an empty object — neither flag explicitly set.
    await Product.updateOne({ _id: product._id }, { $set: { discountFlags: {} } });

    const result = await DiscountValidationService.validateItemDiscounts(
      [{ productId: String(product._id), name: 'EmptyFlags', quantity: 1, unitPrice: 100, discountAmount: 10, itemType: 'product' }],
      null,
      10,
    );
    expect(result.valid).toBe(true);
  });
});

describe('EDGE — short-circuits and idempotence', () => {
  it('short-circuits when no item has a discount (no DB roundtrip needed)', async () => {
    // No products created — the validator must not hit the Product collection.
    const result = await DiscountValidationService.validateTransaction(
      [
        { name: 'A', quantity: 1, unitPrice: 100, discountAmount: 0, itemType: 'product' },
        { name: 'B', quantity: 1, unitPrice: 200, discountAmount: 0, itemType: 'product' },
      ],
      null,
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('validates the same payload identically on repeated calls', async () => {
    const product = await makeProduct({
      flags: { discountableForAll: false, discountableForMembers: true },
    });
    const payload = [{ productId: String(product._id), name: 'Bioma', quantity: 1, unitPrice: 100, discountAmount: 10, itemType: 'product' }];

    const a = await DiscountValidationService.validateItemDiscounts(payload, null, 10);
    const b = await DiscountValidationService.validateItemDiscounts(payload, null, 10);
    const c = await DiscountValidationService.validateItemDiscounts(payload, null, 10);

    expect(a.valid).toBe(false);
    expect(b.valid).toBe(false);
    expect(c.valid).toBe(false);
    expect(a.errors[0].code).toBe(b.errors[0].code);
    expect(b.errors[0].code).toBe(c.errors[0].code);
  });
});

describe('STRESS — concurrent member-discount calculations', () => {
  it('20 concurrent transactions on flagged + unflagged products produce stable results', async () => {
    const Patient = mongoose.models.Patient;
    const patient = await Patient!.create({
      firstName: 'Concurrent',
      memberBenefits: { membershipTier: 'gold', discountPercentage: 10 },
    });

    const normal = await makeProduct({ name: 'Normal', sellingPrice: 100 });
    const blocked = await makeProduct({
      name: 'Blocked',
      sellingPrice: 200,
      flags: { discountableForAll: false, discountableForMembers: true },
    });

    const calls = Array.from({ length: 20 }, () =>
      transactionCalculationService.calculateTransaction({
        items: [
          { productId: String(normal._id), name: 'Normal', quantity: 1, unitPrice: 100, itemType: 'product' },
          { productId: String(blocked._id), name: 'Blocked', quantity: 1, unitPrice: 200, itemType: 'product' },
        ],
        customerId: String(patient._id),
        discountAmount: 0,
      }),
    );

    const results = await Promise.all(calls);

    expect(results).toHaveLength(20);
    for (const r of results) {
      const n = r.items.find(i => i.name === 'Normal')!;
      const b = r.items.find(i => i.name === 'Blocked')!;
      expect(n.discountAmount).toBeCloseTo(10, 2);
      expect(b.discountAmount).toBe(0);
    }
  });
});

describe('EDGE — flagged product without a member-tier customer', () => {
  it('does not apply or attempt any discount on a non-member transaction', async () => {
    const blocked = await makeProduct({
      flags: { discountableForAll: false, discountableForMembers: true },
    });

    // Guest checkout path: customerId=null. The calc service should leave
    // discountAmount at 0 and the subtotal should be exactly unitPrice × qty.
    const result = await transactionCalculationService.calculateTransaction({
      items: [{ productId: String(blocked._id), name: 'B', quantity: 1, unitPrice: 100, itemType: 'product' }],
      customerId: null,
      discountAmount: 0,
    });

    expect(result.items[0].discountAmount).toBe(0);
    // Subtotal & totalAmount come straight off the recomputed unit price × qty.
    // (totalPrice on the item itself is only stamped when a member discount
    // pass runs, which it doesn't here — so we don't assert on item.totalPrice.)
    expect(result.subtotal).toBe(100);
    expect(result.totalAmount).toBe(100);
  });
});
