"use client"

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { EditorialModal } from '@/components/ui/editorial'
import type { Product, UnitOfMeasurement } from '@/types/inventory'

interface QuantitySelectorModalProps {
  product: Product
  isOpen: boolean
  onClose: () => void
  onConfirm: (totalQuantity: number, totalPrice: number, selectedUnit: string, saleType?: string) => void
  unitPrice: number
  unitOfMeasurements: UnitOfMeasurement[]
}

export function QuantitySelectorModal({
  product,
  isOpen,
  onClose,
  onConfirm,
  unitPrice,
  unitOfMeasurements: _unitOfMeasurements
}: QuantitySelectorModalProps) {
  const [quantity, setQuantity] = useState<string>("")
  const [saleType, setSaleType] = useState<'quantity' | 'volume'>('quantity')

  const handleQuantityChange = (value: string) => {
    setQuantity(value)
  }

  const handleSaleTypeChange = (newSaleType: 'quantity' | 'volume') => {
    setSaleType(newSaleType)
  }

  const getTotalQuantity = () => {
    const qty = parseFloat(quantity) || 0;

    switch (saleType) {
      case 'quantity':
        // For individual units, return the actual number of units
        return qty;
      case 'volume':
        // For volume sales, return the volume amount directly
        return qty;
      default:
        return qty;
    }
  };

  const getTotalPrice = () => {
    const qty = parseFloat(quantity) || 0

    switch (saleType) {
      case 'quantity':
        return qty * unitPrice
      case 'volume': {
        // For volume sales, calculate proportion and price accordingly
        const containerCapacity = product.containerCapacity || product.quantity || 1
        const proportion = qty / containerCapacity
        return proportion * unitPrice
      }
      default:
        return qty * unitPrice
    }
  }

  const getInputLabel = () => {
    switch (saleType) {
      case 'quantity':
        return 'Number of Units'
      case 'volume':
        return `Amount (${product.unitOfMeasurement?.abbreviation || 'units'})`
      default:
        return 'Quantity'
    }
  }

  const hasValidationErrors = () => {
    const qty = parseFloat(quantity) || 0
    return qty <= 0
  }

  // Sell-through-permissive policy: never block a sale on stock. The patient
  // flow proceeds silently even when quantity exceeds available stock; the
  // resulting deficit appears in admin reports as "stock owed".
  const handleConfirm = () => {
    const qty = parseFloat(quantity) || 0

    if (qty <= 0) {
      alert(`❌ Invalid Quantity!\n\nQuantity must be greater than 0.`)
      return
    }

    const productUnit = typeof product.unitOfMeasurement === 'object'
      ? product.unitOfMeasurement._id || ''
      : product.unitOfMeasurement || ''

    onConfirm(
      qty,
      getTotalPrice(),
      productUnit,
      saleType
    )

    onClose()
  }

  return (
    <EditorialModal
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      kicker="Sale details"
      title={`Configure ${product?.name || 'product'}`}
      description="Choose how to dispense this product — by individual units or by volume from the loose pool."
      size="xl"
    >

        <div className="grid grid-cols-2 gap-6 mb-6">
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-2xl font-bold">{getTotalQuantity().toFixed(2).replace(/\.?0+$/, '')}</div>
              <div className="text-sm text-muted-foreground">Total Quantity</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-2xl font-bold">${getTotalPrice().toFixed(2).replace(/\.?0+$/, '')}</div>
              <div className="text-sm text-muted-foreground">Total Price</div>
            </CardContent>
          </Card>
        </div>

        {/* Product Information */}
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <div className="flex items-center gap-2">
            <span className="text-blue-600">ℹ️</span>
            <span className="text-sm text-blue-800">
              <strong>Available Stock:</strong> {saleType === "volume"
                ? `${product.looseStock ?? 0} ${product.unitOfMeasurement?.abbreviation || "units"} (loose pool)`
                : `${Math.floor(Math.max(0, (product.currentStock || 0) - (product.looseStock ?? 0)) / Math.max(1, product.containerCapacity || 1))} containers`}.
              <strong>Unit Price:</strong> ${unitPrice.toFixed(2).replace(/\.?0+$/, '')} per unit.
              {product.quantity && (
                <>
                  <strong className="ml-2">Capacity:</strong> {product.quantity} {product.unitOfMeasurement?.abbreviation || 'units'} per unit.
                </>
              )}
            </span>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Configure Sale Details</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Sale Type Selector */}
            <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-green-50 border border-blue-200 rounded-lg">
              <Label className="text-lg font-semibold text-blue-900 mb-3 block">Sale Type</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  className={`p-3 rounded-lg border-2 transition-all ${saleType === 'quantity'
                    ? 'border-blue-500 bg-blue-100 text-blue-800'
                    : 'border-gray-200 bg-white hover:border-blue-300'}`}
                  onClick={() => handleSaleTypeChange('quantity')}
                >
                  <div className="text-center">
                    <div className="text-lg font-bold">📦</div>
                    <div className="text-sm font-medium">Individual Units</div>
                    <div className="text-xs text-muted-foreground">Sell by piece/unit count</div>
                  </div>
                </button>

                <button
                  className={`p-3 rounded-lg border-2 transition-all ${
                    (product.looseStock ?? 0) <= 0
                      ? 'border-gray-200 bg-gray-100 opacity-50 cursor-not-allowed'
                      : saleType === 'volume'
                        ? 'border-green-500 bg-green-100 text-green-800'
                        : 'border-gray-200 bg-white hover:border-green-300'
                  }`}
                  onClick={() => (product.looseStock ?? 0) > 0 && handleSaleTypeChange('volume')}
                  disabled={(product.looseStock ?? 0) <= 0}
                >
                  <div className="text-center">
                    <div className="text-lg font-bold">⚗️</div>
                    <div className="text-sm font-medium">Volume/Weight</div>
                    <div className="text-xs text-muted-foreground">
                      {(product.looseStock ?? 0) <= 0
                        ? 'No loose stock — open bottles in Inventory first'
                        : product.canSellLoose !== true
                          ? 'Not available for this product'
                          : 'Custom quantity (ml, g, etc.)'}
                    </div>
                  </div>
                </button>
              </div>

              {/* Sale Type Descriptions */}
              <div className="mt-3 p-3 bg-white rounded border">
                {saleType === 'quantity' && (
                  <div className="text-sm text-blue-800">
                    <strong>Individual Units:</strong> Sell by counting individual pieces. Stock deducted unit by unit.
                  </div>
                )}
                {saleType === 'volume' && (
                  <div className="text-sm text-green-800">
                    <strong>Volume/Weight Sales:</strong> Sell specific amounts (e.g., 30ml from 50ml bottle). Perfect for custom dosing where patient needs less than full container.
                  </div>
                )}
              </div>

            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="quantity">{getInputLabel()}</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={quantity}
                  onChange={(e) => handleQuantityChange(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  placeholder={`Enter ${getInputLabel().toLowerCase()}`}
                />
              </div>

              <div>
                <Label>Smart Conversion Tip</Label>
                {/* Smart Tip replacing Total Amount */}
                {parseFloat(quantity) > 0 && product.quantity ? (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                    <div className="text-yellow-800">
                      <div className="font-medium text-sm mb-1">💡 Smart Tip:</div>
                      <div className="text-sm">
                        {(() => {
                          const qty = parseFloat(quantity)
                          const capacity = product.containerCapacity || product.quantity || 1
                          const unitAbbr = product.unitOfMeasurement?.abbreviation || 'units'

                          if (saleType === 'quantity') {
                            // Input: units → Output: substance
                            const totalSubstance = qty * capacity
                            return `${qty} unit(s) = ${totalSubstance} ${unitAbbr}`
                          } else if (saleType === 'volume') {
                            // Input: substance → Output: units
                            const unitEquivalent = (qty / capacity).toFixed(2).replace(/\.?0+$/, '')
                            const isPartial = qty % capacity !== 0
                            return `${qty} ${unitAbbr} = ${unitEquivalent} unit(s)${isPartial ? ' (partial)' : ''}`
                          }
                        })()}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 border rounded bg-gray-50">
                    <span className="text-sm text-muted-foreground">
                      Enter quantity to see conversion info
                    </span>
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {saleType === 'quantity' && 'Shows total substance from units'}
                  {saleType === 'volume' && 'Shows unit usage for custom amount'}
                </p>
              </div>
            </div>

            <div className="mt-4 p-3 bg-muted rounded-md">
              <div className="flex justify-between items-center">
                <span className="text-sm">Total Price:</span>
                <span className="font-bold text-lg">
                  ${getTotalPrice().toFixed(2).replace(/\.?0+$/, '')}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm text-muted-foreground">
                <span>Unit Price:</span>
                <span>${unitPrice.toFixed(2).replace(/\.?0+$/, '')}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={onClose}>
            Back
          </Button>
          <Button onClick={handleConfirm} disabled={hasValidationErrors()}>
            Add to Transaction
          </Button>
        </div>
    </EditorialModal>
  )
}
