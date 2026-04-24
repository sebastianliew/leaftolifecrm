/**
 * Blend infrastructure stress test.
 *
 * Exercises the three blend code paths under concurrent load to verify:
 *  - Inventory conservation (sum of deductions == stock delta)
 *  - Idempotency (duplicate processing is suppressed)
 *  - Cost math under container-capacity scaling
 *  - Current wiring: whether custom_blend items deduct ingredient stock
 *
 * This test is intentionally self-contained — it does not spin up Express,
 * it calls the services directly against an in-memory MongoDB.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import mongoose from 'mongoose';
import {
  createTestProduct,
  createTestUnit,
  createTestBlendTemplate,
  createTestTransactionItem,
  createTestTransaction,
  Product,
  InventoryMovement,
} from '../setup/test-fixtures.js';
import { clearCollections } from '../setup/mongodb-memory-server.js';

import { TransactionInventoryService } from '../../services/TransactionInventoryService.js';
import { CustomBlendService } from '../../services/CustomBlendService.js';
import { BlendIngredientValidator } from '../../services/blend/BlendIngredientValidator.js';
import { CustomBlendHistory } from '../../models/CustomBlendHistory.js';
import { BlendTemplate } from '../../models/BlendTemplate.js';

const CONCURRENCY = 30;
const BLEND_QTY_PER_SALE = 2;

type SeededIngredient = {
  productId: mongoose.Types.ObjectId;
  unitId: mongoose.Types.ObjectId;
  name: string;
  perBlendQty: number;
  costPrice: number;
  containerCapacity: number;
  initialStock: number;
};

async function seedIngredients(): Promise<SeededIngredient[]> {
  const unit = await createTestUnit({ name: 'ml', abbreviation: 'ml', type: 'volume' });
  const unitId = unit._id as mongoose.Types.ObjectId;

  const recipes = [
    { name: 'Gotu Kola', perBlendQty: 10, costPrice: 80, containerCapacity: 1000, initialStock: 5000 },
    { name: 'Ashwagandha',  perBlendQty:  5, costPrice: 120, containerCapacity: 1000, initialStock: 5000 },
    { name: 'Golden Seal',  perBlendQty:  2, costPrice: 400, containerCapacity: 500,  initialStock: 5000 },
  ];

  const seeded: SeededIngredient[] = [];
  for (const r of recipes) {
    const product = await createTestProduct({
      name: r.name,
      unitOfMeasurement: unitId,
      currentStock: r.initialStock,
      availableStock: r.initialStock,
      quantity: r.initialStock,
      costPrice: r.costPrice,
      sellingPrice: r.costPrice * 2.5,
      containerCapacity: r.containerCapacity,
    });
    seeded.push({
      productId: product._id as mongoose.Types.ObjectId,
      unitId,
      name: r.name,
      perBlendQty: r.perBlendQty,
      costPrice: r.costPrice,
      containerCapacity: r.containerCapacity,
      initialStock: r.initialStock,
    });
  }
  return seeded;
}

describe('Blend stress — fixed blend inventory under concurrent sales', () => {
  let tis: TransactionInventoryService;

  beforeAll(() => {
    tis = new TransactionInventoryService();
  });

  beforeEach(async () => {
    await clearCollections();
  });

  it(`deducts ingredients correctly across ${CONCURRENCY} concurrent fixed-blend sales`, async () => {
    const ingredients = await seedIngredients();
    const unitId = ingredients[0].unitId;

    const template = await createTestBlendTemplate(
      ingredients.map((ing) => ({
        productId: ing.productId,
        name: ing.name,
        quantity: ing.perBlendQty,
        unitOfMeasurementId: ing.unitId,
        unitName: 'ml',
        costPerUnit: ing.costPrice / ing.containerCapacity,
      })),
      { unitOfMeasurementId: unitId, unitName: 'ml', batchSize: 1 }
    );

    // Build N independent transactions that each sell one fixed-blend item
    const transactions = Array.from({ length: CONCURRENCY }, (_, i) => {
      const item = createTestTransactionItem({
        productId: String(template._id),
        name: template.name,
        itemType: 'fixed_blend',
        quantity: BLEND_QTY_PER_SALE,
        convertedQuantity: BLEND_QTY_PER_SALE,
        unitPrice: 50,
        totalPrice: 50 * BLEND_QTY_PER_SALE,
      });
      return createTestTransaction([item], { transactionNumber: `STRESS-FB-${i}` });
    });

    // Fire all of them concurrently
    const results = await Promise.all(
      transactions.map((tx) =>
        tis.processTransactionInventory(tx as any, 'stress-user'),
      ),
    );

    // Every run should succeed
    const errors = results.flatMap((r) => r.errors);
    expect(errors).toEqual([]);

    // Movement count: 1 per ingredient × CONCURRENCY transactions
    const movements = await InventoryMovement.find({
      reference: { $regex: /^STRESS-FB-/ },
    });
    expect(movements).toHaveLength(ingredients.length * CONCURRENCY);

    // All movements should be fixed_blend type
    expect(movements.every((m) => m.movementType === 'fixed_blend')).toBe(true);

    // Per-product: sum of deducted quantities == stock delta on product
    for (const ing of ingredients) {
      const expected = ing.perBlendQty * BLEND_QTY_PER_SALE * CONCURRENCY;
      const sumDeducted = movements
        .filter((m) => String(m.productId) === String(ing.productId))
        .reduce((s, m) => s + m.convertedQuantity, 0);
      expect(sumDeducted).toBe(expected);

      const product = await Product.findById(ing.productId);
      expect(product!.currentStock).toBe(ing.initialStock - expected);
      expect(product!.currentStock).toBeGreaterThanOrEqual(0);
    }
  });

  it('is idempotent: replaying the same transaction does not double-deduct', async () => {
    const ingredients = await seedIngredients();
    const unitId = ingredients[0].unitId;

    const template = await createTestBlendTemplate(
      ingredients.map((ing) => ({
        productId: ing.productId,
        name: ing.name,
        quantity: ing.perBlendQty,
        unitOfMeasurementId: ing.unitId,
        unitName: 'ml',
        costPerUnit: ing.costPrice / ing.containerCapacity,
      })),
      { unitOfMeasurementId: unitId, unitName: 'ml' }
    );

    const item = createTestTransactionItem({
      productId: String(template._id),
      name: template.name,
      itemType: 'fixed_blend',
      quantity: 1,
      convertedQuantity: 1,
    });
    const tx = createTestTransaction([item], { transactionNumber: 'IDEMPOTENCY-CHECK' });

    const first = await tis.processTransactionInventory(tx as any, 'stress-user');
    const second = await tis.processTransactionInventory(tx as any, 'stress-user');

    expect(first.errors).toEqual([]);
    expect(first.movements).toHaveLength(ingredients.length);

    // Second run should detect existing movements and short-circuit
    expect(second.warnings.some((w) => w.includes('already exist'))).toBe(true);

    const movementCount = await InventoryMovement.countDocuments({ reference: 'IDEMPOTENCY-CHECK' });
    expect(movementCount).toBe(ingredients.length);

    for (const ing of ingredients) {
      const product = await Product.findById(ing.productId);
      // Deducted exactly once
      expect(ing.initialStock - product!.currentStock).toBe(ing.perBlendQty);
    }
  });
});

describe('Blend stress — pool + usage-counter invariants under concurrency', () => {
  let tis: TransactionInventoryService;

  beforeAll(() => {
    tis = new TransactionInventoryService();
  });

  beforeEach(async () => {
    await clearCollections();
  });

  it('fixed-blend sales decrement looseStock alongside currentStock (pool=loose)', async () => {
    // Before MAJOR-5 fix this used pool='any' and looseStock would stay stale.
    const ingredients = await seedIngredients();
    const unitId = ingredients[0].unitId;

    // Seed 500 ml of loose stock per product (a partially-used bottle).
    for (const ing of ingredients) {
      await Product.updateOne(
        { _id: ing.productId },
        { $set: { looseStock: 500 } },
      );
    }

    const template = await createTestBlendTemplate(
      ingredients.map((ing) => ({
        productId: ing.productId,
        name: ing.name,
        quantity: ing.perBlendQty,
        unitOfMeasurementId: ing.unitId,
        unitName: 'ml',
        costPerUnit: ing.costPrice / ing.containerCapacity,
      })),
      { unitOfMeasurementId: unitId, unitName: 'ml' }
    );

    const item = createTestTransactionItem({
      productId: String(template._id),
      name: template.name,
      itemType: 'fixed_blend',
      quantity: 3, // 3 batches of the template
      convertedQuantity: 3,
    });
    const tx = createTestTransaction([item], { transactionNumber: 'POOL-LOOSE-CHECK' });
    const result = await tis.processTransactionInventory(tx as any, 'stress-user');
    expect(result.errors).toEqual([]);

    for (const ing of ingredients) {
      const product = await Product.findById(ing.productId);
      const deducted = ing.perBlendQty * 3;
      expect(product!.currentStock).toBe(ing.initialStock - deducted);
      // looseStock should have gone down by the same amount (started at 500)
      expect(product!.looseStock).toBe(500 - deducted);
    }
  });

  it(`atomic usageCount survives ${CONCURRENCY} concurrent fixed-blend sales of the same template`, async () => {
    // Before MAJOR-4 fix, read-modify-write would lose counter updates.
    const ingredients = await seedIngredients();
    const unitId = ingredients[0].unitId;

    const template = await createTestBlendTemplate(
      ingredients.map((ing) => ({
        productId: ing.productId,
        name: ing.name,
        quantity: ing.perBlendQty,
        unitOfMeasurementId: ing.unitId,
        unitName: 'ml',
        costPerUnit: ing.costPrice / ing.containerCapacity,
      })),
      { unitOfMeasurementId: unitId, unitName: 'ml', usageCount: 0 }
    );

    const transactions = Array.from({ length: CONCURRENCY }, (_, i) => {
      const item = createTestTransactionItem({
        productId: String(template._id),
        name: template.name,
        itemType: 'fixed_blend',
        quantity: 1,
        convertedQuantity: 1,
      });
      return createTestTransaction([item], { transactionNumber: `USAGE-COUNT-${i}` });
    });

    const results = await Promise.all(
      transactions.map((tx) => tis.processTransactionInventory(tx as any, 'stress-user')),
    );
    const errors = results.flatMap((r) => r.errors);
    expect(errors).toEqual([]);

    // With atomic $inc, usageCount must be exactly CONCURRENCY.
    // With the old read-modify-write, this was typically well under CONCURRENCY.
    const refreshed = await BlendTemplate.findById(template._id);
    expect(refreshed!.usageCount).toBe(CONCURRENCY);
    expect(refreshed!.lastUsed).toBeInstanceOf(Date);
  });

  it('rejects a second active template with the same name (partial unique index)', async () => {
    const ingredients = await seedIngredients();
    const unitId = ingredients[0].unitId;

    // Ensure the index is actually built before the test runs.
    await BlendTemplate.syncIndexes();

    const ingredientSpec = ingredients.map((ing) => ({
      productId: ing.productId,
      name: ing.name,
      quantity: ing.perBlendQty,
      unitOfMeasurementId: ing.unitId,
      unitName: 'ml',
      costPerUnit: ing.costPrice / ing.containerCapacity,
    }));

    await createTestBlendTemplate(ingredientSpec, {
      name: 'Evening Tonic',
      unitOfMeasurementId: unitId,
    });

    await expect(
      createTestBlendTemplate(ingredientSpec, {
        name: 'Evening Tonic',
        unitOfMeasurementId: unitId,
      }),
    ).rejects.toThrow(/duplicate key|E11000/i);
  });

  it('allows reusing a name after the original is soft-deleted', async () => {
    const ingredients = await seedIngredients();
    const unitId = ingredients[0].unitId;
    await BlendTemplate.syncIndexes();

    const ingredientSpec = ingredients.map((ing) => ({
      productId: ing.productId,
      name: ing.name,
      quantity: ing.perBlendQty,
      unitOfMeasurementId: ing.unitId,
      unitName: 'ml',
      costPerUnit: ing.costPrice / ing.containerCapacity,
    }));

    const first = await createTestBlendTemplate(ingredientSpec, {
      name: 'Morning Tonic',
      unitOfMeasurementId: unitId,
    });

    // Soft delete the first one
    await BlendTemplate.updateOne(
      { _id: first._id },
      { $set: { isDeleted: true, deletedAt: new Date() } },
    );

    // Creating a new active one with the same name should now succeed
    const second = await createTestBlendTemplate(ingredientSpec, {
      name: 'Morning Tonic',
      unitOfMeasurementId: unitId,
    });
    expect(String(second._id)).not.toBe(String(first._id));
  });
});

describe('Blend stress — custom blend dispatch wiring', () => {
  beforeEach(async () => {
    await clearCollections();
  });

  it('custom_blend items in a transaction deduct ingredient stock and write a CustomBlendHistory record', async () => {
    // Guards the fix for CRITICAL-1 (wiring) and CRITICAL-3 (history writer).
    // Before the fix, TIS explicitly skipped custom_blend items — this test
    // previously asserted "0 movements, stock unchanged" as a regression guard.
    // The positive assertion here will fail if the wiring regresses.
    const ingredients = await seedIngredients();
    const tis = new TransactionInventoryService();

    const perBlendCost = ingredients.reduce(
      (sum, ing) => sum + ing.perBlendQty * (ing.costPrice / ing.containerCapacity),
      0,
    );

    const item = createTestTransactionItem({
      productId: new mongoose.Types.ObjectId().toString(),
      name: 'Custom Tincture Blend',
      itemType: 'custom_blend',
      quantity: 1,
      convertedQuantity: 1,
      unitPrice: 90,
      totalPrice: 90,
    });
    // Simulate the customBlendData payload the frontend sends
    (item as any).customBlendData = {
      name: 'Custom Tincture Blend',
      ingredients: ingredients.map((ing) => ({
        productId: String(ing.productId),
        name: ing.name,
        quantity: ing.perBlendQty,
        unitOfMeasurementId: String(ing.unitId),
        unitName: 'ml',
        costPerUnit: ing.costPrice / ing.containerCapacity,
      })),
      totalIngredientCost: Math.round(perBlendCost * 100) / 100,
      mixedBy: 'stress-user',
      mixedAt: new Date(),
    };

    const tx = createTestTransaction([item], {
      transactionNumber: 'CUSTOM-BLEND-WIRING',
      customerName: 'Alice Tester',
    });
    // Production always passes a saved doc with an _id; add one for the test.
    (tx as any)._id = new mongoose.Types.ObjectId();
    const result = await tis.processTransactionInventory(tx as any, 'stress-user');

    expect(result.errors).toEqual([]);
    // One movement per ingredient
    expect(result.movements).toHaveLength(ingredients.length);
    expect(result.movements.every((m: any) => m.movementType === 'custom_blend')).toBe(true);

    // Stock decremented by exactly perBlendQty per ingredient
    for (const ing of ingredients) {
      const product = await Product.findById(ing.productId);
      expect(ing.initialStock - product!.currentStock).toBe(ing.perBlendQty);
    }

    // Movements exist under the transactionNumber reference
    const movementCount = await InventoryMovement.countDocuments({ reference: 'CUSTOM-BLEND-WIRING' });
    expect(movementCount).toBe(ingredients.length);

    // CustomBlendHistory record written with the right data
    const histories = await CustomBlendHistory.find({ transactionNumber: 'CUSTOM-BLEND-WIRING' });
    expect(histories).toHaveLength(1);
    const [history] = histories;
    expect(history.blendName).toBe('Custom Tincture Blend');
    expect(history.customerName).toBe('Alice Tester');
    expect(history.ingredients).toHaveLength(ingredients.length);
    expect(history.sellingPrice).toBe(90);
    expect(history.totalIngredientCost).toBeCloseTo(perBlendCost, 2);
    expect(history.signatureHash).toBeTruthy(); // auto-populated by pre-save
    expect(history.mixedBy).toBe('stress-user');
  });

  it('CustomBlendService.deductCustomBlendIngredients does work when called directly', async () => {
    // Shows the service itself is functional — it is just never invoked by the controller.
    const ingredients = await seedIngredients();
    const cbs = new CustomBlendService();

    const blendIngredients = ingredients.map((ing) => ({
      productId: String(ing.productId),
      name: ing.name,
      quantity: ing.perBlendQty,
      unitOfMeasurementId: String(ing.unitId),
      unitName: 'ml',
      costPerUnit: ing.costPrice / ing.containerCapacity,
      availableStock: ing.initialStock,
    }));

    const movements = await cbs.deductCustomBlendIngredients(
      blendIngredients as any,
      new mongoose.Types.ObjectId().toString(),
      'STRESS-CUSTOM-DIRECT',
      'stress-user',
    );

    expect(movements).toHaveLength(ingredients.length);
    expect(movements.every((m: any) => m.movementType === 'custom_blend')).toBe(true);

    for (const ing of ingredients) {
      const product = await Product.findById(ing.productId);
      expect(ing.initialStock - product!.currentStock).toBe(ing.perBlendQty);
    }
  });
});

describe('Blend stress — cost math under container-capacity scaling', () => {
  beforeEach(async () => {
    await clearCollections();
  });

  it('calculateBlendCost sums per-unit costs correctly for a 20-ingredient blend', async () => {
    const cbs = new CustomBlendService();
    const unit = await createTestUnit({ name: 'ml' });
    const unitId = unit._id as mongoose.Types.ObjectId;

    // 20 ingredients with varied container capacities and prices
    const specs = Array.from({ length: 20 }, (_, i) => ({
      name: `Herb-${i}`,
      costPrice: 50 + i * 10,            // 50, 60, 70, ...
      containerCapacity: 500 + (i % 3) * 250, // 500, 750, 1000
      quantity: 5 + (i % 4),              // 5, 6, 7, 8
    }));

    const ingredients = [];
    let expectedTotal = 0;

    for (const s of specs) {
      const product = await createTestProduct({
        name: s.name,
        unitOfMeasurement: unitId,
        costPrice: s.costPrice,
        containerCapacity: s.containerCapacity,
        currentStock: 10000,
        availableStock: 10000,
      });
      const perUnit = s.costPrice / s.containerCapacity;
      expectedTotal += s.quantity * perUnit;
      ingredients.push({
        productId: String(product._id),
        name: s.name,
        quantity: s.quantity,
        unitOfMeasurementId: String(unitId),
        unitName: 'ml',
        costPerUnit: perUnit,
        availableStock: 10000,
      });
    }

    const { totalCost, breakdown } = await cbs.calculateBlendCost(ingredients as any);
    expect(breakdown).toHaveLength(20);
    expect(totalCost).toBeCloseTo(Math.round(expectedTotal * 100) / 100, 2);
    // Sanity: finite, non-negative
    expect(Number.isFinite(totalCost)).toBe(true);
    expect(totalCost).toBeGreaterThan(0);
  });

  it('validateIngredientAvailability flags insufficient stock correctly across many ingredients', async () => {
    const validator = new BlendIngredientValidator();
    const unit = await createTestUnit({ name: 'ml' });
    const unitId = unit._id as mongoose.Types.ObjectId;

    // 5 products: 3 with plenty, 2 with too-little
    const abundant = await Promise.all(
      [0, 1, 2].map((i) =>
        createTestProduct({
          name: `Abundant-${i}`,
          unitOfMeasurement: unitId,
          costPrice: 100,
          containerCapacity: 1000,
          currentStock: 5000,
          availableStock: 5000,
        }),
      ),
    );
    const scarce = await Promise.all(
      [0, 1].map((i) =>
        createTestProduct({
          name: `Scarce-${i}`,
          unitOfMeasurement: unitId,
          costPrice: 100,
          containerCapacity: 1000,
          currentStock: 3,
          availableStock: 3,
        }),
      ),
    );

    const ingredients = [...abundant, ...scarce].map((p) => ({
      productId: String(p._id),
      name: p.name,
      quantity: 10, // 10 ml per batch
      unitOfMeasurementId: String(unitId),
      unitName: 'ml',
      costPerUnit: 0.1,
      availableStock: p.currentStock,
    }));

    const result = await validator.validateIngredientAvailability(ingredients as any, 1);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(2);
    expect(result.errors.every((e) => e.error === 'Insufficient stock')).toBe(true);
    // The abundant ones at exactly required*500x will NOT trigger the "low stock" warning
    // (warning fires when availableQuantity < requiredQuantity * 2)
    expect(result.warnings).toHaveLength(0);
  });
});
