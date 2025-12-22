"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { FaShoppingCart, FaSearch, FaBox, FaFlask } from "react-icons/fa"
import type { Product } from "@/types/inventory"

interface ProductSectionProps {
  products: Product[]
  onAddProduct: (product: Product) => void
  onShowBlendTypeSelector: () => void
  onShowBundleSelector: () => void
  disabled?: boolean
}

export function ProductSection({ 
  products, 
  onAddProduct, 
  onShowBlendTypeSelector, 
  onShowBundleSelector,
  disabled 
}: ProductSectionProps) {
  const [productSearch, setProductSearch] = useState("")
  const [productModalOpen, setProductModalOpen] = useState(false)

  const filteredProducts = products.filter((product) => {
    const searchLower = productSearch.toLowerCase()
    const name = product.name?.toLowerCase() || ""
    const sku = product.sku?.toLowerCase() || ""
    const category = String(product.category || '').toLowerCase()
    return name.includes(searchLower) || sku.includes(searchLower) || category.includes(searchLower)
  })

  const selectProduct = (product: Product) => {
    onAddProduct(product)
    setProductModalOpen(false)
    setProductSearch("")
  }

  const getProductStock = (product: Product) => {
    return product.currentStock || 0
  }

  const getStockBadgeVariant = (stock: number) => {
    if (stock <= 0) return "destructive"
    if (stock <= 10) return "outline"
    return "secondary"
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FaShoppingCart className="w-5 h-5" />
          Products
        </CardTitle>
        <CardDescription>Add products to the transaction</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Dialog open={productModalOpen} onOpenChange={setProductModalOpen}>
            <DialogTrigger asChild>
              <Button 
                type="button" 
                variant="outline" 
                className="flex-1" 
                disabled={disabled}
              >
                <FaSearch className="w-4 h-4 mr-2" />
                Search Products
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[600px] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle>Search Products</DialogTitle>
              </DialogHeader>
              <div className="p-4">
                <Input
                  placeholder="Search by name, SKU, or category..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="mb-4"
                />
              </div>
              <div className="flex-1 overflow-y-auto px-4 pb-4">
                <div className="space-y-2">
                  {filteredProducts.map((product) => {
                    const totalStock = getProductStock(product)
                    return (
                      <div
                        key={product._id}
                        className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                          totalStock > 0 ? "hover:bg-accent" : "opacity-50 cursor-not-allowed"
                        }`}
                        onClick={() => totalStock > 0 && selectProduct(product)}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="font-medium">{product.name}</p>
                            <p className="text-sm text-muted-foreground">
                              SKU: {product.sku} | Category: {String(product.category)}
                            </p>
                            <div className="flex gap-2 mt-2 flex-wrap">
                              <div className="text-sm">
                                <span className="font-medium">Price:</span> ${product.sellingPrice} | <span className="font-medium">Stock:</span> {product.currentStock}
                              </div>
                            </div>
                          </div>
                          <Badge variant={getStockBadgeVariant(product.currentStock)}>
                            Stock: {product.currentStock}
                          </Badge>
                        </div>
                      </div>
                    )
                  })}
                  {filteredProducts.length === 0 && (
                    <p className="text-center text-muted-foreground py-4">No products found</p>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Button
            type="button"
            variant="outline"
            onClick={onShowBlendTypeSelector}
            disabled={disabled}
          >
            <FaFlask className="w-4 h-4 mr-2" />
            Add Blend
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={onShowBundleSelector}
            disabled={disabled}
          >
            <FaBox className="w-4 h-4 mr-2" />
            Add Bundle
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}