import { UnitOfMeasurement } from "@/types/inventory"

export function convertToBaseUnit(value: number, unit: UnitOfMeasurement): number {
  if (!unit.baseUnit || !unit.conversionRate) {
    return value
  }
  return value * unit.conversionRate
}

export function convertFromBaseUnit(value: number, unit: UnitOfMeasurement): number {
  if (!unit.baseUnit || !unit.conversionRate) {
    return value
  }
  return value / unit.conversionRate
}

export function getDisplayValue(value: number, unit: UnitOfMeasurement): number {
  if (!unit.baseUnit || !unit.conversionRate) {
    return value
  }
  return convertFromBaseUnit(value, unit)
}

export function getStorageValue(value: number, unit: UnitOfMeasurement): number {
  if (!unit.baseUnit || !unit.conversionRate) {
    return value
  }
  return convertToBaseUnit(value, unit)
} 