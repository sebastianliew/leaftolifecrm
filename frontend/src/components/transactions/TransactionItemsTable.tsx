"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { IoClose } from "react-icons/io5"
import type { TransactionItem } from "@/types/transaction"

interface TransactionItemsTableProps {
  items: TransactionItem[]
  onUpdateQuantity: (itemId: string, quantity: number) => void
  onUpdateVolume: (itemId: string, volume: number) => void
  onRemoveItem: (itemId: string) => void
  disabled?: boolean
}

export function TransactionItemsTable({ 
  items, 
  onUpdateQuantity, 
  onUpdateVolume, 
  onRemoveItem,
  disabled 
}: TransactionItemsTableProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "SGD",
    }).format(amount)
  }

  const getItemTypeIcon = (item: TransactionItem) => {
    if (item.itemType === 'custom_blend' || item.itemType === 'fixed_blend') return "🧪"
    if (item.bundleId) return "📦"
    return ""
  }

  const getItemName = (item: TransactionItem) => {
    if (item.itemType === "fixed_blend" && item.blendTemplateId) {
      return item.name
    }
    if (item.itemType === "custom_blend" && item.customBlendData) {
      return item.customBlendData.name
    }
    if (item.itemType === "bundle" && item.bundleData) {
      return item.bundleData.bundleName
    }
    return item.name
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No items added to transaction
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Product</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Price</TableHead>
          <TableHead>Quantity/Volume</TableHead>
          <TableHead>Subtotal</TableHead>
          <TableHead className="w-[50px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item, index) => (
          <TableRow key={item.id || `item-${index}`}>
            <TableCell className="font-medium">
              <div className="flex items-center gap-2">
                <span>{getItemTypeIcon(item)}</span>
                <span>{getItemName(item)}</span>
              </div>
            </TableCell>
            <TableCell>
              {item.itemType === 'fixed_blend' || item.itemType === 'custom_blend' ? (
                <Badge variant="secondary">
                  {item.itemType === "fixed_blend" ? "Fixed Blend" : "Custom Blend"}
                </Badge>
              ) : item.itemType === 'bundle' ? (
                <Badge variant="default">Bundle</Badge>
              ) : item.saleType ? (
                <Badge variant="outline">{item.saleType}</Badge>
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </TableCell>
            <TableCell>{formatCurrency(item.unitPrice)}</TableCell>
            <TableCell>
              {item.saleType === "quantity" ? (
                <Input
                  type="number"
                  value={item.quantity}
                  onChange={(e) => onUpdateQuantity(item.id || '', Number.parseInt(e.target.value) || 0)}
                  className="w-20"
                  min="1"
                  disabled={disabled}
                />
              ) : item.saleType === "volume" ? (
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    value={item.quantity || 0}
                    onChange={(e) => onUpdateVolume(item.id || '', Number.parseFloat(e.target.value) || 0)}
                    className="w-20"
                    min="0.1"
                    step="0.1"
                    disabled={disabled}
                  />
                  <span className="text-sm text-muted-foreground">g</span>
                </div>
              ) : (
                <span>{item.quantity}</span>
              )}
            </TableCell>
            <TableCell className="font-medium">
              {formatCurrency(item.totalPrice)}
            </TableCell>
            <TableCell>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onRemoveItem(item.id || '')}
                disabled={disabled}
              >
                <IoClose className="w-4 h-4" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}