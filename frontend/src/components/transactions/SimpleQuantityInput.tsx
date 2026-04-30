"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import {
  EditorialModal,
  EditorialModalFooter,
  EditorialButton,
} from "@/components/ui/editorial"
import type { Product } from "@/types/inventory"
import { computeUnitPrice, getTransactionQuantityDisplayParts, safeContainerCapacity } from "@/lib/pricing"
import { formatLooseUnitPrice } from "@/lib/productPricing"
import { getUomBehavior } from "@/lib/uom"

interface SimpleQuantityInputProps {
  open: boolean
  onClose: () => void
  onConfirm: (quantity: number, saleType: 'quantity' | 'volume', unitDisplay?: string) => void
  product: Product | null
  /** Pre-fill for edit mode */
  initialQuantity?: number
  initialSaleType?: 'quantity' | 'volume'
}

export function SimpleQuantityInput({ open, onClose, onConfirm, product, initialQuantity, initialSaleType }: SimpleQuantityInputProps) {
  const [quantity, setQuantity] = useState(1)
  const [saleMode, setSaleMode] = useState<'loose' | 'sealed'>('loose')
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

  useEffect(() => {
    if (open && product) {
      if (initialQuantity !== undefined && initialSaleType) {
        // Edit mode — restore previous values
        setQuantity(initialQuantity)
        setSaleMode(initialSaleType === 'volume' ? 'loose' : 'sealed')
      } else {
        // New item — defaults
        setQuantity(1)
        const hasLoosePool = (product.looseStock || 0) > 0
        setSaleMode(product.canSellLoose && hasLoosePool ? 'loose' : 'sealed')
      }
    }
  }, [open, product, initialQuantity, initialSaleType])

  if (!product) return null

  // ── Product properties ──
  const containerCapacity = safeContainerCapacity(product.containerCapacity)
  const hasContainers = containerCapacity > 1
  const canSellLoose = product.canSellLoose === true && hasContainers
  const totalBaseStock = product.currentStock || 0
  const loosePool = product.looseStock || 0
  const sealedStock = Math.max(0, totalBaseStock - loosePool)
  const sealedContainers = hasContainers ? Math.floor(sealedStock / containerCapacity) : 0

  // ── Current mode ──
  const isLoose = saleMode === 'loose' && canSellLoose
  const isSimple = !hasContainers

  // ── Unit label (ml, capsules, etc.) ──
  const baseUnitLabel = (
    typeof product.unitOfMeasurement === 'object' && product.unitOfMeasurement !== null
      ? product.unitOfMeasurement.abbreviation || product.unitOfMeasurement.name
      : typeof product.unitOfMeasurement === 'string'
      ? product.unitOfMeasurement
      : null
  ) || 'units'

  const sealedSingularLabel = getTransactionQuantityDisplayParts({
    quantity: 1,
    saleType: 'quantity',
    product,
  }).unitLabel
  const sealedPluralLabel = getTransactionQuantityDisplayParts({
    quantity: 2,
    saleType: 'quantity',
    product,
  }).unitLabel

  // ── Pricing ──
  const unitPrice = computeUnitPrice(product.sellingPrice, product.containerCapacity, isLoose ? 'volume' : 'quantity')
  const totalPrice = unitPrice * quantity

  // ── Stock availability ──
  const availableStock = isLoose
    ? loosePool
    : isSimple
      ? totalBaseStock
      : sealedContainers

  // ── UOM behavior (drives step/parse/format for loose sales) ──
  const uomType = typeof product.unitOfMeasurement === 'object' && product.unitOfMeasurement !== null
    ? (product.unitOfMeasurement as { type?: string }).type
    : undefined
  const uomCfg = getUomBehavior(isLoose ? uomType : undefined)

  // ── Step / min ──
  const step = isLoose ? uomCfg.step : 1
  const minValue = isLoose ? (uomCfg.allowsDecimal ? uomCfg.step : 1) : 1

  // ── Labels ──
  const quantityUnitLabel = isLoose ? baseUnitLabel : isSimple ? baseUnitLabel : sealedPluralLabel

  const priceLabel = isLoose
    ? `$${formatLooseUnitPrice(unitPrice ?? 0)} per ${baseUnitLabel}`
    : isSimple
      ? `$${(unitPrice ?? 0).toFixed(2)} per ${baseUnitLabel}`
      : `$${(unitPrice ?? 0).toFixed(2)} per ${sealedSingularLabel} (${containerCapacity} ${baseUnitLabel})`

  const stockLabel = isLoose
    ? `${loosePool} ${baseUnitLabel} in loose pool`
    : isSimple
      ? `${totalBaseStock} ${baseUnitLabel} available`
      : `${sealedContainers} sealed ${getTransactionQuantityDisplayParts({
          quantity: sealedContainers,
          saleType: 'quantity',
          product,
        }).unitLabel} available`

  const percentageUsed = isLoose
    ? (loosePool > 0 ? (quantity / loosePool) * 100 : 0)
    : isSimple
      ? (totalBaseStock > 0 ? (quantity / totalBaseStock) * 100 : 0)
      : (sealedContainers > 0 ? (quantity / sealedContainers) * 100 : 0)

  // ── Handlers ──
  const handleConfirm = () => {
    if (quantity < minValue) {
      alert(`Quantity must be at least ${minValue}.`)
      return
    }

    if (quantity > availableStock) {
      setShowConfirmDialog(true)
      return
    }

    onConfirm(quantity, isLoose ? 'volume' : 'quantity', baseUnitLabel)
    onClose()
  }

  const handleConfirmOutOfStock = () => {
    setShowConfirmDialog(false)
    onConfirm(quantity, isLoose ? 'volume' : 'quantity', baseUnitLabel)
    onClose()
  }

  const handleDecrement = () => {
    setQuantity(Math.max(minValue, +(quantity - step).toFixed(1)))
  }

  const handleIncrement = () => {
    setQuantity(+(quantity + step).toFixed(1))
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    if (raw === '') {
      setQuantity(0)
      return
    }
    const num = isLoose ? uomCfg.parseQty(raw) : parseInt(raw, 10)
    if (!isNaN(num)) {
      setQuantity(Math.max(0, num))
    }
  }

  const handleModeSwitch = (mode: 'loose' | 'sealed') => {
    setSaleMode(mode)
    setQuantity(1) // Reset quantity when switching modes
  }

  return (
    <>
    <EditorialModal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      kicker="Quantity"
      title={initialQuantity !== undefined ? 'Edit item' : 'Select quantity'}
      description={product.name}
    >
        <div className="space-y-4">
          {/* Product info card */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium">{product.name}</h4>
            <p className="text-sm text-gray-600">SKU: {product.sku}</p>
            <p className="text-sm text-gray-600">{stockLabel}</p>
            <p className="text-lg font-medium text-green-600 mt-2">
              {priceLabel}
            </p>
          </div>

          {/* Sale mode toggle — only for products that can sell both ways */}
          {canSellLoose && hasContainers && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Sell as:</span>
              <button type="button"
                className={`px-3 py-1.5 rounded ${saleMode === 'loose' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}
                onClick={() => handleModeSwitch('loose')}>
                Loose ({baseUnitLabel})
              </button>
              <button type="button"
                className={`px-3 py-1.5 rounded ${saleMode === 'sealed' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}
                onClick={() => handleModeSwitch('sealed')}>
                Sealed {sealedPluralLabel}
              </button>
            </div>
          )}

          {/* Quantity input */}
          <div className="space-y-2">
            <Label htmlFor="quantity">
              Quantity ({quantityUnitLabel})
            </Label>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="icon" onClick={handleDecrement}>
                -
              </Button>
              <Input
                id="quantity"
                type="number"
                value={quantity}
                onChange={handleInputChange}
                className={`text-center ${quantity > availableStock ? 'border-orange-400 focus:border-orange-400' : ''}`}
                min={minValue}
                step={step}
              />
              <Button type="button" variant="outline" size="icon" onClick={handleIncrement}>
                +
              </Button>
            </div>
            <div className="text-sm text-center">
              {quantity > availableStock && (
                <p className="text-orange-500 mt-1">
                  Out-of-stock sale (+{isLoose ? uomCfg.formatQty(quantity - availableStock) : String(quantity - availableStock)} over limit)
                </p>
              )}
            </div>
          </div>

          {/* Stock usage bar */}
          {(isLoose || (!isSimple && saleMode === 'sealed')) && (
            <div className="space-y-2">
              <Progress value={Math.min(percentageUsed, 100)} className="h-2" />
              <p className="text-sm text-gray-500 text-center">
                {percentageUsed.toFixed(1)}% of {isLoose ? 'loose pool' : 'sealed stock'}
              </p>
            </div>
          )}

          {/* Total */}
          <div className="border-t pt-4">
            <div className="space-y-1">
              {isLoose && (
	                <div className="flex justify-between text-sm text-gray-600">
	                  <span>Price per {baseUnitLabel}:</span>
	                  <span>${formatLooseUnitPrice(unitPrice ?? 0)}</span>
	                </div>
              )}
              <div className="flex justify-between items-center text-lg font-medium">
                <span>Total:</span>
                <span className="text-green-600">${(totalPrice ?? 0).toFixed(2)}</span>
              </div>
            </div>
          </div>

        </div>
      <EditorialModalFooter>
        <EditorialButton variant="ghost" onClick={onClose}>
          Cancel
        </EditorialButton>
        <EditorialButton variant="primary" arrow onClick={handleConfirm}>
          {initialQuantity !== undefined ? 'Update item' : 'Add to cart'}
        </EditorialButton>
      </EditorialModalFooter>
    </EditorialModal>

    <EditorialModal
      open={showConfirmDialog}
      onOpenChange={setShowConfirmDialog}
      kicker="Out-of-stock sale"
      kickerTone="warning"
      title="Proceed beyond available stock?"
      description="This will create negative inventory that needs to be reconciled later."
    >
      <div className="grid grid-cols-2 gap-10 border-l-2 border-[#EA580C] bg-[#FFF7ED] px-5 py-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-[#6B7280]">Requested</p>
          <p className="font-light text-[28px] leading-none tabular-nums mt-2 text-[#EA580C]">
            {isLoose ? uomCfg.formatQty(quantity) : quantity}
            <span className="text-[11px] text-[#9CA3AF] ml-1.5">{quantityUnitLabel}</span>
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-[#6B7280]">Available</p>
          <p className="font-light text-[28px] leading-none tabular-nums mt-2 text-[#16A34A]">
            {isLoose ? uomCfg.formatQty(availableStock) : availableStock}
            <span className="text-[11px] text-[#9CA3AF] ml-1.5">{quantityUnitLabel}</span>
          </p>
        </div>
      </div>
      <p className="text-[11px] uppercase tracking-[0.28em] text-[#DC2626] mt-4">
        Shortage · +{isLoose ? uomCfg.formatQty(quantity - availableStock) : String(quantity - availableStock)} over limit
      </p>
      <EditorialModalFooter>
        <EditorialButton variant="ghost" onClick={() => setShowConfirmDialog(false)}>
          Cancel
        </EditorialButton>
        <EditorialButton variant="primary" arrow onClick={handleConfirmOutOfStock}>
          Proceed with sale
        </EditorialButton>
      </EditorialModalFooter>
    </EditorialModal>
    </>
  )
}
