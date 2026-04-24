// Pure-logic tests for the blend cost fix. Mocks Product.findById so we can
// assert what the validator does with a product that has both costPrice and
// sellingPrice (the common bug case).

import { jest } from '@jest/globals';

// Mock mongoose connection + models before importing the service
jest.unstable_mockModule('@lib/mongoose', () => ({
  connectDB: jest.fn(async () => undefined),
}));

type MockProduct = {
  _id: string;
  name: string;
  costPrice?: number;
  sellingPrice?: number;
  containerCapacity?: number;
  currentStock?: number;
  isActive?: boolean;
  isDeleted?: boolean;
  unitName?: string;
  unitOfMeasurement?: string;
};

const productFixtures: Record<string, MockProduct> = {};

jest.unstable_mockModule('@models/Product', () => ({
  Product: {
    findById: jest.fn(async (id: string) => productFixtures[id] ?? null),
  },
}));

jest.unstable_mockModule('@models/UnitOfMeasurement', () => ({
  UnitOfMeasurement: {
    findById: jest.fn(async () => ({ _id: 'uom-ml', name: 'ml' })),
    findOne: jest.fn(async () => ({ _id: 'uom-ml', name: 'ml' })),
  },
}));

// Dynamic import so mocks apply
const { BlendIngredientValidator } = await import('@services/blend/BlendIngredientValidator');
const { CustomBlendService } = await import('@services/CustomBlendService');

describe('Blend cost fix — costPerUnit must be product.costPrice', () => {
  let validator: InstanceType<typeof BlendIngredientValidator>;
  let customBlend: InstanceType<typeof CustomBlendService>;

  beforeEach(() => {
    validator = new BlendIngredientValidator();
    customBlend = new CustomBlendService();
    Object.keys(productFixtures).forEach(k => delete productFixtures[k]);
  });

  it('Gotu kola 80ml: $80/bottle ÷ 1000ml = $0.08/ml × 80 = $6.40 (client-reported scenario)', async () => {
    productFixtures['gotukola'] = {
      _id: 'gotukola',
      name: 'RL Gotu kola 0976L',
      costPrice: 80,       // per 1000 ml bottle (real production data)
      sellingPrice: 220,   // per bottle
      containerCapacity: 1000,
      currentStock: 1000,
      isActive: true,
      unitName: 'ml',
      unitOfMeasurement: 'uom-ml',
    };

    const { totalCost, breakdown } = await customBlend.calculateBlendCost([
      {
        productId: 'gotukola',
        name: 'RL Gotu kola 0976L',
        quantity: 80,
        unitOfMeasurementId: 'uom-ml',
        unitName: 'ml',
        costPerUnit: 0,
        availableStock: 1000,
      },
    ]);

    expect(breakdown[0].unitCost).toBeCloseTo(0.08, 4);
    expect(totalCost).toBe(6.40);
    // Regression guards: must not use raw costPrice (80 → $6400) or sellingPrice-based ($17600 or $32)
    expect(totalCost).not.toBe(6400);
    expect(totalCost).not.toBe(17600);
    expect(totalCost).not.toBe(32);
  });

  it('MH Golden Seal: $400/500ml → $0.80/ml × 50ml = $40.00', async () => {
    productFixtures['gseal'] = {
      _id: 'gseal',
      name: 'MH Golden Seal 1:3',
      costPrice: 400,
      sellingPrice: 880,
      containerCapacity: 500,
      currentStock: 1000,
      isActive: true,
      unitName: 'ml',
      unitOfMeasurement: 'uom-ml',
    };

    const { totalCost, breakdown } = await customBlend.calculateBlendCost([
      {
        productId: 'gseal',
        name: 'MH Golden Seal 1:3',
        quantity: 50,
        unitOfMeasurementId: 'uom-ml',
        unitName: 'ml',
        costPerUnit: 0,
        availableStock: 1000,
      },
    ]);

    expect(breakdown[0].unitCost).toBeCloseTo(0.80, 4);
    expect(totalCost).toBe(40.00);
  });

  it('enrichIngredientData corrects legacy ingredient.costPerUnit to per-unit cost from container', async () => {
    productFixtures['ashwagandha'] = {
      _id: 'ashwagandha',
      name: 'Ashwagandha',
      costPrice: 120,       // per 1000 ml bottle
      sellingPrice: 600,
      containerCapacity: 1000,
      currentStock: 500,
      isActive: true,
      unitName: 'ml',
      unitOfMeasurement: 'uom-ml',
    };

    // Template used to store per-ml sellingPrice (0.60)
    const legacyIngredient = {
      productId: 'ashwagandha',
      name: 'Ashwagandha',
      quantity: 50,
      unitOfMeasurementId: 'uom-ml',
      unitName: 'ml',
      costPerUnit: 0.60,
    };

    const [enriched] = await validator.validateAndEnrichIngredients([legacyIngredient]);
    expect(enriched.costPerUnit).toBeCloseTo(0.12, 4); // 120 / 1000
    expect(enriched.costPerUnit).not.toBe(0.60);
    expect(enriched.costPerUnit).not.toBe(120); // would be raw costPrice (container-level)
  });

  it('non-liquid product with containerCapacity=1 (or missing) uses costPrice as-is', async () => {
    productFixtures['pill'] = {
      _id: 'pill',
      name: 'Vitamin tablet',
      costPrice: 2.50, // per bottle which holds 1 sellable unit
      containerCapacity: 1,
      currentStock: 100,
      isActive: true,
      unitName: 'unit',
      unitOfMeasurement: 'uom-ml',
    };

    const [enriched] = await validator.validateAndEnrichIngredients([{
      productId: 'pill',
      name: 'Vitamin tablet',
      quantity: 3,
      unitOfMeasurementId: 'uom-ml',
      unitName: 'unit',
      costPerUnit: 0,
    }]);
    expect(enriched.costPerUnit).toBe(2.50);
  });

  it('does NOT fall back to sellingPrice when product has no costPrice', async () => {
    productFixtures['mystery'] = {
      _id: 'mystery',
      name: 'Mystery Herb',
      sellingPrice: 500,
      containerCapacity: 1000,
      currentStock: 100,
      isActive: true,
      unitName: 'ml',
      unitOfMeasurement: 'uom-ml',
    };

    const [enriched] = await validator.validateAndEnrichIngredients([{
      productId: 'mystery',
      name: 'Mystery Herb',
      quantity: 10,
      unitOfMeasurementId: 'uom-ml',
      unitName: 'ml',
      costPerUnit: 0,
    }]);
    expect(enriched.costPerUnit).toBe(0);
    expect(enriched.costPerUnit).not.toBe(0.50); // per-ml sellingPrice
  });

  it('handles costPrice = 0 as a legitimate zero, not a missing value', async () => {
    productFixtures['freebie'] = {
      _id: 'freebie',
      name: 'Free Sample',
      costPrice: 0,
      sellingPrice: 1000,
      containerCapacity: 1000,
      currentStock: 100,
      isActive: true,
      unitName: 'ml',
      unitOfMeasurement: 'uom-ml',
    };

    const [enriched] = await validator.validateAndEnrichIngredients([{
      productId: 'freebie',
      name: 'Free Sample',
      quantity: 10,
      unitOfMeasurementId: 'uom-ml',
      unitName: 'ml',
      costPerUnit: 1.00,
    }]);
    expect(enriched.costPerUnit).toBe(0);
  });

  it('multi-ingredient blend sums per-unit costs correctly across container sizes', async () => {
    productFixtures['a'] = { _id: 'a', name: 'A', costPrice: 100, sellingPrice: 500, containerCapacity: 1000, currentStock: 1000, isActive: true, unitName: 'ml', unitOfMeasurement: 'uom-ml' };
    productFixtures['b'] = { _id: 'b', name: 'B', costPrice: 100, sellingPrice: 500, containerCapacity: 500, currentStock: 1000, isActive: true, unitName: 'ml', unitOfMeasurement: 'uom-ml' };
    productFixtures['c'] = { _id: 'c', name: 'C', costPrice: 50, sellingPrice: 300, containerCapacity: 1000, currentStock: 1000, isActive: true, unitName: 'ml', unitOfMeasurement: 'uom-ml' };

    // per-unit: A=0.10, B=0.20, C=0.05
    const { totalCost } = await customBlend.calculateBlendCost([
      { productId: 'a', name: 'A', quantity: 10, unitOfMeasurementId: 'uom-ml', unitName: 'ml', costPerUnit: 0, availableStock: 1000 },
      { productId: 'b', name: 'B', quantity: 20, unitOfMeasurementId: 'uom-ml', unitName: 'ml', costPerUnit: 0, availableStock: 1000 },
      { productId: 'c', name: 'C', quantity: 40, unitOfMeasurementId: 'uom-ml', unitName: 'ml', costPerUnit: 0, availableStock: 1000 },
    ]);

    // 10*0.10 + 20*0.20 + 40*0.05 = 1 + 4 + 2 = 7
    expect(totalCost).toBe(7.00);
  });

  it('containerCapacity=0 or negative falls back to 1 (defensive, not per-0)', async () => {
    productFixtures['bad'] = {
      _id: 'bad',
      name: 'Bad data',
      costPrice: 10,
      containerCapacity: 0,
      currentStock: 100,
      isActive: true,
      unitName: 'ml',
      unitOfMeasurement: 'uom-ml',
    };
    const [enriched] = await validator.validateAndEnrichIngredients([{
      productId: 'bad', name: 'Bad data', quantity: 5,
      unitOfMeasurementId: 'uom-ml', unitName: 'ml', costPerUnit: 0,
    }]);
    // Treats invalid capacity as 1, so costPerUnit = 10. Better than divide-by-zero.
    expect(enriched.costPerUnit).toBe(10);
    expect(Number.isFinite(enriched.costPerUnit)).toBe(true);
  });

  // Integration: full flow the user actually cares about — product price changes
  // should flow through to template cost on next enrichment.
  it('integration: product costPrice change re-stamps ingredient costPerUnit on next enrichment', async () => {
    productFixtures['echinacea'] = {
      _id: 'echinacea',
      name: 'Echinacea',
      costPrice: 100,  // $100 per 1000 ml bottle → $0.10/ml
      sellingPrice: 300,
      containerCapacity: 1000,
      currentStock: 500,
      isActive: true,
      unitName: 'ml',
      unitOfMeasurement: 'uom-ml',
    };

    // Initial enrichment: costPerUnit derives from current product
    const [firstPass] = await validator.validateAndEnrichIngredients([{
      productId: 'echinacea',
      name: 'Echinacea',
      quantity: 50,
      unitOfMeasurementId: 'uom-ml',
      unitName: 'ml',
      costPerUnit: 0,
    }]);
    expect(firstPass.costPerUnit).toBeCloseTo(0.10, 4);
    // 50 ml × $0.10/ml = $5.00
    const firstTotal = firstPass.quantity * (firstPass.costPerUnit ?? 0);
    expect(firstTotal).toBeCloseTo(5.00, 4);

    // Wholesale cost goes up — same container, costPrice now $150
    productFixtures['echinacea'].costPrice = 150;

    // Re-enrich with the PREVIOUS value as input (simulates loading the template then saving)
    const [secondPass] = await validator.validateAndEnrichIngredients([{
      productId: 'echinacea',
      name: 'Echinacea',
      quantity: 50,
      unitOfMeasurementId: 'uom-ml',
      unitName: 'ml',
      costPerUnit: firstPass.costPerUnit ?? 0,
    }]);
    expect(secondPass.costPerUnit).toBeCloseTo(0.15, 4);
    const secondTotal = secondPass.quantity * (secondPass.costPerUnit ?? 0);
    expect(secondTotal).toBeCloseTo(7.50, 4);
  });

  it('integration: adding a container-capacity change also flows through', async () => {
    productFixtures['repack'] = {
      _id: 'repack',
      name: 'Repackaged Herb',
      costPrice: 100,
      containerCapacity: 1000,  // was 1000 ml
      currentStock: 500,
      isActive: true,
      unitName: 'ml',
      unitOfMeasurement: 'uom-ml',
    };

    const [initial] = await validator.validateAndEnrichIngredients([{
      productId: 'repack', name: 'Repackaged Herb', quantity: 10,
      unitOfMeasurementId: 'uom-ml', unitName: 'ml', costPerUnit: 0,
    }]);
    expect(initial.costPerUnit).toBeCloseTo(0.10, 4);

    // Supplier switches to a smaller container at the same cost — per-ml doubles
    productFixtures['repack'].containerCapacity = 500;

    const [after] = await validator.validateAndEnrichIngredients([{
      productId: 'repack', name: 'Repackaged Herb', quantity: 10,
      unitOfMeasurementId: 'uom-ml', unitName: 'ml', costPerUnit: initial.costPerUnit ?? 0,
    }]);
    expect(after.costPerUnit).toBeCloseTo(0.20, 4);
  });
});

// Direct pricing utility tests — pin the single source of truth.
describe('pricingUtils — shared pricing utility', () => {
  // Import synchronously; utility has no mongoose/db dependency
  // (imports via the package under test are already mocked above)

  it('perUnitCost: Gotu kola scenario', async () => {
    const { perUnitCost } = await import('../../../utils/pricingUtils');
    expect(perUnitCost({ costPrice: 80, containerCapacity: 1000 })).toBe(0.08);
  });

  it('perUnitCost: returns undefined when costPrice missing', async () => {
    const { perUnitCost } = await import('../../../utils/pricingUtils');
    expect(perUnitCost({ sellingPrice: 100, containerCapacity: 500 })).toBeUndefined();
  });

  it('perUnitCost: costPrice=0 returns 0 (legitimate zero, not missing)', async () => {
    const { perUnitCost } = await import('../../../utils/pricingUtils');
    expect(perUnitCost({ costPrice: 0, containerCapacity: 100 })).toBe(0);
  });

  it('perUnitCost: missing/zero/negative containerCapacity defaults to 1', async () => {
    const { perUnitCost } = await import('../../../utils/pricingUtils');
    expect(perUnitCost({ costPrice: 10 })).toBe(10);
    expect(perUnitCost({ costPrice: 10, containerCapacity: 0 })).toBe(10);
    expect(perUnitCost({ costPrice: 10, containerCapacity: -5 })).toBe(10);
  });

  it('perUnitSellingPrice: mirrors perUnitCost semantics', async () => {
    const { perUnitSellingPrice } = await import('../../../utils/pricingUtils');
    expect(perUnitSellingPrice({ sellingPrice: 240, containerCapacity: 1000 })).toBe(0.24);
    expect(perUnitSellingPrice({ costPrice: 80 })).toBeUndefined();
  });

  it('perUnitCostOr: fallback when costPrice missing', async () => {
    const { perUnitCostOr } = await import('../../../utils/pricingUtils');
    expect(perUnitCostOr({ sellingPrice: 100, containerCapacity: 1000 }, 0.05)).toBe(0.05);
    expect(perUnitCostOr({ costPrice: 100, containerCapacity: 1000 }, 0.05)).toBe(0.10);
  });
});
