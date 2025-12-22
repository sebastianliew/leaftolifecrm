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
import type { Product } from "@/types/inventory"

interface SimpleQuantityInputProps {
  open: boolean
  onClose: () => void
  onConfirm: (quantity: number) => void
  product: Product | null
}

export function SimpleQuantityInput({ open, onClose, onConfirm, product }: SimpleQuantityInputProps) {
  const [quantity, setQuantity] = useState(1)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

  useEffect(() => {
    if (open) {
      setQuantity(1)
    }
  }, [open])

  const handleConfirm = () => {
    if (quantity <= 0) {
      alert('❌ Quantity must be greater than 0.')
      return
    }

    // Show warning for out-of-stock sales but allow them to proceed
    if (quantity > availableStock) {
      setShowConfirmDialog(true)
      return
    }

    onConfirm(quantity)
    onClose()
  }

  const handleConfirmOutOfStock = () => {
    setShowConfirmDialog(false)
    onConfirm(quantity)
    onClose()
  }

  if (!product) return null

  const totalPrice = product.sellingPrice * quantity
  const availableStock = product.currentStock

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Select Quantity</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 mt-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium">{product.name}</h4>
            <p className="text-sm text-gray-600">SKU: {product.sku}</p>
            <p className="text-sm text-gray-600">Available: {availableStock} units</p>
            <p className="text-lg font-medium text-green-600 mt-2">
              ${product.sellingPrice.toFixed(2)} per unit
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
              >
                -
              </Button>
              <Input
                id="quantity"
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className={`text-center ${quantity > availableStock ? 'border-orange-400 focus:border-orange-400' : ''}`}
                min={1}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setQuantity(quantity + 1)}
              >
                +
              </Button>
            </div>
            <div className="text-sm text-center">
              <p className="text-gray-500">Available: {availableStock} units</p>
              {quantity > availableStock && (
                <p className="text-orange-500 mt-1">
                  ⚠️ Out-of-stock sale (+{quantity - availableStock} over limit)
                </p>
              )}
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="flex justify-between items-center text-lg font-medium">
              <span>Total:</span>
              <span className="text-green-600">${totalPrice.toFixed(2)}</span>
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
                  <div className="text-lg font-bold text-orange-700">{quantity} units</div>
                </div>
                <div>
                  <span className="font-medium">Available:</span>
                  <div className="text-lg font-bold text-green-700">{availableStock} units</div>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-orange-200">
                <span className="font-medium">Shortage:</span>
                <span className="ml-2 text-lg font-bold text-red-600">
                  +{quantity - availableStock} units over limit
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