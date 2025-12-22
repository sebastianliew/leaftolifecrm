import { createLogger } from '@/lib/logger'

const logger = createLogger('UnitConversions')

export interface UnitConversion {
  from: string
  to: string
  factor: number
}

export interface ConversionResult {
  value: number
  unit: string
  description?: string
}

// Base conversion rates
const CONVERSIONS: UnitConversion[] = [
  // Volume conversions
  { from: 'ml', to: 'drops', factor: 20 },
  { from: 'milliliter', to: 'drops', factor: 20 },
  { from: 'drops', to: 'ml', factor: 0.05 },
  { from: 'drops', to: 'milliliter', factor: 0.05 },
  { from: 'l', to: 'ml', factor: 1000 },
  { from: 'liter', to: 'milliliter', factor: 1000 },
  { from: 'ml', to: 'l', factor: 0.001 },
  { from: 'milliliter', to: 'liter', factor: 0.001 },
  
  // Weight conversions
  { from: 'mg', to: 'g', factor: 0.001 },
  { from: 'milligram', to: 'gram', factor: 0.001 },
  { from: 'g', to: 'mg', factor: 1000 },
  { from: 'gram', to: 'milligram', factor: 1000 },
  { from: 'kg', to: 'g', factor: 1000 },
  { from: 'kilogram', to: 'gram', factor: 1000 },
  { from: 'g', to: 'kg', factor: 0.001 },
  { from: 'gram', to: 'kilogram', factor: 0.001 },
  
  // Special conversions (mg to drops via ml)
  { from: 'mg', to: 'drops', factor: 0.02 }, // 1mg = 0.001ml = 0.02 drops
  { from: 'milligram', to: 'drops', factor: 0.02 },
  { from: 'drops', to: 'mg', factor: 50 }, // 1 drop = 0.05ml = 50mg
  { from: 'drops', to: 'milligram', factor: 50 },
]

// Create a map for faster lookups
const conversionMap = new Map<string, Map<string, number>>()

// Initialize the conversion map
CONVERSIONS.forEach(({ from, to, factor }) => {
  const fromLower = from.toLowerCase()
  const toLower = to.toLowerCase()
  
  if (!conversionMap.has(fromLower)) {
    conversionMap.set(fromLower, new Map())
  }
  conversionMap.get(fromLower)!.set(toLower, factor)
})

/**
 * Convert a value from one unit to another
 */
export function convertUnit(
  value: number,
  fromUnit: string,
  toUnit: string
): ConversionResult | null {
  const fromLower = fromUnit.toLowerCase().trim()
  const toLower = toUnit.toLowerCase().trim()
  
  // Same unit, no conversion needed
  if (fromLower === toLower) {
    return { value, unit: toUnit }
  }
  
  // Direct conversion
  const directFactor = conversionMap.get(fromLower)?.get(toLower)
  if (directFactor !== undefined) {
    return {
      value: value * directFactor,
      unit: toUnit,
      description: `${value} ${fromUnit} = ${value * directFactor} ${toUnit}`
    }
  }
  
  // Try reverse conversion
  const reverseFactor = conversionMap.get(toLower)?.get(fromLower)
  if (reverseFactor !== undefined) {
    const convertedValue = value / reverseFactor
    return {
      value: convertedValue,
      unit: toUnit,
      description: `${value} ${fromUnit} = ${convertedValue} ${toUnit}`
    }
  }
  
  // Try two-step conversion through common units
  const commonUnits = ['ml', 'g', 'milliliter', 'gram']
  for (const commonUnit of commonUnits) {
    const factor1 = conversionMap.get(fromLower)?.get(commonUnit)
    const factor2 = conversionMap.get(commonUnit)?.get(toLower)
    
    if (factor1 !== undefined && factor2 !== undefined) {
      const convertedValue = value * factor1 * factor2
      return {
        value: convertedValue,
        unit: toUnit,
        description: `${value} ${fromUnit} → ${commonUnit} → ${convertedValue} ${toUnit}`
      }
    }
  }
  
  logger.warn(`No conversion found from ${fromUnit} to ${toUnit}`)
  return null
}

/**
 * Convert quantity for blend ingredients with special formatting
 */
export function convertBlendIngredient(
  quantity: number,
  unitName: string
): string {
  const unit = unitName?.toLowerCase() || ''
  
  if (unit.includes('ml') || unit.includes('milliliter')) {
    const drops = convertUnit(quantity, 'ml', 'drops')
    return drops ? `${drops.value.toFixed(1)} drops` : '-'
  } else if (unit.includes('drop')) {
    const ml = convertUnit(quantity, 'drops', 'ml')
    return ml ? `${ml.value.toFixed(2)} ml` : '-'
  } else if (unit.includes('mg') || unit.includes('milligram')) {
    const drops = convertUnit(quantity, 'mg', 'drops')
    return drops ? `${drops.value.toFixed(1)} drops` : '-'
  } else {
    return '-'
  }
}

/**
 * Get available conversions for a unit
 */
export function getAvailableConversions(unit: string): string[] {
  const unitLower = unit.toLowerCase().trim()
  const conversions = conversionMap.get(unitLower)
  
  if (!conversions) {
    return []
  }
  
  return Array.from(conversions.keys())
}

/**
 * Format a quantity with its unit
 */
export function formatQuantityWithUnit(
  quantity: number,
  unit: string,
  precision: number = 2
): string {
  return `${quantity.toFixed(precision)} ${unit}`
}

/**
 * Parse a quantity string like "100 ml" or "5.5kg"
 */
export function parseQuantityString(str: string): { value: number; unit: string } | null {
  const match = str.match(/^([\d.]+)\s*(\w+)$/)
  if (!match) {
    return null
  }
  
  const value = parseFloat(match[1])
  const unit = match[2]
  
  if (isNaN(value)) {
    return null
  }
  
  return { value, unit }
}

/**
 * Check if two units are compatible for conversion
 */
export function areUnitsCompatible(unit1: string, unit2: string): boolean {
  // Check if direct conversion exists
  if (convertUnit(1, unit1, unit2) !== null) {
    return true
  }
  
  // Check unit types
  const volumeUnits = ['ml', 'l', 'drops', 'milliliter', 'liter']
  const weightUnits = ['mg', 'g', 'kg', 'milligram', 'gram', 'kilogram']
  
  const unit1Lower = unit1.toLowerCase()
  const unit2Lower = unit2.toLowerCase()
  
  const unit1IsVolume = volumeUnits.some(u => unit1Lower.includes(u))
  const unit2IsVolume = volumeUnits.some(u => unit2Lower.includes(u))
  
  const unit1IsWeight = weightUnits.some(u => unit1Lower.includes(u))
  const unit2IsWeight = weightUnits.some(u => unit2Lower.includes(u))
  
  // Special case: mg/milligram can convert to drops (through ml)
  if ((unit1Lower.includes('mg') || unit1Lower.includes('milligram')) && 
      unit2Lower.includes('drop')) {
    return true
  }
  if (unit1Lower.includes('drop') && 
      (unit2Lower.includes('mg') || unit2Lower.includes('milligram'))) {
    return true
  }
  
  return (unit1IsVolume && unit2IsVolume) || (unit1IsWeight && unit2IsWeight)
}