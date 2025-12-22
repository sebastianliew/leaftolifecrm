/**
 * Unit Conversion Service
 * Provides centralized unit conversion logic for medical practice management
 */

export interface UnitConversion {
  from: string;
  to: string;
  factor: number;
  category: 'volume' | 'weight' | 'count' | 'length' | 'area' | 'temperature';
}

export interface ConversionResult {
  value: number;
  unit: string;
  originalValue: number;
  originalUnit: string;
  conversionUsed?: UnitConversion;
}

export class UnitConversionService {
  private static readonly COMMON_CONVERSIONS: UnitConversion[] = [
    // Volume conversions
    { from: 'drops', to: 'ml', factor: 0.05, category: 'volume' },
    { from: 'ml', to: 'drops', factor: 20, category: 'volume' },
    { from: 'ml', to: 'l', factor: 0.001, category: 'volume' },
    { from: 'l', to: 'ml', factor: 1000, category: 'volume' },
    { from: 'tsp', to: 'ml', factor: 5, category: 'volume' },
    { from: 'tbsp', to: 'ml', factor: 15, category: 'volume' },
    { from: 'fl oz', to: 'ml', factor: 29.5735, category: 'volume' },
    
    // Weight conversions
    { from: 'g', to: 'kg', factor: 0.001, category: 'weight' },
    { from: 'kg', to: 'g', factor: 1000, category: 'weight' },
    { from: 'mg', to: 'g', factor: 0.001, category: 'weight' },
    { from: 'g', to: 'mg', factor: 1000, category: 'weight' },
    { from: 'oz', to: 'g', factor: 28.3495, category: 'weight' },
    { from: 'lb', to: 'g', factor: 453.592, category: 'weight' },
    
    // Count conversions
    { from: 'units', to: 'pieces', factor: 1, category: 'count' },
    { from: 'dozen', to: 'units', factor: 12, category: 'count' },
    { from: 'gross', to: 'units', factor: 144, category: 'count' },
  ];

  /**
   * Convert a value from one unit to another with container support
   */
  static convert(
    value: number, 
    fromUnit: string, 
    toUnit: string, 
    customConversions: UnitConversion[] = [],
    containerInfo?: { capacity: number; unit: string }
  ): ConversionResult {
    // If same unit, return as is
    if (fromUnit.toLowerCase() === toUnit.toLowerCase()) {
      return {
        value,
        unit: toUnit,
        originalValue: value,
        originalUnit: fromUnit
      };
    }

    // Handle container-based conversions
    if (containerInfo) {
      const containerUnits = ['bottle', 'bottles', 'box', 'boxes', 'container', 'containers', 'pack', 'packs'];
      const isFromContainer = containerUnits.includes(fromUnit.toLowerCase());
      const isToContainer = containerUnits.includes(toUnit.toLowerCase());
      
      if (isFromContainer && !isToContainer) {
        // Converting from containers to content (e.g., bottles to ml)
        const contentAmount = value * containerInfo.capacity;
        if (containerInfo.unit.toLowerCase() === toUnit.toLowerCase()) {
          return {
            value: contentAmount,
            unit: toUnit,
            originalValue: value,
            originalUnit: fromUnit,
            conversionUsed: {
              from: fromUnit,
              to: toUnit,
              factor: containerInfo.capacity,
              category: 'volume' as const
            }
          };
        }
        // Need further conversion from container unit to target unit
        return this.convert(contentAmount, containerInfo.unit, toUnit, customConversions);
      } else if (!isFromContainer && isToContainer) {
        // Converting from content to containers (e.g., ml to bottles)
        if (containerInfo.unit.toLowerCase() === fromUnit.toLowerCase()) {
          return {
            value: value / containerInfo.capacity,
            unit: toUnit,
            originalValue: value,
            originalUnit: fromUnit,
            conversionUsed: {
              from: fromUnit,
              to: toUnit,
              factor: 1 / containerInfo.capacity,
              category: 'volume' as const
            }
          };
        }
        // Need conversion from fromUnit to container unit first
        const converted = this.convert(value, fromUnit, containerInfo.unit, customConversions);
        return {
          value: converted.value / containerInfo.capacity,
          unit: toUnit,
          originalValue: value,
          originalUnit: fromUnit,
          conversionUsed: {
            from: fromUnit,
            to: toUnit,
            factor: converted.value / containerInfo.capacity / value,
            category: 'volume' as const
          }
        };
      }
    }

    // Try custom conversions first
    const customConversion = customConversions.find(
      c => c.from.toLowerCase() === fromUnit.toLowerCase() && 
           c.to.toLowerCase() === toUnit.toLowerCase()
    );

    if (customConversion) {
      return {
        value: value * customConversion.factor,
        unit: toUnit,
        originalValue: value,
        originalUnit: fromUnit,
        conversionUsed: customConversion
      };
    }

    // Try common conversions
    const commonConversion = this.COMMON_CONVERSIONS.find(
      c => c.from.toLowerCase() === fromUnit.toLowerCase() && 
           c.to.toLowerCase() === toUnit.toLowerCase()
    );

    if (commonConversion) {
      return {
        value: value * commonConversion.factor,
        unit: toUnit,
        originalValue: value,
        originalUnit: fromUnit,
        conversionUsed: commonConversion
      };
    }

    throw new Error(`Cannot convert from ${fromUnit} to ${toUnit}`);
  }

  /**
   * Get all possible conversion targets for a given unit
   */
  static getConversionTargets(unit: string, customConversions: UnitConversion[] = []): string[] {
    const allConversions = [...this.COMMON_CONVERSIONS, ...customConversions];
    return allConversions
      .filter(c => c.from.toLowerCase() === unit.toLowerCase())
      .map(c => c.to);
  }

  /**
   * Check if conversion is possible between two units
   */
  static canConvert(fromUnit: string, toUnit: string, customConversions: UnitConversion[] = []): boolean {
    try {
      this.convert(1, fromUnit, toUnit, customConversions);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the category of a unit (volume, weight, count, etc.)
   */
  static getUnitCategory(unit: string): string | undefined {
    const conversion = this.COMMON_CONVERSIONS.find(
      c => c.from.toLowerCase() === unit.toLowerCase() || 
           c.to.toLowerCase() === unit.toLowerCase()
    );
    return conversion?.category;
  }

  /**
   * Get all units in a specific category
   */
  static getUnitsInCategory(category: string): string[] {
    const units = new Set<string>();
    this.COMMON_CONVERSIONS
      .filter(c => c.category === category)
      .forEach(c => {
        units.add(c.from);
        units.add(c.to);
      });
    return Array.from(units);
  }

  /**
   * Normalize unit names (handle common abbreviations and variations)
   */
  static normalizeUnit(unit: string): string {
    const normalizations: Record<string, string> = {
      'milliliter': 'ml',
      'milliliters': 'ml',
      'millilitre': 'ml',
      'millilitres': 'ml',
      'liter': 'l',
      'liters': 'l',
      'litre': 'l',
      'litres': 'l',
      'gram': 'g',
      'grams': 'g',
      'kilogram': 'kg',
      'kilograms': 'kg',
      'milligram': 'mg',
      'milligrams': 'mg',
      'ounce': 'oz',
      'ounces': 'oz',
      'pound': 'lb',
      'pounds': 'lb',
      'teaspoon': 'tsp',
      'teaspoons': 'tsp',
      'tablespoon': 'tbsp',
      'tablespoons': 'tbsp',
      'fluid ounce': 'fl oz',
      'fluid ounces': 'fl oz',
      'unit': 'units',
      'piece': 'pieces',
      'drop': 'drops'
    };

    return normalizations[unit.toLowerCase()] || unit.toLowerCase();
  }

  /**
   * Calculate blend total in a specific unit
   */
  static calculateBlendTotal(
    ingredients: Array<{ quantity: number; unit: string }>,
    targetUnit: string,
    customConversions: UnitConversion[] = []
  ): ConversionResult {
    let totalValue = 0;
    const conversions: ConversionResult[] = [];

    for (const ingredient of ingredients) {
      try {
        const converted = this.convert(
          ingredient.quantity,
          ingredient.unit,
          targetUnit,
          customConversions
        );
        totalValue += converted.value;
        conversions.push(converted);
      } catch (error) {
        throw new Error(
          `Cannot convert ingredient with ${ingredient.quantity} ${ingredient.unit} to ${targetUnit}: ${error}`
        );
      }
    }

    return {
      value: totalValue,
      unit: targetUnit,
      originalValue: totalValue,
      originalUnit: targetUnit
    };
  }

  /**
   * Suggest appropriate units for blending based on ingredients
   */
  static suggestBlendUnits(ingredients: Array<{ unit: string }>): string[] {
    const categories = new Set(
      ingredients.map(i => this.getUnitCategory(i.unit)).filter(Boolean)
    );

    if (categories.has('volume')) {
      return ['ml', 'l', 'drops'];
    }
    if (categories.has('weight')) {
      return ['g', 'kg', 'mg'];
    }
    if (categories.has('count')) {
      return ['units', 'pieces'];
    }

    return ['ml', 'g', 'units']; // Default suggestions
  }

  /**
   * Validate that all ingredients can be converted to target unit
   */
  static validateBlendUnits(
    ingredients: Array<{ unit: string }>,
    targetUnit: string,
    customConversions: UnitConversion[] = []
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const ingredient of ingredients) {
      if (!this.canConvert(ingredient.unit, targetUnit, customConversions)) {
        errors.push(`Cannot convert ${ingredient.unit} to ${targetUnit}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

export default UnitConversionService;