"use client"

import { useState, useEffect, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { HiCurrencyDollar } from "react-icons/hi2"
import { useConsultationSettings } from "@/hooks/useConsultationSettings"
import type { TransactionItem } from "@/types/transaction"
import { formatCurrency, CURRENCY_CODE } from "@/utils/currency"
import { useUnitsQuery } from "@/hooks/queries/use-units-query"

interface ConsultationSelectorProps {
  open: boolean
  onClose: () => void
  onSelectConsultation: (consultationItem: TransactionItem) => void
  loading?: boolean
  editingItem?: TransactionItem
}

export function ConsultationSelector({ 
  open, 
  onClose, 
  onSelectConsultation, 
  loading,
  editingItem
}: ConsultationSelectorProps) {
  const { data: units = [] } = useUnitsQuery()
  
  // Calculate default unit ID for consultation items with guaranteed fallback
  const defaultUnitId = useMemo(() => {
    if (!units.length) {
      // Units still loading - return null to indicate not ready yet
      return null;
    }

    // Find a suitable unit for consultation/service items
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
      u.name.toLowerCase().includes('consultation') ||
      u.name.toLowerCase().includes('session')
    );
    
    if (countUnit) {
      return countUnit.id || countUnit._id;
    }

    // Final fallback to first available unit (guaranteed to exist if units.length > 0)
    return units[0].id || units[0]._id;
  }, [units])

  const { settings, discountPresets, getSettings, getDiscountPresets } = useConsultationSettings()
  const [selectedDiscount, setSelectedDiscount] = useState<string | null>(null)
  const [customAmount, setCustomAmount] = useState<string>("")
  const [finalAmount, setFinalAmount] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      try {
        await Promise.all([getSettings(), getDiscountPresets()])
      } catch (error) {
        console.error('Failed to load consultation data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    if (open) {
      loadData()
    }
  }, [open, getSettings, getDiscountPresets])

  useEffect(() => {
    if (settings && Array.isArray(discountPresets)) {
      if (editingItem) {
        // Pre-populate with existing item values
        const existingPreset = discountPresets.find(preset => 
          Math.abs((preset.price || 0) - editingItem.unitPrice) < 0.01
        )
        
        if (existingPreset) {
          setSelectedDiscount(existingPreset.id)
        } else {
          setSelectedDiscount(null)
        }
        
        setFinalAmount(editingItem.unitPrice)
        setCustomAmount(editingItem.unitPrice.toString())
      } else {
        // Default values for new consultation - use first preset or 0
        const defaultAmount = discountPresets.length > 0 ? (discountPresets[0].price || 0) : 0
        setFinalAmount(defaultAmount)
        setCustomAmount(defaultAmount.toString())
        setSelectedDiscount(discountPresets.length > 0 ? discountPresets[0].id : null)
      }
    }
  }, [settings, editingItem, discountPresets])

  const handleDiscountSelect = (presetId: string) => {
    if (!Array.isArray(discountPresets)) return
    const preset = discountPresets.find(p => p.id === presetId)
    if (!preset) return

    setSelectedDiscount(presetId)
    const price = preset.price || 0
    setFinalAmount(price)
    setCustomAmount(price.toString())
  }

  const handleCustomAmountChange = (value: string) => {
    setCustomAmount(value)
    const amount = parseFloat(value)
    if (!isNaN(amount) && amount >= 0) {
      setFinalAmount(amount)
      setSelectedDiscount(null)
    }
  }

  const handleConfirm = () => {
    if (finalAmount <= 0) return

    // CRITICAL: Ensure units are loaded before proceeding
    if (!defaultUnitId) {
      console.error('Units not loaded yet - cannot create consultation item');
      return;
    }

    const selectedPreset = selectedDiscount && Array.isArray(discountPresets) ? discountPresets.find(p => p.id === selectedDiscount) : null
    const discountAmount = 0 // No discount concept anymore

    const consultationItem: TransactionItem = {
      id: editingItem?.id || `consultation_${Date.now()}`,
      productId: "consultation-fee",
      name: "Consultation Fee",
      description: selectedPreset ? selectedPreset.name : "Custom Consultation",
      quantity: 1,
      unitPrice: finalAmount,
      totalPrice: finalAmount,
      discountAmount: discountAmount,
      isService: true,
      itemType: 'consultation' as const,
      saleType: 'quantity',
      unitOfMeasurementId: defaultUnitId, // Guaranteed to be valid here
      baseUnit: "service",
      convertedQuantity: 1
    }

    onSelectConsultation(consultationItem)
    onClose()
    
    // Reset state
    const defaultAmount = Array.isArray(discountPresets) && discountPresets.length > 0 ? (discountPresets[0].price || 0) : 0
    setFinalAmount(defaultAmount)
    setCustomAmount(defaultAmount.toString())
    setSelectedDiscount(Array.isArray(discountPresets) && discountPresets.length > 0 ? discountPresets[0].id : null)
  }

  const handleCancel = () => {
    onClose()
    // Reset state
    const defaultAmount = Array.isArray(discountPresets) && discountPresets.length > 0 ? (discountPresets[0].price || 0) : 0
    setFinalAmount(defaultAmount)
    setCustomAmount(defaultAmount.toString())
    setSelectedDiscount(Array.isArray(discountPresets) && discountPresets.length > 0 ? discountPresets[0].id : null)
  }

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HiCurrencyDollar className="w-5 h-5" />
              Select Consultation Fee
            </DialogTitle>
          </DialogHeader>
          <div className="flex justify-center py-8">
            <p className="text-gray-500">Loading consultation settings...</p>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HiCurrencyDollar className="w-5 h-5" />
            {editingItem ? 'Edit Consultation Fee' : 'Select Consultation Fee'}
          </DialogTitle>
        </DialogHeader>
        
        {/* Discount Notice */}
        <div className="bg-blue-50 border border-blue-200 p-3 rounded-md">
          <div className="flex items-start gap-2">
            <span className="text-blue-500 text-sm">ℹ️</span>
            <div className="text-sm text-blue-700">
              <strong>Discount Policy:</strong> Patient-level discounts do not apply to consultation fees.
            </div>
          </div>
        </div>
        
        <div className="space-y-6">

          {/* Consultation Prices */}
          {Array.isArray(discountPresets) && discountPresets.length > 0 && (
            <div>
              <Label className="text-base font-semibold mb-3 block">Select Consultation Type</Label>
              <div className="grid grid-cols-2 gap-3">
                {discountPresets.map((preset) => {
                  const isSelected = selectedDiscount === preset.id
                  
                  return (
                    <button
                      key={preset.id}
                      onClick={() => handleDiscountSelect(preset.id)}
                      className={`p-4 rounded-lg border-2 transition-all text-left ${
                        isSelected 
                          ? 'border-orange-500 bg-orange-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-medium">{preset.name}</span>
                      </div>
                      <p className="text-lg font-bold text-orange-600">
                        {formatCurrency(preset.price || 0)}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Custom Amount */}
          <div>
            <Label htmlFor="custom-amount" className="text-base font-semibold mb-2 block">
              Or Enter Custom Amount
            </Label>
            <div className="flex items-center gap-2">
              <span className="text-gray-600">{settings?.currency || CURRENCY_CODE}</span>
              <Input
                id="custom-amount"
                type="number"
                value={customAmount}
                onChange={(e) => handleCustomAmountChange(e.target.value)}
                className="text-lg"
                placeholder="0.00"
                min="0"
                step="0.01"
              />
            </div>
          </div>

          {/* Final Amount Summary */}
          <div className="border-t pt-4">
            <div className="flex justify-between items-center mb-4">
              <span className="text-lg font-semibold">Final Amount</span>
              <span className="text-2xl font-bold text-orange-600">
                {formatCurrency(finalAmount, true)}
              </span>
            </div>
            
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              className="flex-1"
              onClick={handleConfirm}
              disabled={loading || finalAmount <= 0}
            >
              {editingItem ? 'Update Consultation' : 'Add Consultation'}
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