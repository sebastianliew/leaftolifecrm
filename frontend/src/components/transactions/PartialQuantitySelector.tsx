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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Progress } from "@/components/ui/progress"
import { FaBox, FaTint } from "react-icons/fa"
import { Package } from "lucide-react"
import type { Product } from "@/types/inventory"
import type { Bottle } from "@/types/container"
import BottleSelector from "./BottleSelector"

interface PartialQuantitySelectorProps {
  open: boolean
  onClose: () => void
  onConfirm: (quantity: number, containerId?: string | null, unitDisplay?: string) => void
  product: Product | null
}

export function PartialQuantitySelector({ open, onClose, onConfirm, product }: PartialQuantitySelectorProps) {
  const [quantity, setQuantity] = useState(1)
  const [saleMode, setSaleMode] = useState<'pieces' | 'volume'>('pieces')
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  // Bottle selection state
  const [showBottleSelector, setShowBottleSelector] = useState(false)
  const [selectedBottle, setSelectedBottle] = useState<Bottle | null>(null)
  const [selectedContainerId, setSelectedContainerId] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setQuantity(1)
      setSaleMode('pieces')
      setSelectedBottle(null)
      setSelectedContainerId(null)
    }
  }, [open])

  const handleBottleSelect = (containerId: string | null, bottle: Bottle | null) => {
    setSelectedContainerId(containerId)
    setSelectedBottle(bottle)
  }

  const handleConfirm = () => {
    const minValue = saleMode === 'volume' ? 0.1 : 1;

    if (quantity < minValue) {
      alert(`❌ Quantity must be at least ${minValue}.`)
      return
    }

    // Show warning for out-of-stock sales but allow them to proceed
    if (quantity > maxQuantity) {
      setShowConfirmDialog(true)
      return
    }

    onConfirm(quantity, selectedContainerId, unitDisplay)
    onClose()
  }

  const handleConfirmOutOfStock = () => {
    setShowConfirmDialog(false)
    onConfirm(quantity, selectedContainerId, unitDisplay)
    onClose()
  }

  if (!product) return null

  const containerCapacity = product.containerCapacity || 1
  const totalStock = product.currentStock || 0
  
  // Calculate total available based on mode
  const totalAvailableVolume = totalStock * containerCapacity
  
  const maxQuantity = saleMode === 'pieces' 
    ? totalAvailableVolume // Total pieces available across all containers
    : totalAvailableVolume // Total volume available across all containers

  const pricePerUnit = saleMode === 'pieces'
    ? product.sellingPrice / containerCapacity
    : product.sellingPrice / containerCapacity

  const totalPrice = pricePerUnit * quantity
  const percentageUsed = (quantity / totalAvailableVolume) * 100

  const unitDisplay = saleMode === 'pieces' ? 'pieces' : 
    (typeof product.unitOfMeasurement === 'object' && product.unitOfMeasurement !== null 
      ? product.unitOfMeasurement.abbreviation || product.unitOfMeasurement.name 
      : 'units')

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Sell in Parts - {product.name}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 mt-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium">{product.name}</h4>
            <p className="text-sm text-gray-600">SKU: {product.sku}</p>
            <p className="text-sm text-gray-600">
              Container capacity: {containerCapacity} {unitDisplay}
            </p>
            <p className="text-sm text-gray-600">
              Available containers: {totalStock}
            </p>
            <p className="text-sm text-gray-600">
              Total available: {maxQuantity} {unitDisplay}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Sale Mode</Label>
            <RadioGroup value={saleMode} onValueChange={(value) => setSaleMode(value as 'pieces' | 'volume')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="pieces" id="pieces" />
                <Label htmlFor="pieces" className="flex items-center gap-2 cursor-pointer">
                  <FaBox className="w-4 h-4" />
                  Sell by pieces
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="volume" id="volume" />
                <Label htmlFor="volume" className="flex items-center gap-2 cursor-pointer">
                  <FaTint className="w-4 h-4" />
                  Sell by volume
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Bottle Selection */}
          {containerCapacity > 0 && (
            <div className="space-y-2 p-3 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-green-800">Select Bottle (Optional)</Label>
                  <p className="text-xs text-green-700">
                    {selectedBottle ? (
                      <span className="flex items-center gap-1">
                        <Package className="w-3 h-3" />
                        {selectedBottle.remaining} {unitDisplay} remaining
                      </span>
                    ) : (
                      'Auto-select (FIFO) or choose specific bottle'
                    )}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBottleSelector(true)}
                  className="border-green-300 text-green-700 hover:bg-green-100"
                >
                  <Package className="w-4 h-4 mr-1" />
                  {selectedBottle ? 'Change' : 'Select'}
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity ({unitDisplay})</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  const step = saleMode === 'volume' ? 0.1 : 1;
                  const minValue = saleMode === 'volume' ? 0.1 : 1;
                  setQuantity(Math.max(minValue, quantity - step));
                }}
              >
                -
              </Button>
              <Input
                id="quantity"
                type="number"
                value={quantity}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '') {
                    setQuantity(0);
                  } else {
                    const numValue = saleMode === 'volume' ? parseFloat(value) : parseInt(value);
                    if (!isNaN(numValue)) {
                      setQuantity(Math.max(0.1, numValue));
                    }
                  }
                }}
                className="text-center"
                min={saleMode === 'volume' ? 0.1 : 1}
                step={saleMode === 'volume' ? 0.1 : 1}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  const step = saleMode === 'volume' ? 0.1 : 1;
                  setQuantity(quantity + step);
                }}
              >
                +
              </Button>
            </div>
            <div className="text-sm text-center">
              <p className="text-gray-500">
                Available: {maxQuantity} {unitDisplay}
              </p>
              {quantity > maxQuantity && (
                <p className="text-orange-500 mt-1">
                  ⚠️ Out-of-stock sale (+{(quantity - maxQuantity).toFixed(1)} over limit)
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Stock Usage</Label>
            <Progress value={percentageUsed} className="h-2" />
            <p className="text-sm text-gray-500 text-center">
              {percentageUsed.toFixed(1)}% of total available stock
            </p>
            {saleMode === 'volume' && (
              <p className="text-xs text-gray-400 text-center">
                This will consume from {Math.ceil(quantity / containerCapacity)} container(s)
              </p>
            )}
          </div>

          <div className="border-t pt-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Price per {saleMode === 'pieces' ? 'piece' : unitDisplay}:</span>
                <span>${pricePerUnit.toFixed(2)}</span>
              </div>
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
              Add to Cart
            </Button>
          </div>
        </div>
      </DialogContent>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <span className="text-orange-500">⚠️</span>
              Out-of-Stock Sale Warning
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will create negative inventory that needs to be reconciled later. Do you want to proceed with this out-of-stock sale?
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-4">
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="font-medium">Requested:</span>
                  <div className="text-lg font-bold text-orange-700">
                    {saleMode === 'volume' ? quantity.toFixed(1) : quantity} {unitDisplay}
                  </div>
                </div>
                <div>
                  <span className="font-medium">Available:</span>
                  <div className="text-lg font-bold text-green-700">{maxQuantity} {unitDisplay}</div>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-orange-200">
                <span className="font-medium">Shortage:</span>
                <span className="ml-2 text-lg font-bold text-red-600">
                  +{(quantity - maxQuantity).toFixed(1)} {unitDisplay} over limit
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

      {/* Bottle Selector Modal */}
      {product && (
        <BottleSelector
          productId={product._id || ''}
          productName={product.name}
          requiredQuantity={quantity}
          unitAbbreviation={unitDisplay}
          open={showBottleSelector}
          onClose={() => setShowBottleSelector(false)}
          onSelect={handleBottleSelect}
        />
      )}
    </Dialog>
  )
}