/**
 * Regression: discountFlags.discountableForAll must block discounts on flagged
 * products at every enforcement site. The flag was schema-defined but dead-read
 * before 2026-04-28 — meaning clinic admins could mark a product (e.g. BIOMA
 * Gut Test) as non-discountable but member discounts would still auto-apply.
 *
 * Also pins the parallel behavior of discountableForMembers (already enforced)
 * to guarantee no regression from the rewrite.
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

beforeAll(async () => {
  await setupTestDB();
}, 60_000);

afterAll(async () => {
  await teardownTestDB();
}, 30_000);

beforeEach(async () => {
  await Product.deleteMany({});
});

async function makeProduct(opts: {
  name?: string;
  sellingPrice?: number;
  flags?: { discountableForAll?: boolean; discountableForMembers?: boolean };
} = {}) {
  const unit = await createTestUnit({ name: 'cap' });
  const product = await createTestProduct({
    name: opts.name || 'Test Product',
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

describe('DiscountValidationService.validateItemDiscounts — discountableForAll gate', () => {
  it('blocks a manual line discount when discountableForAll=false', async () => {
    const product = await makeProduct({
      name: 'Bioma Gut Test',
      sellingPrice: 390,
      flags: { discountableForAll: false, discountableForMembers: true },
    });

    const result = await DiscountValidationService.validateItemDiscounts(
      [{
        productId: String(product._id),
        name: 'Bioma Gut Test',
        quantity: 1,
        unitPrice: 390,
        discountAmount: 39,
        itemType: 'product',
      }],
      null,
      10, // patient tier 10%
    );

    expect(result.valid).toBe(false);
    expect(result.errors.map(e => e.code)).toContain('PRODUCT_NOT_DISCOUNTABLE');
  });

  it('still blocks when only discountableForMembers=false (legacy semantic preserved)', async () => {
    const product = await makeProduct({
      flags: { discountableForAll: true, discountableForMembers: false },
    });

    const result = await DiscountValidationService.validateItemDiscounts(
      [{
        productId: String(product._id),
        name: 'Test Product',
        quantity: 1,
        unitPrice: 100,
        discountAmount: 10,
        itemType: 'product',
      }],
      null,
      10,
    );

    expect(result.valid).toBe(false);
    expect(result.errors.map(e => e.code)).toContain('PRODUCT_NOT_DISCOUNTABLE');
  });

  it('allows a discount when both flags are true (or default)', async () => {
    const product = await makeProduct(); // schema defaults

    const result = await DiscountValidationService.validateItemDiscounts(
      [{
        productId: String(product._id),
        name: 'Test Product',
        quantity: 1,
        unitPrice: 100,
        discountAmount: 10,
        itemType: 'product',
      }],
      null,
      10,
    );

    expect(result.valid).toBe(true);
  });
});

describe('DiscountValidationService.validateBillDiscount — discountableForAll gate', () => {
  it('rejects bill-level discount when one item has discountableForAll=false', async () => {
    const ok = await makeProduct({ name: 'Vitamin C' });
    const blocked = await makeProduct({
      name: 'Bioma Gut Test',
      flags: { discountableForAll: false, discountableForMembers: true },
    });

    const result = await DiscountValidationService.validateBillDiscount(20, [
      { productId: String(ok._id), name: 'Vitamin C', itemType: 'product', unitPrice: 100, quantity: 1 },
      { productId: String(blocked._id), name: 'Bioma Gut Test', itemType: 'product', unitPrice: 390, quantity: 1 },
    ]);

    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/Bioma Gut Test/);
  });
});

describe('TransactionCalculationService — auto-applied member discount honors discountableForAll', () => {
  it('does not auto-apply a member discount to a product with discountableForAll=false', async () => {
    const Patient = mongoose.models.Patient || mongoose.model(
      'Patient',
      new mongoose.Schema(
        { firstName: String, lastName: String, memberBenefits: { membershipTier: String, discountPercentage: Number } },
        { strict: false },
      ),
    );

    const patient = await Patient.create({
      firstName: 'Test',
      lastName: 'Customer',
      memberBenefits: { membershipTier: 'silver', discountPercentage: 10 },
    });

    const blocked = await makeProduct({
      name: 'Bioma Gut Test',
      sellingPrice: 390,
      flags: { discountableForAll: false, discountableForMembers: true },
    });

    const result = await transactionCalculationService.calculateTransaction({
      items: [{
        productId: String(blocked._id),
        name: 'Bioma Gut Test',
        quantity: 1,
        unitPrice: 390,
        itemType: 'product',
      }],
      customerId: String(patient._id),
      discountAmount: 0,
    });

    const blockedItem = result.items.find(i => i.name === 'Bioma Gut Test');
    expect(blockedItem).toBeDefined();
    expect(blockedItem!.discountAmount).toBe(0);
    expect(blockedItem!.totalPrice).toBe(390);
  });
});
