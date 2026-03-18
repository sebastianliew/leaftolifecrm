"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import type { Product } from "@/types/inventory"
import { computeUnitPrice, safeContainerCapacity } from "@/lib/pricing"

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

  // ── Pricing ──
  const unitPrice = computeUnitPrice(product.sellingPrice, product.containerCapacity, isLoose ? 'volume' : 'quantity')
  const totalPrice = unitPrice * quantity

  // ── Stock availability ──
  const availableStock = isLoose
    ? loosePool
    : isSimple
      ? totalBaseStock
      : sealedContainers

  // ── Step / min ──
  const step = isLoose ? 0.1 : 1
  const minValue = isLoose ? 0.1 : 1

  // ── Labels ──
  const quantityUnitLabel = isLoose ? baseUnitLabel : isSimple ? baseUnitLabel : 'container(s)'

  const priceLabel = isLoose
    ? `$${unitPrice.toFixed(2)} per ${baseUnitLabel}`
    : isSimple
      ? `$${unitPrice.toFixed(2)} per ${baseUnitLabel}`
      : `$${unitPrice.toFixed(2)} per container (${containerCapacity} ${baseUnitLabel})`

  const stockLabel = isLoose
    ? `${loosePool} ${baseUnitLabel} in loose pool`
    : isSimple
      ? `${totalBaseStock} ${baseUnitLabel} available`
      : `${sealedContainers} sealed container${sealedContainers !== 1 ? 's' : ''} available`

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
    const num = isLoose ? parseFloat(raw) : parseInt(raw)
    if (!isNaN(num)) {
      setQuantity(Math.max(0, num))
    }
  }

  const handleModeSwitch = (mode: 'loose' | 'sealed') => {
    setSaleMode(mode)
    setQuantity(1) // Reset quantity when switching modes
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Select Quantity</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
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
                Sealed containers
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
                  Out-of-stock sale (+{(quantity - availableStock).toFixed(isLoose ? 1 : 0)} over limit)
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
                  <span>${unitPrice.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between items-center text-lg font-medium">
                <span>Total:</span>
                <span className="text-green-600">${totalPrice.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleConfirm} className="flex-1">
              {initialQuantity !== undefined ? 'Update Item' : 'Add to Cart'}
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* Out-of-stock confirmation */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <span className="text-orange-500">&#9888;&#65039;</span>
              Out-of-Stock Sale Warning
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will create negative inventory that needs to be reconciled later. Do you want to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4">
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="font-medium">Requested:</span>
                  <div className="text-lg font-bold text-orange-700">
                    {isLoose ? quantity.toFixed(1) : quantity} {quantityUnitLabel}
                  </div>
                </div>
                <div>
                  <span className="font-medium">Available:</span>
                  <div className="text-lg font-bold text-green-700">
                    {isLoose ? availableStock.toFixed(1) : availableStock} {quantityUnitLabel}
                  </div>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-orange-200">
                <span className="font-medium">Shortage:</span>
                <span className="ml-2 text-lg font-bold text-red-600">
                  +{(quantity - availableStock).toFixed(isLoose ? 1 : 0)} over limit
                </span>
              </div>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmOutOfStock}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Proceed with Sale
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}
