import { getUomBehavior, validateLooseQuantity } from '../../../utils/uomUtils.js';

describe('getUomBehavior', () => {
  it('returns volume config for "volume"', () => {
    const cfg = getUomBehavior('volume');
    expect(cfg.allowsDecimal).toBe(true);
    expect(cfg.step).toBe(0.1);
    expect(cfg.validateInteger).toBe(false);
    expect(cfg.parseQty('3.5')).toBe(3.5);
    expect(cfg.formatQty(3.5)).toBe('3.5');
  });

  it('returns weight config for "weight"', () => {
    const cfg = getUomBehavior('weight');
    expect(cfg.allowsDecimal).toBe(true);
    expect(cfg.step).toBe(0.1);
    expect(cfg.validateInteger).toBe(false);
    expect(cfg.formatQty(3.5)).toBe('3.50');
  });

  it('returns count config for "count"', () => {
    const cfg = getUomBehavior('count');
    expect(cfg.allowsDecimal).toBe(false);
    expect(cfg.step).toBe(1);
    expect(cfg.validateInteger).toBe(true);
    expect(cfg.parseQty('5')).toBe(5);
    expect(cfg.parseQty('5.7')).toBe(5); // parseInt truncates
    expect(cfg.formatQty(5)).toBe('5');
    expect(cfg.formatQty(5.9)).toBe('6'); // Math.round
  });

  it('returns length config for "length"', () => {
    const cfg = getUomBehavior('length');
    expect(cfg.allowsDecimal).toBe(true);
    expect(cfg.step).toBe(0.5);
    expect(cfg.validateInteger).toBe(false);
  });

  it('falls back to volume for unknown type', () => {
    const cfg = getUomBehavior('banana');
    expect(cfg.step).toBe(0.1);
    expect(cfg.allowsDecimal).toBe(true);
  });

  it('falls back to volume for null/undefined', () => {
    expect(getUomBehavior(null).step).toBe(0.1);
    expect(getUomBehavior(undefined).step).toBe(0.1);
    expect(getUomBehavior('').step).toBe(0.1);
  });
});

describe('validateLooseQuantity', () => {
  // ── Volume / Weight ──
  it('accepts decimal amounts for volume', () => {
    expect(validateLooseQuantity(37.5, 'volume')).toEqual({ valid: true });
    expect(validateLooseQuantity(0.1, 'volume')).toEqual({ valid: true });
  });

  it('accepts decimal amounts for weight', () => {
    expect(validateLooseQuantity(250.75, 'weight')).toEqual({ valid: true });
  });

  // ── Count ──
  it('accepts whole numbers for count', () => {
    expect(validateLooseQuantity(5, 'count')).toEqual({ valid: true });
    expect(validateLooseQuantity(1, 'count')).toEqual({ valid: true });
  });

  it('rejects fractional amounts for count', () => {
    const result = validateLooseQuantity(2.5, 'count');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/whole number/i);
  });

  it('rejects 0.5 tablets', () => {
    const result = validateLooseQuantity(0.5, 'count');
    expect(result.valid).toBe(false);
  });

  // ── General guards ──
  it('rejects zero', () => {
    expect(validateLooseQuantity(0, 'volume').valid).toBe(false);
    expect(validateLooseQuantity(0, 'count').valid).toBe(false);
  });

  it('rejects negative amounts', () => {
    expect(validateLooseQuantity(-5, 'volume').valid).toBe(false);
  });

  it('rejects NaN and Infinity', () => {
    expect(validateLooseQuantity(NaN, 'volume').valid).toBe(false);
    expect(validateLooseQuantity(Infinity, 'weight').valid).toBe(false);
  });

  it('falls back to volume behavior for unknown type (allows decimals)', () => {
    expect(validateLooseQuantity(3.5, 'banana').valid).toBe(true);
  });

  it('falls back to volume for null/undefined type', () => {
    expect(validateLooseQuantity(3.5, null).valid).toBe(true);
    expect(validateLooseQuantity(3.5, undefined).valid).toBe(true);
  });
});

import { validatePoolAllocation } from '../../../services/inventory/StockPoolService.js';

describe('StockPoolService.validatePoolAllocation integration', () => {
  const baseProduct = {
    currentStock: 300,
    looseStock: 75,
    containerCapacity: 75,
    canSellLoose: true,
    unitName: 'ml',
  } as any;

  it('accepts valid ml open (volume)', () => {
    const r = validatePoolAllocation(baseProduct, 75, 'open', 'volume');
    expect(r.valid).toBe(true);
    expect(r.delta).toBe(75);
  });

  it('accepts valid ml close (volume)', () => {
    const r = validatePoolAllocation(baseProduct, 50, 'close', 'volume');
    expect(r.valid).toBe(true);
    expect(r.delta).toBe(-50);
  });

  it('rejects fractional capsule open (count)', () => {
    const capsuleProduct = { ...baseProduct, containerCapacity: 60, looseStock: 0 };
    const r = validatePoolAllocation(capsuleProduct, 0.5, 'open', 'count');
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/whole number/i);
  });

  it('rejects zero amount', () => {
    const r = validatePoolAllocation(baseProduct, 0, 'open', 'volume');
    expect(r.valid).toBe(false);
  });

  it('rejects open amount exceeding sealed stock', () => {
    const r = validatePoolAllocation(baseProduct, 999, 'open', 'volume');
    // sealedStock = 300 - 75 = 225; 999 > 225
    expect(r.valid).toBe(false);
  });

  it('rejects close amount exceeding loose stock', () => {
    const r = validatePoolAllocation(baseProduct, 999, 'close', 'volume');
    // looseStock = 75; 999 > 75
    expect(r.valid).toBe(false);
  });
});
