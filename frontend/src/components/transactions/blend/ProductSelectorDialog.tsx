"use client"

import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FaSearch } from 'react-icons/fa'
import type { Product, UnitOfMeasurement } from '@/types/inventory'
import type { BlendIngredient } from '@/types/blend'

interface ProductSelectorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  products: Product[]
  existingIngredients: BlendIngredient[]
  onSelectProduct: (product: Product) => void
  unitOfMeasurements?: UnitOfMeasurement[]
}

export const ProductSelectorDialog = React.memo(function ProductSelectorDialog({
  open,
  onOpenChange,
  products,
  existingIngredients,
  onSelectProduct,
  unitOfMeasurements: _unitOfMeasurements = []
}: ProductSelectorDialogProps) {
  const [search, setSearch] = useState('')

  // Filter products for liquids only
  const filteredProducts = products.filter(product => {
    if (!product.isActive) return false;
    
    // Filter by search term
    const matchesSearch = product.name.toLowerCase().includes(search.toLowerCase()) ||
                         product.sku.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    
    // Exclude non-blendable items based on category or name
    const nonBlendableKeywords = ['tablet', 'consultation'];
    const isNonBlendable = nonBlendableKeywords.some(keyword => 
      product.name.toLowerCase().includes(keyword) ||
      product.category?.name?.toLowerCase().includes(keyword)
    );
    
    return !isNonBlendable;
  })

  const handleSelectProduct = (product: Product) => {
    onSelectProduct(product)
    setSearch('') // Reset search when product is selected
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Select Product as Ingredient</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="relative">
            <FaSearch className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="border rounded-lg">
            {/* Fixed Header */}
            <div className="bg-white border-b sticky top-0 z-10">
              <div className="grid grid-cols-6 gap-4 p-3 font-medium text-sm">
                <div>Name</div>
                <div>Category</div>
                <div>Stock</div>
                <div>Selling Price</div>
                <div>SKU</div>
                <div>Action</div>
              </div>
            </div>
            
            {/* Scrollable Body */}
            <div className="max-h-96 overflow-y-auto">
              <div className="divide-y">
                {filteredProducts.map(product => {
                  const isAdded = existingIngredients.some(ing => ing.productId === product._id)
                  return (
                    <div key={product._id} className="grid grid-cols-6 gap-4 p-3 items-center hover:bg-gray-50">
                      <div className="font-medium">{product.name}</div>
                      <div className="text-sm text-gray-600">{product.category?.name || 'N/A'}</div>
                      <div className="text-sm">
                        <Badge variant={product.currentStock && product.currentStock > 0 ? 'default' : 'destructive'}>
                          {product.currentStock || 0}
                        </Badge>
                      </div>
                      <div className="text-sm">${product.sellingPrice?.toFixed(2) || '0.00'}</div>
                      <div className="text-xs text-gray-500">{product.sku}</div>
                      <div>
                        <Button
                          size="sm"
                          onClick={() => handleSelectProduct(product)}
                          disabled={isAdded}
                        >
                          {isAdded ? 'Added' : 'Add'}
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
})