import type { UnitOfMeasurement } from '@/types/inventory'

interface UnitFallbackOptions {
  itemType?: 'service' | 'consultation' | 'miscellaneous' | 'custom_blend' | 'fixed_blend' | 'bundle' | 'product'
  saleType?: 'quantity' | 'volume'
  preferredTypes?: string[]
}

export function getDefaultUnitId(
  units: UnitOfMeasurement[], 
  options: UnitFallbackOptions = {}
): string {
  if (!units.length) return '';
  
  const { itemType, saleType, preferredTypes } = options;
  
  // Helper to extract unit ID
  const extractUnitId = (unit: UnitOfMeasurement): string => {
    return unit.id || unit._id || '';
  };
  
  // For service-based items (consultation, miscellaneous services)
  if (itemType === 'service' || itemType === 'consultation' || itemType === 'miscellaneous') {
    const serviceUnit = units.find((u) =>
      u.name.toLowerCase().includes('service') ||
      u.name.toLowerCase().includes('consultation') ||
      u.name.toLowerCase().includes('session')
    );
    
    if (serviceUnit) {
      return extractUnitId(serviceUnit);
    }
  }
  
  // For custom blends (prefer weight/volume units)
  if (itemType === 'custom_blend') {
    const weightVolumeUnit = units.find((u) =>
      u.name.toLowerCase().includes('gram') ||
      u.name.toLowerCase().includes('ml') ||
      u.name.toLowerCase().includes('milliliter') ||
      u.type === 'weight' ||
      u.type === 'volume'
    );
    
    if (weightVolumeUnit) {
      return extractUnitId(weightVolumeUnit);
    }
  }
  
  // For volume-based sales
  if (saleType === 'volume') {
    const volumeUnit = units.find((u) =>
      u.type === 'volume' ||
      u.name.toLowerCase().includes('ml') ||
      u.name.toLowerCase().includes('liter') ||
      u.name.toLowerCase().includes('milliliter')
    );
    
    if (volumeUnit) {
      return extractUnitId(volumeUnit);
    }
  }
  
  // Check for preferred types if specified
  if (preferredTypes?.length) {
    for (const preferredType of preferredTypes) {
      const preferredUnit = units.find((u) =>
        u.type === preferredType ||
        u.name.toLowerCase().includes(preferredType.toLowerCase())
      );
      
      if (preferredUnit) {
        return extractUnitId(preferredUnit);
      }
    }
  }
  
  // Fallback to count-based units (most common for products/bundles)
  const countUnit = units.find((u) =>
    u.type === 'count' ||
    u.name.toLowerCase().includes('unit') ||
    u.name.toLowerCase().includes('piece') ||
    u.name.toLowerCase().includes('each')
  );
  
  if (countUnit) {
    return extractUnitId(countUnit);
  }
  
  // Final fallback to first available unit
  return extractUnitId(units[0]);
}

export function ensureValidUnitId(
  unitId: string | undefined | null,
  units: UnitOfMeasurement[],
  options: UnitFallbackOptions = {}
): string {
  // If unit ID is provided and valid, return it
  if (unitId && typeof unitId === 'string' && unitId.length > 0 && unitId !== 'service') {
    return unitId;
  }
  
  // Otherwise, get a suitable default
  return getDefaultUnitId(units, options);
}

export function validateTransactionItemUnit(
  item: { 
    unitOfMeasurementId?: string;
    itemType?: string;
    saleType?: string;
  },
  units: UnitOfMeasurement[]
): string {
  const validatedUnitId = ensureValidUnitId(
    item.unitOfMeasurementId, 
    units, 
    {
      itemType: item.itemType as UnitFallbackOptions['itemType'],
      saleType: item.saleType as UnitFallbackOptions['saleType']
    }
  );
  
  if (!validatedUnitId) {
    throw new Error(`Unable to determine valid unit of measurement for item type: ${item.itemType}`);
  }
  
  return validatedUnitId;
}