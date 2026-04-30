import { formatTransactionQuantityDisplay } from '@/lib/pricing'

describe('transaction quantity display', () => {
  it('shows sealed bottle sales as sold bottles, not base-unit stock quantity', () => {
    expect(formatTransactionQuantityDisplay({
      quantity: 12,
      saleType: 'quantity',
      baseUnit: 'cap',
      product: {
        containerCapacity: 60,
        containerType: { name: 'Bottle' },
        unitOfMeasurement: { abbreviation: 'cap', name: 'Capsule' },
      },
    })).toBe('12 bottles')
  })

  it('shows loose sales in the submitted base unit', () => {
    expect(formatTransactionQuantityDisplay({
      quantity: 10,
      saleType: 'volume',
      baseUnit: 'Milliliter',
      unitPrice: 0.7,
      product: {
        sellingPrice: 42,
        containerCapacity: 60,
        containerType: { name: 'Bottle' },
      },
    })).toBe('10 Milliliter')
  })

  it('repairs legacy whole-bottle rows that were saved with loose base-unit labels', () => {
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
    })

    expect(display).toBe('10 bottles')
    expect(display).not.toContain('Milliliter')
  })

  it('repairs legacy whole-bottle rows when convertedQuantity reveals container math', () => {
    expect(formatTransactionQuantityDisplay({
      quantity: 2,
      saleType: 'volume',
      baseUnit: 'cap',
      convertedQuantity: 120,
      containerCapacityAtSale: 60,
      containerType: { name: 'Bottle' },
    })).toBe('2 bottles')
  })

  it('shows simple non-container products with their base unit', () => {
    expect(formatTransactionQuantityDisplay({
      quantity: 3,
      saleType: 'quantity',
      baseUnit: 'cap',
      product: {
        containerCapacity: 1,
        unitOfMeasurement: { abbreviation: 'cap', name: 'Capsule' },
      },
    })).toBe('3 caps')
  })

  it('does not leak containerCapacity math through stale legacy baseUnit labels', () => {
    const display = formatTransactionQuantityDisplay({
      quantity: 12,
      saleType: 'quantity',
      baseUnit: 'bottle',
      containerCapacity: 1,
      product: {
        containerCapacity: 60,
        containerType: { name: 'Bottle' },
        unitOfMeasurement: { abbreviation: 'cap', name: 'Capsule' },
      },
    })

    expect(display).toBe('12 bottles')
    expect(display).not.toContain('720')
  })

  it.each([
    ['Bottle', 1, '1 bottle'],
    ['Bottle', 2, '2 bottles'],
    ['Box', 2, '2 boxes'],
    ['Tray', 3, '3 trays'],
    ['Glass', 4, '4 glasses'],
    ['Supply', 5, '5 supplies'],
    ['Capsules', 6, '6 capsules'],
  ])('pluralizes sealed container labels for %s x %s', (containerName, quantity, expected) => {
    expect(formatTransactionQuantityDisplay({
      quantity,
      saleType: 'quantity',
      baseUnit: 'cap',
      product: {
        containerCapacity: 60,
        containerType: { name: containerName },
        unitOfMeasurement: { abbreviation: 'cap', name: 'Capsule' },
      },
    })).toBe(expected)
  })

  it('uses the sale snapshot when a saved item has no hydrated product reference', () => {
    expect(formatTransactionQuantityDisplay({
      quantity: 12,
      saleType: 'quantity',
      baseUnit: 'cap',
      containerCapacityAtSale: 60,
      containerType: { name: 'Bottle' },
    })).toBe('12 bottles')
  })

  it('falls back to containers for saved sealed items without a container type', () => {
    expect(formatTransactionQuantityDisplay({
      quantity: 8,
      saleType: 'quantity',
      baseUnit: 'cap',
      containerCapacityAtSale: 120,
    })).toBe('8 containers')
  })

  it('does not double-pluralize simple count units that are already plural', () => {
    expect(formatTransactionQuantityDisplay({
      quantity: 3,
      saleType: 'quantity',
      baseUnit: 'caps',
      product: {
        containerCapacity: 1,
        unitOfMeasurement: { abbreviation: 'caps', name: 'Capsules' },
      },
    })).toBe('3 caps')
  })

  it('keeps decimal loose quantities as sold base units', () => {
    expect(formatTransactionQuantityDisplay({
      quantity: 7.5,
      saleType: 'volume',
      baseUnit: 'ml',
      product: {
        containerCapacity: 60,
        containerType: { name: 'Bottle' },
      },
    })).toBe('7.5 ml')
  })

  it('never displays capacity-multiplied values for sealed sales across common capacities', () => {
    const capacities = [2, 30, 60, 75, 90, 120, 500, 1000]
    const quantities = [1, 2, 3, 7, 12, 25]

    for (const containerCapacity of capacities) {
      for (const quantity of quantities) {
        const display = formatTransactionQuantityDisplay({
          quantity,
          saleType: 'quantity',
          baseUnit: 'cap',
          product: {
            containerCapacity,
            containerType: { name: 'Bottle' },
            unitOfMeasurement: { abbreviation: 'cap', name: 'Capsule' },
          },
        })

        expect(display.split(' ')[0]).toBe(String(quantity))
        expect(display).toBe(`${quantity} ${quantity === 1 ? 'bottle' : 'bottles'}`)
        expect(display).not.toBe(`${quantity * containerCapacity} bottles`)
      }
    }
  })
})
