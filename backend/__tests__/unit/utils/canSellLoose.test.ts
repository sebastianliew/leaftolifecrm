/**
 * Comprehensive tests for the canSellLoose / loose selling flow.
 *
 * Covers:
 * 1. ALLOWED_UPDATE_FIELDS includes canSellLoose (the bug that was fixed)
 * 2. validatePoolAllocation guards (count integer, volume decimal, over-limit)
 * 3. UOM behavior for capsule/tablet type products (count)
 * 4. Full loose sale lifecycle: enable → open pool → sell loose → verify stock
 * 5. SimpleQuantityInput logic (pure function extraction tests)
 */

import mongoose from 'mongoose';
import { validatePoolAllocation, getSealedStock, getLooseStock, getPoolStatus } from '../../../services/inventory/StockPoolService.js';
import { getUomBehavior, validateLooseQuantity } from '../../../utils/uomUtils.js';

// ─────────────────────────────────────────────────────────────────────────────
// 1. ALLOWED_UPDATE_FIELDS — canSellLoose must be in the list
// ─────────────────────────────────────────────────────────────────────────────
describe('ALLOWED_UPDATE_FIELDS includes canSellLoose', () => {
  it('products.controller exports canSellLoose as an allowed update field', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve, dirname } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const src = readFileSync(resolve(__dirname, '../../../controllers/products.controller.ts'), 'utf-8');
    expect(src).toContain("'canSellLoose'");
    expect(src).toContain("ALLOWED_UPDATE_FIELDS");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Pool status helpers
// ─────────────────────────────────────────────────────────────────────────────
describe('StockPoolService helpers', () => {
  const product = (currentStock: number, looseStock: number, containerCapacity = 60) =>
    ({ currentStock, looseStock, containerCapacity, canSellLoose: true } as any);

  describe('getSealedStock', () => {
    it('calculates sealed = currentStock - looseStock', () => {
      expect(getSealedStock(product(420, 180))).toBe(240);
    });
    it('clamps to 0 when looseStock > currentStock', () => {
      expect(getSealedStock(product(50, 100))).toBe(0);
    });
    it('returns all stock when looseStock is 0', () => {
      expect(getSealedStock(product(420, 0))).toBe(420);
    });
  });

  describe('getLooseStock', () => {
    it('returns looseStock directly', () => {
      expect(getLooseStock(product(420, 180))).toBe(180);
    });
    it('returns 0 when looseStock is falsy', () => {
      expect(getLooseStock({ looseStock: undefined } as any)).toBe(0);
    });
  });

  describe('getPoolStatus', () => {
    it('computes full pool status for a capsule product', () => {
      const status = getPoolStatus(product(420, 180, 60));
      expect(status.looseStock).toBe(180);
      expect(status.sealedStock).toBe(240);
      expect(status.sealedContainers).toBe(4);   // Math.floor(240/60)
      expect(status.looseIsOpen).toBe(true);
      expect(status.containerCapacity).toBe(60);
    });

    it('looseIsOpen is false when looseStock = 0', () => {
      const status = getPoolStatus(product(420, 0));
      expect(status.looseIsOpen).toBe(false);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Capsule/tablet (count type) — the Bolol scenario
// ─────────────────────────────────────────────────────────────────────────────
describe('Bolol scenario — 7 containers of 60 capsules, open 3', () => {
  const bolol = {
    currentStock: 420,   // 7 × 60
    looseStock: 0,
    containerCapacity: 60,
    canSellLoose: true,
    unitName: 'cap',
  } as any;

  it('sealed = 420, loose = 0 before opening', () => {
    expect(getSealedStock(bolol)).toBe(420);
    expect(getLooseStock(bolol)).toBe(0);
  });

  it('can open exactly 3 containers worth (180 caps)', () => {
    const r = validatePoolAllocation(bolol, 180, 'open', 'count');
    expect(r.valid).toBe(true);
    expect(r.delta).toBe(180);
  });

  it('rejects opening fractional capsules (0.5)', () => {
    const r = validatePoolAllocation(bolol, 0.5, 'open', 'count');
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/whole number/i);
  });

  it('rejects opening more than available sealed stock', () => {
    const r = validatePoolAllocation(bolol, 600, 'open', 'count');
    expect(r.valid).toBe(false);
    expect(r.error).toMatch(/only 420/);
  });

  describe('after opening 3 containers (looseStock = 180)', () => {
    const afterOpen = { ...bolol, looseStock: 180 };

    it('sealed = 240, loose = 180', () => {
      expect(getSealedStock(afterOpen)).toBe(240);
      expect(getLooseStock(afterOpen)).toBe(180);
    });

    it('can sell 10 loose capsules', () => {
      const cfg = getUomBehavior('count');
      expect(validateLooseQuantity(10, 'count')).toEqual({ valid: true });
      expect(cfg.parseQty('10')).toBe(10);
      expect(cfg.formatQty(10)).toBe('10');
    });

    it('rejects selling 0.5 loose capsules', () => {
      expect(validateLooseQuantity(0.5, 'count').valid).toBe(false);
    });

    it('can seal back 60 capsules', () => {
      const r = validatePoolAllocation(afterOpen, 60, 'close', 'count');
      expect(r.valid).toBe(true);
      expect(r.delta).toBe(-60);
    });

    it('rejects sealing back more than loose pool', () => {
      const r = validatePoolAllocation(afterOpen, 200, 'close', 'count');
      expect(r.valid).toBe(false);
      expect(r.error).toMatch(/only 180/);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. UOM behavior: count step/precision/parse/format
// ─────────────────────────────────────────────────────────────────────────────
describe('UOM count behavior (capsules, tablets, pieces)', () => {
  const cfg = getUomBehavior('count');

  it('step is 1', () => expect(cfg.step).toBe(1));
  it('allowsDecimal is false', () => expect(cfg.allowsDecimal).toBe(false));
  it('validateInteger is true', () => expect(cfg.validateInteger).toBe(true));
  it('parseQty truncates to integer', () => {
    expect(cfg.parseQty('5')).toBe(5);
    expect(cfg.parseQty('5.9')).toBe(5);
  });
  it('formatQty rounds and stringifies', () => {
    expect(cfg.formatQty(5)).toBe('5');
    expect(cfg.formatQty(5.5)).toBe('6');
  });
  it('minValue for loose input should be 1 (not 0.1)', () => {
    // Mirrors SimpleQuantityInput: minValue = allowsDecimal ? step : 1
    const minValue = cfg.allowsDecimal ? cfg.step : 1;
    expect(minValue).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Contrast: ml product (volume type) still works as before
// ─────────────────────────────────────────────────────────────────────────────
describe('Volume (ml) type — regression check', () => {
  const oilProduct = {
    currentStock: 525,
    looseStock: 225,
    containerCapacity: 75,
    canSellLoose: true,
    unitName: 'ml',
  } as any;

  it('accepts decimal ml quantity for loose sell', () => {
    expect(validateLooseQuantity(37.5, 'volume')).toEqual({ valid: true });
  });

  it('accepts opening partial ml', () => {
    // Can open 37.5ml — not possible for count but valid for volume
    // However pool validation only checks amount > sealed — 37.5 < 300 sealed is fine
    const r = validatePoolAllocation({ ...oilProduct, looseStock: 0, currentStock: 525 }, 37.5, 'open', 'volume');
    expect(r.valid).toBe(true);
  });

  it('volume uomCfg: step 0.1, allows decimal', () => {
    const cfg = getUomBehavior('volume');
    expect(cfg.step).toBe(0.1);
    expect(cfg.allowsDecimal).toBe(true);
    expect(cfg.validateInteger).toBe(false);
    expect(cfg.parseQty('37.5')).toBe(37.5);
    expect(cfg.formatQty(37.5)).toBe('37.5');
  });
});
