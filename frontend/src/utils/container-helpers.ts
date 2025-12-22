import type { Product } from '@/types/inventory';
import type { UnitOfMeasurement } from '@/types/inventory';

const CONTAINER_UNITS = ['bottle', 'bottles', 'box', 'boxes', 'container', 'containers', 'pack', 'packs'];

export const isContainerBased = (unitName?: string): boolean => {
  return unitName ? CONTAINER_UNITS.includes(unitName.toLowerCase()) : false;
};

export const getContentUnitType = (containerType?: string): string => {
  if (!containerType) return 'ml';
  const lowerType = containerType.toLowerCase();
  
  if (lowerType.includes('bottle') || lowerType.includes('tube')) {
    return 'ml';
  }
  if (lowerType.includes('jar')) {
    return 'g';
  }
  return 'ml';
};

export const convertContainerToContentUnit = (
  product: Product,
  units: UnitOfMeasurement[]
): {
  unitId: string;
  unitName: string;
  costPerUnit: number;
  defaultQuantity: number;
  availableStock: number;
} | null => {
  if (!product.containerCapacity) return null;

  const contentUnitType = getContentUnitType(product.containerType?.name);
  const contentUnit = units.find(u => {
    const name = u.name.toLowerCase();
    return (
      name === contentUnitType ||
      name.includes(contentUnitType) ||
      (contentUnitType === 'ml' && (name.includes('milliliter') || name.includes('ml'))) ||
      (contentUnitType === 'g' && (name.includes('gram') || name.includes('g')))
    );
  });

  if (!contentUnit) return null;

  return {
    unitId: contentUnit._id || '',
    unitName: contentUnit.name || contentUnitType,
    costPerUnit: (product.sellingPrice || 0) / product.containerCapacity,
    defaultQuantity: Math.min(50, Math.round(product.containerCapacity / 4)),
    availableStock: (product.currentStock || 0) * product.containerCapacity
  };
};