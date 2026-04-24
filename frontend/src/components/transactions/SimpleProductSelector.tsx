"use client"

import { useState, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { FaSearch } from "react-icons/fa"
import type { Product } from "@/types/inventory"
import { safeContainerCapacity } from "@/lib/pricing"

function formatStockDisplay(product: Product): { text: string; unit: string } {
  const cap = safeContainerCapacity(product.containerCapacity)
  const stock = product.currentStock ?? 0
  const looseStock = product.looseStock ?? 0
  const unitLabel = typeof product.unitOfMeasurement === 'object' && product.unitOfMeasurement
    ? (product.unitOfMeasurement.abbreviation || product.unitOfMeasurement.name)
    : product.unitName || 'units'

  // Simple products (no container subdivision)
  if (cap <= 1) {
    return { text: `${stock}`, unit: unitLabel }
  }

  // Products with containers: show total + breakdown
  const sealedStock = Math.max(0, stock - looseStock)
  const sealedContainers = Math.floor(sealedStock / cap)
  const looseAmount = Math.max(0, looseStock)

  const parts: string[] = []
  if (sealedContainers > 0) parts.push(`${sealedContainers} sealed`)
  if (looseAmount > 0) parts.push(`${looseAmount} ${unitLabel} loose`)

  const breakdown = parts.length > 0 ? ` (${parts.join(' + ')})` : ''
  return { text: `${stock} ${unitLabel}${breakdown}`, unit: '' }
}

interface SimpleProductSelectorProps {
  open: boolean
  onClose: () => void
  onSelectProduct: (product: Product) => void
  products: Product[]
}

export function SimpleProductSelector({ open, onClose, onSelectProduct, products }: SimpleProductSelectorProps) {
  const [search, setSearch] = useState("")

  const filteredProducts = useMemo(() => {
    // Filter out any non-product items first
    const validProducts = products.filter(product => {
      // Type guard to ensure we only show actual inventory products
      return (
        product._id && 
        product._id !== 'consultation-fee' &&
        product.sku &&
        product.currentStock !== undefined &&
        !('isService' in product && product.isService)
      )
    })
    
    if (!search) return validProducts.slice(0, 20)
    
    return validProducts.filter(product => 
      product.name.toLowerCase().includes(search.toLowerCase()) ||
      product.sku.toLowerCase().includes(search.toLowerCase())
    )
  }, [products, search])

  const handleProductSelect = (product: Product) => {
    onSelectProduct(product)
    setSearch("")
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Select Product</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search by name or SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
              autoFocus
            />
          </div>

          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {filteredProducts.map((product) => (
              <div
                key={product._id}
                className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => handleProductSelect(product)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium">{product.name}</h4>
                    <div className="flex items-center gap-3 text-sm text-gray-600 mt-1 flex-wrap">
                      <span>SKU: {product.sku}</span>
                      {(() => {
                        const display = formatStockDisplay(product)
                        return (
                          <span className={product.currentStock < 0 ? "text-orange-600 font-medium" : ""}>
                            Stock: {display.text}{display.unit ? ` ${display.unit}` : ''}
                            {product.currentStock < 0 && (
                              <span className="text-xs ml-1 text-orange-500">
                                (Backorder: {Math.abs(product.currentStock)})
                              </span>
                            )}
                          </span>
                        )
                      })()}
                      {product.currentStock < 0 && (
                        <span className="text-xs text-orange-500 bg-orange-50 px-1 py-0.5 rounded">
                          OVERSOLD
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-lg px-3 py-1">
                    ${(product.sellingPrice ?? 0).toFixed(2)}
                  </Badge>
                </div>
              </div>
            ))}
            
            {filteredProducts.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No products found
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}