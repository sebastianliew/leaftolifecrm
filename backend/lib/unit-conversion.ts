export interface ConversionResult {
  value: number;
  fromUnit: string;
  toUnit: string;
}

export interface UnitDefinition {
  name: string;
  type: 'weight' | 'volume' | 'length' | 'count';
  baseMultiplier: number; // Multiplier to convert to base unit
  baseUnit: string;
}

export class UnitConversionService {
  private static units: UnitDefinition[] = [
    // Weight units (grams as base)
    { name: 'mg', type: 'weight', baseMultiplier: 0.001, baseUnit: 'g' },
    { name: 'g', type: 'weight', baseMultiplier: 1, baseUnit: 'g' },
    { name: 'kg', type: 'weight', baseMultiplier: 1000, baseUnit: 'g' },
    { name: 'lb', type: 'weight', baseMultiplier: 453.592, baseUnit: 'g' },
    { name: 'oz', type: 'weight', baseMultiplier: 28.3495, baseUnit: 'g' },

    // Volume units (ml as base)
    { name: 'ml', type: 'volume', baseMultiplier: 1, baseUnit: 'ml' },
    { name: 'l', type: 'volume', baseMultiplier: 1000, baseUnit: 'ml' },
    { name: 'fl oz', type: 'volume', baseMultiplier: 29.5735, baseUnit: 'ml' },
    { name: 'cup', type: 'volume', baseMultiplier: 236.588, baseUnit: 'ml' },
    { name: 'pint', type: 'volume', baseMultiplier: 473.176, baseUnit: 'ml' },
    { name: 'quart', type: 'volume', baseMultiplier: 946.353, baseUnit: 'ml' },
    { name: 'gallon', type: 'volume', baseMultiplier: 3785.41, baseUnit: 'ml' },

    // Length units (mm as base)
    { name: 'mm', type: 'length', baseMultiplier: 1, baseUnit: 'mm' },
    { name: 'cm', type: 'length', baseMultiplier: 10, baseUnit: 'mm' },
    { name: 'm', type: 'length', baseMultiplier: 1000, baseUnit: 'mm' },
    { name: 'in', type: 'length', baseMultiplier: 25.4, baseUnit: 'mm' },
    { name: 'ft', type: 'length', baseMultiplier: 304.8, baseUnit: 'mm' },

    // Count units
    { name: 'piece', type: 'count', baseMultiplier: 1, baseUnit: 'piece' },
    { name: 'pieces', type: 'count', baseMultiplier: 1, baseUnit: 'piece' },
    { name: 'unit', type: 'count', baseMultiplier: 1, baseUnit: 'piece' },
    { name: 'units', type: 'count', baseMultiplier: 1, baseUnit: 'piece' },
    { name: 'dozen', type: 'count', baseMultiplier: 12, baseUnit: 'piece' },
  ];

  public static canConvert(fromUnit: string, toUnit: string): boolean {
    try {
      // Normalize unit names
      const normalizedFromUnit = fromUnit.toLowerCase().trim();
      const normalizedToUnit = toUnit.toLowerCase().trim();

      // If same unit, return true
      if (normalizedFromUnit === normalizedToUnit) {
        return true;
      }

      // Find unit definitions
      const fromUnitDef = this.units.find(u => u.name.toLowerCase() === normalizedFromUnit);
      const toUnitDef = this.units.find(u => u.name.toLowerCase() === normalizedToUnit);

      // Both units must exist and be of the same type
      return !!(fromUnitDef && toUnitDef && fromUnitDef.type === toUnitDef.type);
    } catch {
      return false;
    }
  }

  public static convert(value: number, fromUnit: string, toUnit: string): ConversionResult {
    // Normalize unit names
    const normalizedFromUnit = fromUnit.toLowerCase().trim();
    const normalizedToUnit = toUnit.toLowerCase().trim();

    // If same unit, return as-is
    if (normalizedFromUnit === normalizedToUnit) {
      return {
        value,
        fromUnit,
        toUnit
      };
    }

    // Find unit definitions
    const fromUnitDef = this.units.find(u => u.name.toLowerCase() === normalizedFromUnit);
    const toUnitDef = this.units.find(u => u.name.toLowerCase() === normalizedToUnit);

    if (!fromUnitDef) {
      throw new Error(`Unknown unit: ${fromUnit}`);
    }

    if (!toUnitDef) {
      throw new Error(`Unknown unit: ${toUnit}`);
    }

    // Check if units are compatible (same type)
    if (fromUnitDef.type !== toUnitDef.type) {
      throw new Error(`Cannot convert from ${fromUnit} (${fromUnitDef.type}) to ${toUnit} (${toUnitDef.type})`);
    }

    // Convert to base unit, then to target unit
    const baseValue = value * fromUnitDef.baseMultiplier;
    const convertedValue = baseValue / toUnitDef.baseMultiplier;

    return {
      value: convertedValue,
      fromUnit,
      toUnit
    };
  }

  public static getCompatibleUnits(unitType: 'weight' | 'volume' | 'length' | 'count'): string[] {
    return this.units
      .filter(u => u.type === unitType)
      .map(u => u.name);
  }

  public static getUnitType(unitName: string): 'weight' | 'volume' | 'length' | 'count' | null {
    const unit = this.units.find(u => u.name.toLowerCase() === unitName.toLowerCase());
    return unit ? unit.type : null;
  }

  public static isValidUnit(unitName: string): boolean {
    return this.units.some(u => u.name.toLowerCase() === unitName.toLowerCase());
  }

  public static normalizeUnit(unitName: string): string {
    const unit = this.units.find(u => u.name.toLowerCase() === unitName.toLowerCase());
    return unit ? unit.name : unitName;
  }
}

export default UnitConversionService;