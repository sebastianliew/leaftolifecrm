import { describe, expect, it } from '@jest/globals';
import { formatTransactionQuantityDisplay } from '../../../utils/transactionQuantityDisplay.js';

describe('transactionQuantityDisplay', () => {
  it('shows sealed bottle sales as sold bottles, not base-unit stock quantity', () => {
    expect(formatTransactionQuantityDisplay({
      quantity: 12,
      saleType: 'quantity',
      baseUnit: 'cap',
      product: {
        containerCapacity: 120,
        containerType: { name: 'Bottle' },
        unitOfMeasurement: { abbreviation: 'cap', name: 'Capsule' },
      },
    })).toBe('12 bottles');
  });

  it('uses sale semantics instead of stale baseUnit bottle math', () => {
    const display = formatTransactionQuantityDisplay({
      quantity: 12,
      saleType: 'quantity',
      baseUnit: 'bottle',
      product: {
        containerCapacity: 60,
        containerType: { name: 'Bottle' },
      },
    });

    expect(display).toBe('12 bottles');
    expect(display).not.toContain('720');
  });

  it('repairs whole-bottle legacy rows saved with loose base-unit labels', () => {
    const display = formatTransactionQuantityDisplay({
      quantity: 10,
      saleType: 'volume',
      baseUnit: 'Milliliter',
      unitPrice: 70,
      product: {
        sellingPrice: 70,
        containerCapacity: 100,
        containerType: { name: 'Bottle' },
      },
    });

    expect(display).toBe('10 bottles');
    expect(display).not.toContain('Milliliter');
  });

  it('keeps true loose sales in the submitted base unit', () => {
    expect(formatTransactionQuantityDisplay({
      quantity: 10,
      saleType: 'volume',
      baseUnit: 'Milliliter',
      unitPrice: 0.7,
      product: {
        sellingPrice: 70,
        containerCapacity: 100,
        containerType: { name: 'Bottle' },
      },
    })).toBe('10 Milliliter');
  });

  it('shows simple non-container products with their base unit', () => {
    expect(formatTransactionQuantityDisplay({
      quantity: 3,
      saleType: 'quantity',
      baseUnit: 'cap',
      product: {
        containerCapacity: 1,
        unitOfMeasurement: { abbreviation: 'cap', name: 'Capsule' },
      },
    })).toBe('3 caps');
  });
});
