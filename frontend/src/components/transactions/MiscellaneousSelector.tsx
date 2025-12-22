"use client"

import { useState, useEffect, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { HiOutlinePencilSquare } from "react-icons/hi2"
import type { TransactionItem } from "@/types/transaction"
import { formatCurrency } from "@/utils/currency"
import { useUnitsQuery } from "@/hooks/queries/use-units-query"

interface MiscellaneousSelectorProps {
  open: boolean
  onClose: () => void
  onSelectMiscellaneous: (miscItem: TransactionItem) => void
  loading?: boolean
  editingItem?: TransactionItem
}

type MiscellaneousCategory = 'supply' | 'service' | 'fee' | 'credit' | 'other'

const categoryLabels: Record<MiscellaneousCategory, string> = {
  supply: 'Supply',
  service: 'Service',
  fee: 'Fee',
  credit: 'Credit',
  other: 'Other'
}

// Role-based amount limits
const roleLimits = {
  staff: 500,
  manager: 5000,
  admin: 999999.99
}

export function MiscellaneousSelector({ 
  open, 
  onClose, 
  onSelectMiscellaneous, 
  loading,
  editingItem
}: MiscellaneousSelectorProps) {
  const { data: units = [] } = useUnitsQuery()
  
  // Calculate default unit ID for miscellaneous items with guaranteed fallback
  const defaultUnitId = useMemo(() => {
    if (!units.length) {
      // Units still loading - return null to indicate not ready yet
      return null;
    }

    // Find a suitable unit for miscellaneous items (prefer service or count-based units)
    const serviceUnit = units.find((u) =>
      u.name.toLowerCase().includes('service')
    );
    
    if (serviceUnit) {
      return serviceUnit.id || serviceUnit._id;
    }
    
    // Fallback to count-based units
    const countUnit = units.find((u) =>
      u.type === 'count' ||
      u.name.toLowerCase().includes('unit') ||
      u.name.toLowerCase().includes('piece') ||
      u.name.toLowerCase().includes('each')
    );
    
    if (countUnit) {
      return countUnit.id || countUnit._id;
    }

    // Final fallback to first available unit (guaranteed to exist if units.length > 0)
    return units[0].id || units[0]._id;
  }, [units])

  const [name, setName] = useState(editingItem?.name || "")
  const [description, setDescription] = useState(editingItem?.description || "")
  const [category, setCategory] = useState<MiscellaneousCategory>((editingItem?.miscellaneousCategory as MiscellaneousCategory) || 'other')
  const [amount, setAmount] = useState(editingItem?.unitPrice?.toString() || "")
  const [quantity, setQuantity] = useState(editingItem?.quantity?.toString() || "1")
  const [isTaxable, setIsTaxable] = useState(editingItem?.isTaxable ?? true)

  // When category changes to credit, make it non-taxable
  useEffect(() => {
    if (category === 'credit') {
      setIsTaxable(false)
    }
  }, [category])
  
  // For now, default to admin role - in production this would come from user context
  const userRole = 'admin'
  const maxAmount = roleLimits[userRole as keyof typeof roleLimits]

  const handleConfirm = () => {
    const unitPrice = parseFloat(amount)
    const qty = parseInt(quantity)
    
    if (!name.trim() || isNaN(unitPrice) || unitPrice <= 0 || isNaN(qty) || qty <= 0) {
      alert('Please fill in all required fields with valid values')
      return
    }

    if (unitPrice > maxAmount) {
      alert(`Amount exceeds your limit of ${formatCurrency(maxAmount)}`)
      return
    }

    // CRITICAL: Ensure units are loaded before proceeding
    if (!defaultUnitId) {
      console.error('Units not loaded yet - cannot create miscellaneous item');
      return;
    }

    const miscItem: TransactionItem = {
      id: editingItem?.id || `misc_${Date.now()}`,
      productId: `misc_${category}_${Date.now()}`,
      name: category === 'credit' ? `Credit: ${name.trim()}` : name.trim(),
      description: description.trim() || `${categoryLabels[category]} - ${name}`,
      quantity: qty,
      unitPrice: category === 'credit' ? -Math.abs(unitPrice) : unitPrice,
      totalPrice: category === 'credit' ? -Math.abs(unitPrice * qty) : unitPrice * qty,
      discountAmount: 0,
      isService: category === 'service',
      saleType: 'quantity',
      unitOfMeasurementId: defaultUnitId, // Guaranteed to be valid here
      baseUnit: "unit",
      convertedQuantity: qty,
      itemType: 'miscellaneous',
      miscellaneousCategory: category,
      isTaxable: category === 'credit' ? false : isTaxable
    }

    onSelectMiscellaneous(miscItem)
    handleCancel()
  }

  const handleCancel = () => {
    // Reset form
    setName("")
    setDescription("")
    setCategory('other')
    setAmount("")
    setQuantity("1")
    setIsTaxable(true)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HiOutlinePencilSquare className="w-5 h-5" />
            {editingItem ? 'Edit Miscellaneous Item' : 'Add Miscellaneous Item'}
          </DialogTitle>
        </DialogHeader>
        
        {/* Discount Notice */}
        <div className="bg-blue-50 border border-blue-200 p-3 rounded-md">
          <div className="flex items-start gap-2">
            <span className="text-blue-500 text-sm">ℹ️</span>
            <div className="text-sm text-blue-700">
              <strong>Discount Policy:</strong> Patient-level discounts do not apply to miscellaneous items (rentals, medical tests, fees, etc.).
            </div>
          </div>
        </div>
        
        <div className="space-y-4">
          {/* Name */}
          <div>
            <Label htmlFor="misc-name">Item Name *</Label>
            <Input
              id="misc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter item name"
              maxLength={100}
            />
          </div>

          {/* Category */}
          <div>
            <Label htmlFor="misc-category">Category *</Label>
            <Select value={category} onValueChange={(value) => setCategory(value as MiscellaneousCategory)}>
              <SelectTrigger id="misc-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="supply">Supply</SelectItem>
                <SelectItem value="service">Service</SelectItem>
                <SelectItem value="fee">Fee</SelectItem>
                <SelectItem value="credit">Credit (Store Credit)</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            {category === 'credit' && (
              <p className="text-sm text-amber-600 mt-2 p-2 bg-amber-50 rounded">
                ⚠️ Note: Credit is used as store credit to deduct from the total amount. The amount entered will be subtracted from the transaction total.
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="misc-description">Description (Optional)</Label>
            <Textarea
              id="misc-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter item description"
              rows={3}
              maxLength={500}
            />
          </div>

          {/* Amount and Quantity */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="misc-amount">Unit Price *</Label>
              <Input
                id="misc-amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                min="0.01"
                max={maxAmount}
                step="0.01"
              />
              <p className="text-sm text-gray-500 mt-1">
                Max: {formatCurrency(maxAmount)}
              </p>
            </div>
            
            <div>
              <Label htmlFor="misc-quantity">Quantity *</Label>
              <Input
                id="misc-quantity"
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="1"
                min="1"
                step="1"
              />
            </div>
          </div>

          {/* Tax Status */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="misc-taxable"
              checked={isTaxable}
              onChange={(e) => setIsTaxable(e.target.checked)}
              className="w-4 h-4"
            />
            <Label htmlFor="misc-taxable" className="cursor-pointer">
              Item is taxable
            </Label>
          </div>

          {/* Total Preview */}
          {amount && quantity && !isNaN(parseFloat(amount)) && !isNaN(parseInt(quantity)) && (
            <div className="border-t pt-4">
              <div className="flex justify-between items-center">
                <span className="font-semibold">
                  {category === 'credit' ? 'Credit Amount (will be deducted):' : 'Total Amount:'}
                </span>
                <span className={`text-xl font-bold ${category === 'credit' ? 'text-red-600' : 'text-green-600'}`}>
                  {category === 'credit' ? '-' : ''}{formatCurrency(parseFloat(amount) * parseInt(quantity))}
                </span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              className="flex-1"
              onClick={handleConfirm}
              disabled={loading || !name.trim() || !amount || parseFloat(amount) <= 0}
            >
              {editingItem ? 'Update Item' : 'Add Item'}
            </Button>
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={loading}
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}