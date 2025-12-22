"use client"

import React from "react"
import { TableCell, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { HiPencil, HiTrash, HiExclamationTriangle } from "react-icons/hi2"
import { formatCurrency } from "@/lib/utils"
import type { Product } from "@/types/inventory"

interface ProductTableRowProps {
  product: Product
  isSelected: boolean
  hasAlert: boolean
  onSelect: (productId: string, checked: boolean) => void
  onEdit: (product: Product) => void
  onDelete: (product: Product) => void
  onAddStock: (product: Product) => void
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "active":
    case "in-stock":
      return "bg-green-100 text-green-800"
    case "oversold":
      return "bg-orange-100 text-orange-800"
    case "out-of-stock":
      return "bg-red-100 text-red-800"
    case "low-stock":
      return "bg-yellow-100 text-yellow-800"
    default:
      return "bg-gray-100 text-gray-800"
  }
}

const getStockStatus = (product: Product) => {
  if (product.currentStock < 0) return "oversold"
  if (product.currentStock === 0) return "out-of-stock"
  if (product.currentStock <= product.reorderPoint) return "low-stock"
  return "in-stock"
}

export const ProductTableRow = React.memo(({
  product,
  isSelected,
  hasAlert,
  onSelect,
  onEdit,
  onDelete,
  onAddStock
}: ProductTableRowProps) => {
  const stockStatus = getStockStatus(product)
  
  return (
    <TableRow className="hover:bg-gray-50">
      <TableCell className="w-12">
        <Checkbox
          checked={isSelected}
          onCheckedChange={(checked) => onSelect(product._id, checked as boolean)}
        />
      </TableCell>
      <TableCell>
        <div className="font-medium">{product.name}</div>
        <div className="text-sm text-gray-500">{product.sku}</div>
      </TableCell>
      <TableCell>{product.category?.name || "-"}</TableCell>
      <TableCell>{product.brand?.name || "-"}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <span className={
            product.currentStock < 0 
              ? "text-orange-600 font-medium" 
              : product.currentStock <= product.reorderPoint 
                ? "text-red-600 font-medium" 
                : ""
          }>
            {product.currentStock}
            {product.currentStock < 0 && (
              <span className="text-xs ml-1 text-orange-500">
                (Backorder: {Math.abs(product.currentStock)})
              </span>
            )}
          </span>
          {product.unitOfMeasurement?.abbreviation || ""}
          {hasAlert && (
            <HiExclamationTriangle className="h-4 w-4 text-yellow-500" title="Stock alert" />
          )}
          {product.currentStock < 0 && (
            <span className="text-xs text-orange-500 ml-2 bg-orange-50 px-1 py-0.5 rounded" title="Needs restocking">
              OVERSOLD
            </span>
          )}
        </div>
      </TableCell>
      <TableCell>{product.reorderPoint}</TableCell>
      <TableCell>{formatCurrency(product.sellingPrice)}</TableCell>
      <TableCell>
        <Badge className={getStatusColor(stockStatus)}>
          {stockStatus}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onAddStock(product)}
            title="Add stock"
          >
            +
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(product)}
            title="Edit product"
          >
            <HiPencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(product)}
            title="Delete product"
          >
            <HiTrash className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}, (prevProps, nextProps) => {
  // Custom comparison for better performance
  return prevProps.product._id === nextProps.product._id &&
         prevProps.product.currentStock === nextProps.product.currentStock &&
         prevProps.product.sellingPrice === nextProps.product.sellingPrice &&
         prevProps.isSelected === nextProps.isSelected &&
         prevProps.hasAlert === nextProps.hasAlert
})

ProductTableRow.displayName = 'ProductTableRow'