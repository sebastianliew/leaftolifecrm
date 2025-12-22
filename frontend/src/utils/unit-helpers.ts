import type { UnitOfMeasurement } from '@/types/inventory';

// Type for unit input that can be various formats
type UnitInput = string | UnitOfMeasurement | { _id?: string; id?: string; [key: string]: unknown } | undefined | null;

export const extractUnitId = (unit: UnitInput): string => {
  if (!unit) return '';
  if (typeof unit === 'string') return unit;
  if (unit && typeof unit === 'object' && '_id' in unit && typeof unit._id === 'string') return unit._id;
  if (unit && typeof unit === 'object' && 'id' in unit && typeof unit.id === 'string') return unit.id;
  return '';
};

export const findUnitByName = (units: UnitOfMeasurement[], name: string): UnitOfMeasurement | undefined => {
  const lowerName = name.toLowerCase();
  return units.find(u => 
    u.name.toLowerCase() === lowerName || 
    u.abbreviation?.toLowerCase() === lowerName
  );
};

export const getDefaultUnit = (units: UnitOfMeasurement[], preferredType?: 'weight' | 'volume'): UnitOfMeasurement | undefined => {
  // Try to find a default unit based on common patterns
  const defaultUnits = units.filter(u => {
    const name = u.name.toLowerCase();
    if (preferredType === 'weight') {
      return name.includes('gram') || name.includes('g');
    }
    if (preferredType === 'volume') {
      return name.includes('milliliter') || name.includes('ml');
    }
    return name.includes('gram') || name.includes('milliliter') || name.includes('ml') || name.includes('g');
  });

  return defaultUnits[0];
};